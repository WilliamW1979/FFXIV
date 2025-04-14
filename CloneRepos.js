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
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchData(url) {
  try {
    if (url === 'https://plugins.carvel.li/') {
      // Step 1: Fetch the list of plugins from _config.json
      const configUrl = 'https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json';
      const configResponse = await axios.get(configUrl);
      const pluginNames = configResponse.data.plugins; // Assuming the JSON has a "plugins" array

      const plugins = [];

      for (const pluginName of pluginNames) {
        try {
          // Step 2: Fetch the latest release page for the plugin
          const releasesUrl = `https://git.carvel.li/liza/${pluginName}/releases`;
          const releasesResponse = await axios.get(releasesUrl);
          const $ = cheerio.load(releasesResponse.data);

          // Step 3: Find the latest release section
          const latestReleaseSection = $('.release').first();

          // Step 4: Find the JSON and ZIP asset links
          let jsonUrl = '';
          let zipUrl = '';

          latestReleaseSection.find('a').each((i, element) => {
            const href = $(element).attr('href');
            if (href.endsWith('.json')) {
              jsonUrl = `https://git.carvel.li${href}`;
            } else if (href.endsWith('.zip')) {
              zipUrl = `https://git.carvel.li${href}`;
            }
          });

          if (!jsonUrl || !zipUrl) {
            console.error(`Could not find JSON or ZIP asset for plugin: ${pluginName}`);
            continue;
          }

          // Step 5: Fetch the plugin's JSON metadata
          const jsonResponse = await axios.get(jsonUrl);
          const pluginData = jsonResponse.data;

          // Step 6: Add the download links to the plugin data
          pluginData.DownloadLinkInstall = zipUrl;
          pluginData.DownloadLinkUpdate = zipUrl;
          pluginData.DownloadLinkTesting = zipUrl;

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
