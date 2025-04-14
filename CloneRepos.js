const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8').split('\n').filter(url => url.trim());

async function fetchData(url) {
  try {
    if (url.trim().endsWith('.json')) {
      const response = await axios.get(url);
      return response.data;
    } else if (url === 'https://plugins.carvel.li/') {
      // Fetch the plugin configuration
      const configUrl = 'https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json';
      const configResponse = await axios.get(configUrl);
      const pluginList = configResponse.data.plugins || [];

      const plugins = [];

      for (const plugin of pluginList) {
        const repoName = plugin.repo;
        const apiUrl = `https://git.carvel.li/api/v1/repos/liza/${repoName}/releases/latest`;

        try {
          const releaseResponse = await axios.get(apiUrl);
          const release = releaseResponse.data;

          // Construct the plugin metadata
          const pluginData = {
            Author: plugin.author || 'Unknown',
            Name: plugin.name || repoName,
            Punchline: plugin.punchline || '',
            Description: plugin.description || '',
            Tags: plugin.tags || [],
            CategoryTags: plugin.categoryTags || [],
            InternalName: plugin.internalName || repoName,
            AssemblyVersion: release.tag_name || '0.0.0',
            DalamudApiLevel: 12, // Explicitly set the API level
            RepoUrl: `https://git.carvel.li/liza/${repoName}`,
            DownloadLinkInstall: release.assets?.[0]?.browser_download_url || '',
            DownloadLinkTesting: release.assets?.[0]?.browser_download_url || '',
            DownloadLinkUpdate: release.assets?.[0]?.browser_download_url || '',
            ApplicableVersion: 'any',
            IconUrl: plugin.icon || ''
          };

          plugins.push(pluginData);
        } catch (releaseError) {
          console.error(`Error fetching release data for ${repoName}: ${releaseError.message}`);
        }
      }

      return plugins;
    } else {
      const baseUrl = url.trim().endsWith('/') ? url.trim() : `${url.trim()}/`;
      const jsonUrl = `${baseUrl}pluginmaster.json`;
      const response = await axios.get(jsonUrl);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching data from ${url}: ${error.message}`);
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
        console.log(`Successfully fetched data from fallback URL: ${fallbackUrl}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching data from fallback URL ${fallbackUrl}: ${error.message}`);
    }
  }

  return null;
}

async function mergeData() {
  let mergedData = [];

  for (const url of repoList) {
    let data = await fetchData(url);

    if (!data) {
      const repoName = url.trim().split('/').pop();
      console.log(`Primary data fetch failed for ${repoName}, attempting fallback.`);
      data = await fetchFallbackData(repoName);
    }

    if (data) {
      if (Array.isArray(data)) {
        mergedData = mergedData.concat(data);
      } else if (data.items && Array.isArray(data.items)) {
        mergedData = mergedData.concat(data.items);
      } else if (data.plugins && Array.isArray(data.plugins)) {
        mergedData = mergedData.concat(data.plugins);
      }
    }
  }

  if (mergedData.length > 0) {
    const filePath = path.resolve('repository.json');

    try {
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
      console.log('Merged data written to repository.json successfully.');
    } catch (err) {
      console.error('Error writing to repository.json:', err.message);
    }
  } else {
    console.log('No valid data to write to repository.json.');
  }
}

mergeData();
