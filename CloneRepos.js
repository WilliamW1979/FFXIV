const axios = require('axios');
const fs = require('fs');
const path = require('path');

const troubledRepo = 'https://plugins.carvel.li/';

const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url.length > 0);

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
            pluginMeta.DalamudApiLevel = 12;
            if (!pluginMeta.Author || pluginMeta.Author.trim() === '') {
              pluginMeta.Author = 'Unknown';
            }

            plugins.push(pluginMeta);
          }
        } catch (err) {
          console.error(`Error processing plugin ${pluginName}: ${err.message}`);
        }
      }

      return plugins;
    } else {
      const response = await axios.get(url);
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
        continue;
      }

      for (const plugin of plugins) {
        if (url === troubledRepo) plugin.DalamudApiLevel = 12;
        if (!plugin.Author || plugin.Author.trim() === '') plugin.Author = 'Unknown';
        mergedData.push(plugin);
      }
    }
  }

  const uniquePlugins = mergedData.filter((plugin, index, self) =>
    index === self.findIndex((p) => p.InternalName === plugin.InternalName)
  );

  if (uniquePlugins.length > 0) {
    const filePath = path.resolve('repository.json');
    try {
      fs.writeFileSync(filePath, JSON.stringify(uniquePlugins, null, 2));
    } catch (err) {
      console.error('Error writing to repository.json:', err.message);
    }
  }
}

mergeData();
