const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const TIMEOUT_MS = 30000; // 30 second timeout per request
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Create axios instance with timeout
const httpClient = axios.create({
  timeout: TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});

// Tracking
const logs = {
  info: [],
  warnings: [],
  errors: [],
  repos: []
};

function log(level, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    message,
    ...data
  };
  logs[level].push(entry);
  console.log(`[${level.toUpperCase()}] ${message}`, data);
}

// Sleep helper for retries
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry logic
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log('info', `Fetching ${url} (attempt ${attempt}/${retries})`);
      const response = await httpClient.get(url);
      return response.data;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      
      if (isLastAttempt) {
        log('errors', `Failed to fetch after ${retries} attempts`, {
          url,
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        return null;
      }
      
      log('warnings', `Fetch attempt ${attempt} failed, retrying...`, {
        url,
        error: error.message
      });
      
      await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
    }
  }
  return null;
}

// Special handler for carvel.li repo
async function fetchCarvelRepo() {
  const url = 'https://plugins.carvel.li/';
  log('info', 'Processing carvel.li with special handler');
  
  try {
    const configData = await fetchWithRetry('https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json');
    
    if (!configData || !configData.Plugins) {
      log('errors', 'Carvel config has no plugins', { url });
      return [];
    }

    const plugins = [];
    log('info', `Found ${configData.Plugins.length} plugins in carvel config`);

    for (const { Name: pluginName } of configData.Plugins) {
      try {
        const releaseApi = `https://git.carvel.li/api/v1/repos/liza/${encodeURIComponent(pluginName)}/releases/latest`;
        const releaseData = await fetchWithRetry(releaseApi);
        
        if (!releaseData || !releaseData.assets) {
          log('warnings', 'No release assets found', { plugin: pluginName, url });
          continue;
        }

        const assets = releaseData.assets;
        const jsonAsset = assets.find(a => a.name.toLowerCase().includes('json'));
        const zipAsset = assets.find(a => a.name.toLowerCase().endsWith('.zip'));

        if (!jsonAsset || !zipAsset) {
          log('warnings', 'Missing required assets', { 
            plugin: pluginName, 
            hasJson: !!jsonAsset, 
            hasZip: !!zipAsset 
          });
          continue;
        }

        const pluginMeta = await fetchWithRetry(jsonAsset.browser_download_url);
        
        if (pluginMeta) {
          pluginMeta.DownloadLinkInstall = zipAsset.browser_download_url;
          pluginMeta.DownloadLinkUpdate = zipAsset.browser_download_url;
          pluginMeta.DownloadLinkTesting = zipAsset.browser_download_url;
          pluginMeta.DalamudApiLevel = 12;
          pluginMeta.Author = pluginMeta.Author?.trim() || 'Unknown';
          pluginMeta.RepoUrl = pluginMeta.RepoUrl || url;
          pluginMeta.SourceRepo = url;
          plugins.push(pluginMeta);
        }
      } catch (err) {
        log('errors', 'Error processing carvel plugin', {
          plugin: pluginName,
          error: err.message
        });
      }
    }

    log('info', `Successfully loaded ${plugins.length} plugins from carvel`);
    return plugins;
    
  } catch (error) {
    log('errors', 'Failed to process carvel repo', { error: error.message });
    return [];
  }
}

// Extract plugins from various JSON structures
function extractPlugins(data, sourceUrl) {
  if (!data) return [];

  let plugins = [];

  // Try different common structures
  if (Array.isArray(data)) {
    plugins = data;
  } else if (data.items && Array.isArray(data.items)) {
    plugins = data.items;
  } else if (data.plugins && Array.isArray(data.plugins)) {
    plugins = data.plugins;
  } else if (data.plugins && typeof data.plugins === 'object') {
    plugins = [data.plugins];
  } else if (data.InternalName) {
    plugins = [data];
  } else {
    log('warnings', 'Unrecognized JSON structure', { 
      url: sourceUrl,
      keys: Object.keys(data)
    });
    return [];
  }

  return plugins;
}

// Validate plugin has minimum required fields
function validatePlugin(plugin) {
  const required = ['InternalName', 'Name'];
  const missing = required.filter(field => !plugin[field]);
  
  if (missing.length > 0) {
    log('warnings', 'Plugin missing required fields', {
      plugin: plugin.InternalName || 'unknown',
      missing
    });
    return false;
  }
  
  return true;
}

// Process a single repository
async function processRepo(url) {
  const repoInfo = {
    url,
    status: 'pending',
    pluginsFound: 0,
    error: null
  };

  try {
    // Special handling for carvel
    if (url === 'https://plugins.carvel.li/') {
      const plugins = await fetchCarvelRepo();
      repoInfo.pluginsFound = plugins.length;
      repoInfo.status = plugins.length > 0 ? 'success' : 'empty';
      logs.repos.push(repoInfo);
      return plugins;
    }

    // Standard JSON fetch
    const data = await fetchWithRetry(url);
    
    if (!data) {
      repoInfo.status = 'failed';
      repoInfo.error = 'Failed to fetch data';
      logs.repos.push(repoInfo);
      return [];
    }

    const plugins = extractPlugins(data, url);
    
    if (plugins.length === 0) {
      repoInfo.status = 'empty';
      log('warnings', 'No plugins found in repo', { url });
      logs.repos.push(repoInfo);
      return [];
    }

    // Normalize all plugins
    const validPlugins = [];
    for (const plugin of plugins) {
      if (!validatePlugin(plugin)) continue;

      // Normalize fields
      plugin.Author = plugin.Author?.trim() || 'Unknown';
      plugin.RepoUrl = plugin.RepoUrl || url;
      plugin.SourceRepo = url;
      
      validPlugins.push(plugin);
    }

    repoInfo.pluginsFound = validPlugins.length;
    repoInfo.status = 'success';
    logs.repos.push(repoInfo);
    
    log('info', `Successfully loaded ${validPlugins.length} plugins from ${url}`);
    return validPlugins;

  } catch (error) {
    repoInfo.status = 'error';
    repoInfo.error = error.message;
    logs.repos.push(repoInfo);
    log('errors', 'Unexpected error processing repo', { url, error: error.message });
    return [];
  }
}

