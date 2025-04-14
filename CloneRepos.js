const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url);

async function fetchData(url) {
  try {
    if (url === 'https://plugins.carvel.li/') {
      console.log('Fetching plugin list from Carvel repository...');
      const configUrl = 'https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json';
      const configResponse = await axios.get(configUrl);
      const pluginList = configResponse.data.plugins;

      if (!pluginList || pluginList.length === 0) {
        console.warn('No plugins found in _config.json.');
        return [];
      }

      console.log(`Found ${pluginList.length} plugins in _config.json.`);

      const plugins = [];

      for (const pluginName of pluginList) {
        try {
          const releaseUrl = `https://git.carvel.li/liza/${pluginName}/releases/latest`;
          console.log(`Fetching release page for plugin: ${pluginName}`);
          const releaseResponse = await axios.get(releaseUrl);
          const $ = cheerio.load(releaseResponse.data);

          const jsonLink = $('a[href$=".json"]').attr('href');
          const zipLink = $('a[href$=".zip"]').attr('href');

          if (!jsonLink || !zipLink) {
            console.warn(`Missing JSON or ZIP file for plugin: ${pluginName}`);
            continue;
          }

          const jsonUrl = new URL(jsonLink, releaseUrl).href;
          const zipUrl = new URL(zipLink, releaseUrl).href;

          console.log(`Fetching JSON manifest for plugin: ${pluginName}`);
          const jsonResponse = await axios.get(jsonUrl);
          const pluginData = jsonResponse.data;

          // Add download links
          pluginData.DownloadLinkInstall = zipUrl;
          pluginData.DownloadLinkTesting = zipUrl;
          pluginData.DownloadLinkUpdate = zipUrl;

          // Ensure required fields are present
          pluginData.Author = pluginData.Author || 'Liza Carvelli';
          pluginData.DalamudApiLevel = pluginData.DalamudApiLevel || 12;
          pluginData.RepoUrl = `https://git.carvel.li/liza/${pluginName}`;
          pluginData.IconUrl = pluginData.IconUrl || `https://plugins.carvel.li/icons/${pluginName}.png`;

          plugins.push(pluginData);
        } catch (pluginError) {
          console.error(`Error processing plugin ${pluginName}: ${pluginError.message}`);
        }
      }

      return plugins;
    } else {
      // Handle other URLs
      const baseUrl = url.endsWith('/') ? url : `${url}/`;
      const jsonUrl = `${baseUrl}pluginmaster.json`;
      console.log(`Fetching plugin data from: ${jsonUrl}`);
      const response = await axios.get(jsonUrl);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching data from ${url}: ${error.message}`);
    return null;
  }
}

// Function to fetch fallback data if primary fetch fails
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

// Main function to merge data from all repositories
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

      // Process each plugin entry
      for (const plugin of plugins) {
        // Ensure DalamudApiLevel is set to 12 for plugins from plugins.carvel.li
        if (url === 'https://plugins.carvel.li/') {
          plugin.DalamudApiLevel = 12;
        }

        // Ensure Author is not missing
        if (!plugin.Author || plugin.Author.trim() === '') {
          plugin.Author = 'Unknown';
        }

        // Add the processed plugin to the merged data
        mergedData.push(plugin);
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

// Execute the merge process
mergeData();
