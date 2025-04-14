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
      // Fetch the list of plugins from _config.json
      const configUrl = 'https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json';
      const configResponse = await axios.get(configUrl);
      const pluginNames = configResponse.data.plugins;
      const plugins = [];

      for (const pluginName of pluginNames) {
        try {
          // Construct the base URL for the plugin
          const basePluginUrl = `https://git.carvel.li/liza/${pluginName}`;

          // Fetch the latest release page
          const releasesUrl = `${basePluginUrl}/-/releases`;
          const releasesResponse = await axios.get(releasesUrl);
          const $ = cheerio.load(releasesResponse.data);

          // Find the latest release section
          const latestRelease = $('.release').first();

          // Extract the JSON and ZIP file links
          const jsonLink = latestRelease.find('a').filter((i, el) => $(el).text().endsWith('.json')).attr('href');
          const zipLink = latestRelease.find('a').filter((i, el) => $(el).text().endsWith('.zip')).attr('href');

          if (!jsonLink || !zipLink) {
            console.warn(`Missing JSON or ZIP link for plugin: ${pluginName}`);
            continue;
          }

          // Fetch the plugin JSON metadata
          const pluginJsonUrl = `https://git.carvel.li${jsonLink}`;
          const pluginJsonResponse = await axios.get(pluginJsonUrl);
          const pluginData = pluginJsonResponse.data;

          // Add the download links
          const downloadLink = `https://git.carvel.li${zipLink}`;
          pluginData.DownloadLinkInstall = downloadLink;
          pluginData.DownloadLinkTesting = downloadLink;
          pluginData.DownloadLinkUpdate = downloadLink;

          // Ensure DalamudApiLevel is set to 12
          pluginData.DalamudApiLevel = 12;

          // Add the processed plugin to the list
          plugins.push(pluginData);
        } catch (pluginError) {
          console.error(`Error processing plugin ${pluginName}: ${pluginError.message}`);
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
