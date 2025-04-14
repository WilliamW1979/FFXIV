const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url);

// Function to fetch data from a given URL
async function fetchData(url) {
  try {
    if (url === 'https://plugins.carvel.li/') {
      // Fetch the configuration file listing all plugins
      const configResponse = await axios.get('https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json');
      const pluginList = configResponse.data.Plugins;

      if (!pluginList || pluginList.length === 0) {
        console.warn('No plugins found in the Carvel config.');
        return [];
      }

      const plugins = [];

      for (const pluginEntry of pluginList) {
        const pluginName = pluginEntry.Name;
        const releasesUrl = `https://git.carvel.li/liza/${pluginName}/-/releases`;

        try {
          // Fetch the releases page
          const releasesPage = await axios.get(releasesUrl);
          const $ = cheerio.load(releasesPage.data);

          // Find the latest release section
          const latestRelease = $('.release').first();

          if (!latestRelease || latestRelease.length === 0) {
            console.warn(`No releases found for plugin: ${pluginName}`);
            continue;
          }

          // Extract links to the JSON and ZIP files
          const assetLinks = latestRelease.find('.release-assets a');
          let jsonLink = '';
          let zipLink = '';

          assetLinks.each((i, elem) => {
            const href = $(elem).attr('href');
            if (href.endsWith('.json')) {
              jsonLink = `https://git.carvel.li${href}`;
            } else if (href.endsWith('.zip')) {
              zipLink = `https://git.carvel.li${href}`;
            }
          });

          if (!jsonLink || !zipLink) {
            console.warn(`Missing assets for plugin: ${pluginName}`);
            continue;
          }

          // Fetch the plugin's JSON metadata
          const pluginMetaResponse = await axios.get(jsonLink);
          const pluginMeta = pluginMetaResponse.data;

          // Add download links to the plugin metadata
          pluginMeta.DownloadLinkInstall = zipLink;
          pluginMeta.DownloadLinkUpdate = zipLink;
          pluginMeta.DownloadLinkTesting = zipLink;

          // Ensure DalamudApiLevel is set to 12
          pluginMeta.DalamudApiLevel = 12;

          // Ensure Author is not missing
          if (!pluginMeta.Author || pluginMeta.Author.trim() === '') {
            pluginMeta.Author = 'Unknown';
          }

          // Add the processed plugin to the list
          plugins.push(pluginMeta);
        } catch (error) {
          console.error(`Error processing plugin ${pluginName}: ${error.message}`);
          continue;
        }
      }

      return plugins;
    } else {
      // Default case for other URLs
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
