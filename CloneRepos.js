const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Define the repository you're troubleshooting
const troubledRepo = 'https://plugins.carvel.li/';

// Read the list of repositories from 'RepoList.txt'
const repoList = fs.readFileSync('RepoList.txt', 'utf-8')
  .split('\n')
  .map(url => url.trim())
  .filter(url => url === troubledRepo); // Only include the troubled repo

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
          console.log(`\nProcessing plugin: ${pluginName}`);
          const releasesPageUrl = `https://git.carvel.li/liza/${encodeURIComponent(pluginName)}/releases`;
          console.log(`Releases page URL: ${releasesPageUrl}`);

          // Fetch the releases page HTML
          const releasesPageResponse = await axios.get(releasesPageUrl);
          console.log(`Fetched releases page for ${pluginName}.`);

          // Parse the HTML to extract download links
          const $ = cheerio.load(releasesPageResponse.data);
          const downloadLinks = [];

          $('a').each((index, element) => {
            const href = $(element).attr('href');
            if (href && href.includes(`/liza/${pluginName}/releases/download/`)) {
              const fullUrl = `https://git.carvel.li${href}`;
              downloadLinks.push(fullUrl);
              console.log(`Found download link: ${fullUrl}`);
            }
          });

          // Identify JSON and ZIP files from the download links
          let jsonUrl = '';
          let zipUrl = '';

          for (const link of downloadLinks) {
            const linkLower = link.toLowerCase();
            if (linkLower.includes('json') && !jsonUrl) {
              jsonUrl = link;
              console.log(`Identified JSON asset: ${link}`);
            } else if (linkLower.endsWith('.zip') && !zipUrl) {
              zipUrl = link;
              console.log(`Identified ZIP asset: ${link}`);
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
