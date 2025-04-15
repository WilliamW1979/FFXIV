const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Define the repository you're troubleshooting
const troubledRepo = 'https://plugins.carvel.li/';

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())

async function fetchData(url) {
  try {
    console.log(`Fetching data from: ${url}`);

    if (url === 'https://plugins.carvel.li/') {
      console.log('Fetching Carvel plugin list...');
      const configResponse = await axios.get('https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json');
      console.log('Received config response.');

      const pluginList = configResponse.data.Plugins;

      if (!pluginList || pluginList.length === 0) {
        console.warn('No plugins found in the Carvel config.');
        return [];
      }

      const plugins = [];

      for (const { Name: pluginName } of pluginList) {
        try {
          console.log(`Fetching latest release for plugin: ${pluginName}`);
          const releaseApi = `https://git.carvel.li/api/v1/repos/liza/${encodeURIComponent(pluginName)}/releases/latest`;
          console.log(`Release API URL: ${releaseApi}`);

          const releaseResponse = await axios.get(releaseApi);
          console.log(`Received release response for ${pluginName}.`);

          const assets = releaseResponse.data.assets || [];

          if (!assets || assets.length === 0) {
            console.warn(`No assets found for plugin: ${pluginName}`);
            continue;
          }

          let jsonUrl = '', zipUrl = '';

          for (const asset of assets) {
            console.log(`Processing asset: ${JSON.stringify(asset)}`);
            const assetNameLower = asset.name.toLowerCase();

            if (assetNameLower.includes('json')) {
              jsonUrl = asset.browser_download_url;
              console.log(`Identified JSON asset: ${asset.name}`);
            } else if (assetNameLower.endsWith('.zip')) {
              zipUrl = asset.browser_download_url;
              console.log(`Identified ZIP asset: ${asset.name}`);
            }
          }

          if (jsonUrl && zipUrl) {
            console.log(`Fetching metadata from: ${jsonUrl}`);
            const pluginMetaResponse = await axios.get(jsonUrl);
            console.log(`Received plugin metadata for ${pluginName}.`);

            const pluginMeta = pluginMetaResponse.data;
            pluginMeta.DownloadLinkInstall = zipUrl;
            pluginMeta.DownloadLinkUpdate = zipUrl;
            pluginMeta.DownloadLinkTesting = zipUrl;
            pluginMeta.DalamudApiLevel = 12;
            if (!pluginMeta.Author || pluginMeta.Author.trim() === '') {
              pluginMeta.Author = 'Unknown';
            }

            plugins.push(pluginMeta);
          } else {
            console.warn(`Missing JSON or ZIP asset URLs for plugin: ${pluginName}`);
          }
        } catch (err) {
          console.error(`Error processing plugin ${pluginName}: ${err.message}`);
        }
      }

      return plugins;
    } else {
      console.log(`Fetching data from: ${url}`);
      const baseUrl = url.endsWith('/') ? url : `${url}/`;
      const jsonUrl = `${baseUrl}pluginmaster.json`;
      console.log(`JSON URL: ${jsonUrl}`);

      const response = await axios.get(jsonUrl);
      console.log(`Received JSON response.`);

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
      console.log(`Attempting fallback fetch from: ${fallbackUrl}`);
      const response = await axios.get(fallbackUrl);
      console.log(`Received fallback response from ${fallbackUrl}.`);

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
      const repoName = url.split('/').pop();
      console.log(`Primary data fetch failed for ${repoName}, attempting fallback.`);
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
      }

      for (const plugin of plugins) {
        if (url === 'https://plugins.carvel.li/') plugin.DalamudApiLevel = 12;
        if (!plugin.Author || plugin.Author.trim() === '') plugin.Author = 'Unknown';
        mergedData.push(plugin);
      }
    }
  }

  // Remove duplicates based on InternalName
  const uniquePlugins = mergedData.filter((plugin, index, self) =>
    index === self.findIndex((p) => p.InternalName === plugin.InternalName)
  );

  if (uniquePlugins.length > 0) {
    const filePath = path.resolve('repository.json');
    try {
      console.log(`Writing merged data to: ${filePath}`);
      fs.writeFileSync(filePath, JSON.stringify(uniquePlugins, null, 2));
      console.log('Merged data written to repository.json successfully.');
    } catch (err) {
      console.error('Error writing to repository.json:', err.message);
    }
  } else {
    console.log('No valid data to write to repository.json.');
  }
}
mergeData();
