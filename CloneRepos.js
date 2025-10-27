const axios = require('axios');
const fs = require('fs');
const path = require('path');

const troubledRepo = 'https://plugins.carvel.li/';

const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url.length > 0);

// Track errors and stats
const errors = [];
const stats = {
  repos_processed: 0,
  repos_failed: 0,
  plugins_fetched: 0,
  unique_plugins: 0,
  duplicates_removed: 0,
  timestamp: new Date().toISOString()
};

function logError(message, context = {}) {
  errors.push({
    message,
    context,
    timestamp: new Date().toISOString()
  });
}

async function fetchData(url) {
  try {
    if (url === troubledRepo) {
      const configResponse = await axios.get('https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json');
      const pluginList = configResponse.data.Plugins;

      if (!pluginList || pluginList.length === 0) {
        return [];
      }

      const plugins = [];

      for (const { Name: pluginName } of pluginList) {
        try {
          const releaseApi = `https://git.carvel.li/api/v1/repos/liza/${encodeURIComponent(pluginName)}/releases/latest`;
          const releaseResponse = await axios.get(releaseApi);
          const assets = releaseResponse.data.assets || [];

          let jsonUrl = '', zipUrl = '';

          for (const asset of assets) {
            const assetNameLower = asset.name.toLowerCase();

            if (assetNameLower.includes('json')) {
              jsonUrl = asset.browser_download_url;
            } else if (assetNameLower.endsWith('.zip')) {
              zipUrl = asset.browser_download_url;
            }
          }

          if (jsonUrl && zipUrl) {
            const pluginMetaResponse = await axios.get(jsonUrl);
            const pluginMeta = pluginMetaResponse.data;
            pluginMeta.DownloadLinkInstall = zipUrl;
            pluginMeta.DownloadLinkUpdate = zipUrl;
            pluginMeta.DownloadLinkTesting = zipUrl;
            if (!pluginMeta.Author || pluginMeta.Author.trim() === '') {
              pluginMeta.Author = 'Unknown';
            }
            if (!pluginMeta.RepoUrl) {
              pluginMeta.RepoUrl = url;
            }
            pluginMeta.SourceRepo = url;

            plugins.push(pluginMeta);
          }
        } catch (err) {
          logError(`Error processing plugin ${pluginName}`, {
            plugin: pluginName,
            repo: url,
            error: err.message
          });
        }
      }

      return plugins;
    } else {
      const response = await axios.get(url);
      return response.data;
    }
  } catch (error) {
    logError(`Error fetching data from repo`, {
      repo: url,
      error: error.message,
      status: error.response?.status
    });
    return null;
  }
}

async function fetchFallbackData(repoName) {
  const fallbackUrls = [
    `https://puni.sh/api/repository/${repoName}`,
    `https://love.puni.sh/ment.json`
  ];

  for (const fallbackUrl of fallbackUrls) {
    try {
      const response = await axios.get(fallbackUrl);
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      logError(`Error fetching fallback data`, {
        fallback_url: fallbackUrl,
        original_repo: repoName,
        error: error.message
      });
    }
  }

  return null;
}

async function mergeData() {
  let mergedData = [];

  for (const url of repoList) {
    stats.repos_processed++;
    let data = await fetchData(url);

    if (!data) {
      const repoName = url.split('/').pop();
      data = await fetchFallbackData(repoName);
    }

    if (data) {
      let plugins = [];

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
        logError('Unrecognized data structure', { repo: url });
        stats.repos_failed++;
        continue;
      }

      for (const plugin of plugins) {
        if (url === troubledRepo) plugin.DalamudApiLevel = 12;
        if (!plugin.Author || plugin.Author.trim() === '') plugin.Author = 'Unknown';
        
        if (!plugin.RepoUrl) {
          plugin.RepoUrl = url;
        }
        
        plugin.SourceRepo = url;
        
        mergedData.push(plugin);
      }
    } else {
      stats.repos_failed++;
    }
  }

  stats.plugins_fetched = mergedData.length;

  // Group plugins by InternalName to identify duplicates
  const pluginGroups = {};
  
  for (const plugin of mergedData) {
    const key = plugin.InternalName;
    if (!pluginGroups[key]) {
      pluginGroups[key] = [];
    }
    pluginGroups[key].push(plugin);
  }

  const uniquePlugins = [];
  
  for (const [internalName, plugins] of Object.entries(pluginGroups)) {
    if (plugins.length === 1) {
      // Only one version exists, keep it as-is
      uniquePlugins.push(plugins[0]);
    } else {
      // Multiple versions exist - keep the one with highest version or most recent
      const sortedPlugins = plugins.sort((a, b) => {
        if (a.AssemblyVersion && b.AssemblyVersion) {
          return compareVersions(b.AssemblyVersion, a.AssemblyVersion);
        }
        return 0;
      });
      
      const bestPlugin = sortedPlugins[0];
      
      bestPlugin.AlternateSources = plugins
        .filter(p => p.SourceRepo !== bestPlugin.SourceRepo)
        .map(p => p.SourceRepo);
      
      uniquePlugins.push(bestPlugin);
    }
  }

  stats.unique_plugins = uniquePlugins.length;
  stats.duplicates_removed = mergedData.length - uniquePlugins.length;

  if (uniquePlugins.length > 0) {
    const filePath = path.resolve('repository.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(uniquePlugins, null, 2));
      
      // Write stats file
      fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));
      
      // Write error log if there are errors
      if (errors.length > 0) {
        fs.writeFileSync('errors.json', JSON.stringify(errors, null, 2));
        
        // Also create a readable error summary
        const errorSummary = `# Error Log
Last Updated: ${stats.timestamp}

Total Errors: ${errors.length}

## Errors by Type

${errors.map((err, i) => `### Error ${i + 1}
- **Message**: ${err.message}
- **Time**: ${err.timestamp}
- **Details**: ${JSON.stringify(err.context, null, 2)}
`).join('\n')}
`;
        fs.writeFileSync('ERROR_LOG.md', errorSummary);
      }
      
      // Create a readable stats file
      const statsMarkdown = `# Repository Statistics
Last Updated: ${stats.timestamp}

## Summary
- **Unique Plugins**: ${stats.unique_plugins}
- **Total Plugins Fetched**: ${stats.plugins_fetched}
- **Duplicates Removed**: ${stats.duplicates_removed}
- **Repositories Processed**: ${stats.repos_processed}
- **Repositories Failed**: ${stats.repos_failed}
- **Errors Encountered**: ${errors.length}

${stats.repos_failed > 0 ? '⚠️ Some repositories failed to load. Check ERROR_LOG.md for details.' : '✅ All repositories loaded successfully!'}
`;
      fs.writeFileSync('STATS.md', statsMarkdown);
      
    } catch (err) {
      logError('Error writing output files', {
        error: err.message
      });
      // This is critical - we still want to know about it
      throw err;
    }
  }
}

// Helper function to compare version strings (e.g., "1.2.3" vs "1.2.4")
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

mergeData();