// Deduplicate plugins intelligently
function deduplicatePlugins(allPlugins) {
  const groups = {};
  
  // Group by InternalName
  for (const plugin of allPlugins) {
    const key = plugin.InternalName;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(plugin);
  }

  const result = [];
  
  for (const [name, versions] of Object.entries(groups)) {
    if (versions.length === 1) {
      result.push(versions[0]);
      continue;
    }

    // Multiple versions - pick the best one
    log('info', `Found ${versions.length} versions of ${name}`);
    
    const sorted = versions.sort((a, b) => {
      // Prefer plugins with download links
      const aHasDownload = !!(a.DownloadLinkInstall || a.DownloadLinkUpdate);
      const bHasDownload = !!(b.DownloadLinkInstall || b.DownloadLinkUpdate);
      if (aHasDownload !== bHasDownload) return bHasDownload ? 1 : -1;

      // Compare versions if available
      if (a.AssemblyVersion && b.AssemblyVersion) {
        return compareVersions(b.AssemblyVersion, a.AssemblyVersion);
      }

      // Prefer more complete metadata
      const aScore = Object.keys(a).length;
      const bScore = Object.keys(b).length;
      return bScore - aScore;
    });

    const best = sorted[0];
    best.AlternateSources = sorted
      .slice(1)
      .map(p => p.SourceRepo)
      .filter((v, i, arr) => arr.indexOf(v) === i); // unique

    result.push(best);
  }

  return result;
}

function compareVersions(v1, v2) {
  const parts1 = String(v1).split('.').map(x => parseInt(x) || 0);
  const parts2 = String(v2).split('.').map(x => parseInt(x) || 0);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

// Main function
async function main() {
  log('info', 'Starting plugin repository merge');
  
  // Read repo list
  const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  log('info', `Found ${repoList.length} repositories to process`);

  // Process all repos
  const allPlugins = [];
  for (const url of repoList) {
    const plugins = await processRepo(url);
    allPlugins.push(...plugins);
    
    // Small delay to avoid rate limiting
    await sleep(500);
  }

  log('info', `Total plugins fetched: ${allPlugins.length}`);

  // Deduplicate
  const uniquePlugins = deduplicatePlugins(allPlugins);
  log('info', `Unique plugins after deduplication: ${uniquePlugins.length}`);

  // Write output files
  try {
    fs.writeFileSync('repository.json', JSON.stringify(uniquePlugins, null, 2));
    log('info', 'Successfully wrote repository.json');

    // Generate reports
    const stats = {
      timestamp: new Date().toISOString(),
      total_repos: repoList.length,
      successful_repos: logs.repos.filter(r => r.status === 'success').length,
      failed_repos: logs.repos.filter(r => r.status === 'failed').length,
      empty_repos: logs.repos.filter(r => r.status === 'empty').length,
      total_plugins_fetched: allPlugins.length,
      unique_plugins: uniquePlugins.length,
      duplicates_removed: allPlugins.length - uniquePlugins.length,
      errors: logs.errors.length,
      warnings: logs.warnings.length
    };

    fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));

    // Detailed markdown report
    const report = `# Plugin Repository Merge Report
Generated: ${stats.timestamp}

## Summary
- **Total Repositories**: ${stats.total_repos}
- **Successful**: ${stats.successful_repos} ✅
- **Failed**: ${stats.failed_repos} ❌
- **Empty**: ${stats.empty_repos} ⚠️

- **Total Plugins Fetched**: ${stats.total_plugins_fetched}
- **Unique Plugins**: ${stats.unique_plugins}
- **Duplicates Removed**: ${stats.duplicates_removed}

- **Errors**: ${stats.errors}
- **Warnings**: ${stats.warnings}

## Repository Status

${logs.repos.map(r => {
  const icon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⚠️';
  return `${icon} **${r.url}**\n   - Status: ${r.status}\n   - Plugins: ${r.pluginsFound}${r.error ? `\n   - Error: ${r.error}` : ''}`;
}).join('\n\n')}

${logs.errors.length > 0 ? `
## Errors (${logs.errors.length})

${logs.errors.slice(0, 10).map((e, i) => `### ${i + 1}. ${e.message}
\`\`\`
${JSON.stringify(e, null, 2)}
\`\`\`
`).join('\n')}

${logs.errors.length > 10 ? `\n*... and ${logs.errors.length - 10} more errors. Check errors.json for full details.*` : ''}
` : ''}

${logs.warnings.length > 0 ? `
## Warnings (${logs.warnings.length})

${logs.warnings.slice(0, 10).map((w, i) => `- ${w.message}`).join('\n')}

${logs.warnings.length > 10 ? `\n*... and ${logs.warnings.length - 10} more warnings.*` : ''}
` : ''}
`;

    fs.writeFileSync('REPORT.md', report);
    fs.writeFileSync('errors.json', JSON.stringify(logs.errors, null, 2));
    
    log('info', 'All files written successfully');
    
    // Exit with error code if too many repos failed
    if (stats.failed_repos > stats.total_repos * 0.3) {
      log('errors', 'More than 30% of repos failed - this indicates a serious problem');
      process.exit(1);
    }
    
  } catch (error) {
    log('errors', 'Failed to write output files', { error: error.message });
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
