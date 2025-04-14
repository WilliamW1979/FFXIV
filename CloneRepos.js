const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url);

async function fetchData(url) {
  try {
    console.log(`Fetching data from: ${url}`);

    if (url === 'https://plugins.carvel.li/') {
      console.log('Fetching Carvel plugin list...');
      const configResponse = await axios.get('https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json');
      const pluginList = configResponse.data.Plugins;

      if (!pluginList || pluginList.length === 0) {
        console.warn('No plugins found in the Carvel config.');
        return [];
      }

      const plugins = [];

      for (const { Name: pluginName } of pluginList) {
        try {
          console.log(`Fetching latest release for plugin: ${pluginName}`);
          const releaseApi = `https://git.carvel.li/api/v4/projects/liza%2F${encodeURIComponent(pluginName)}/releases`;
          const releasesResponse = await axios.get(releaseApi);
          const latest = releasesResponse.data[0];

          if (!latest || !latest.assets || !latest.assets.links) {
            console.warn(`No valid assets for plugin: ${pluginName}`);
            continue;
          }

          let jsonUrl = '', zipUrl = '';

          for (const asset of latest.assets.links) {
            if (asset.name.endsWith('.json')) jsonUrl = asset.url;
            else if (asset.name.endsWith('.zip')) zipUrl = asset.url;
          }

          if (!jsonUrl || !zipUrl) {
            console.warn(`Missing required assets for plugin: ${pluginName}`);
            continue;
          }

          console.log(`Fetching metadata from: ${jsonUrl}`);
          const pluginMetaResponse = await axios.get(jsonUrl);
          const pluginMeta = pluginMetaResponse.data;

          pluginMeta.DownloadLinkInstall = zipUrl;
          pluginMeta.DownloadLinkUpdate = zipUrl;
          pluginMeta.DownloadLinkTesting = zipUrl;
          pluginMeta.DalamudApiLevel = 12;
          if (!pluginMeta.Author || pluginMeta.Author.trim() === '') pluginMeta.Author = 'Unknown';

          plugins.push(pluginMeta);
        } catch (err) {
          console.error(`Error processing plugin ${pluginName}: ${err.message}`);
        }
      }

      return plugins;
    } else {
      console.log(`Fetching data from: ${url}`);
      const baseUrl = url.endsWith('/') ? url : `${url}/`;
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
      console.log(`Attempting fallback fetch from: ${fallbackUrl}`);
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

  if (mergedData.length > 0) {
    const filePath = path.resolve('repository.json');
    try {
      console.log(`Writing merged data to: ${filePath}`);
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
      console.log('Merged data written to repository.json successfully.');
    } catch (err) {
      console.error('Error writing to repository.json:', err.message);
    }
  } else {
    console.log('No valid data to write to repository.json.');
  }
}

// Run the data merge
mergeData();
