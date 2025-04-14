const axios = require('axios');
const fs = require('fs');
const path = require('path');

// List of repository URLs
const repoList = [
  'https://plugins.carvel.li/',
  // Add other repository URLs as needed
];

// Function to fetch JSON data from a URL
async function fetchJson(url) {
  try {
    const response = await axios.get(url, { headers: { 'Accept': 'application/json' } });
    return response.data;
  } catch (error) {
    console.error(`Error fetching JSON from ${url}: ${error.message}`);
    return null;
  }
}

// Function to fetch text data from a URL
async function fetchText(url) {
  try {
    const response = await axios.get(url, { headers: { 'Accept': 'text/plain' } });
    return response.data;
  } catch (error) {
    console.error(`Error fetching text from ${url}: ${error.message}`);
    return null;
  }
}

// Function to process the plugins.carvel.li repository
async function processCarvelRepo() {
  const baseRepoUrl = 'https://git.carvel.li/liza/plugin-repo';
  const rawBaseUrl = 'https://git.carvel.li/api/v1/repos/liza/plugin-repo/raw';
  const configUrl = `${rawBaseUrl}/_config.json?ref=master`;

  const configData = await fetchJson(configUrl);
  if (!configData || !configData.plugins) {
    console.error('Failed to fetch or parse _config.json from plugins.carvel.li');
    return [];
  }

  const plugins = [];

  for (const plugin of configData.plugins) {
    const pluginName = plugin.name;
    const pluginRepo = plugin.repo;

    // Fetch the list of releases for the plugin
    const releasesUrl = `https://git.carvel.li/api/v1/repos/liza/${pluginRepo}/releases`;
    const releases = await fetchJson(releasesUrl);
    if (!releases || releases.length === 0) {
      console.warn(`No releases found for plugin ${pluginName}`);
      continue;
    }

    // Get the latest release
    const latestRelease = releases[0];
    const releaseTag = latestRelease.tag_name;

    // Fetch the list of assets for the latest release
    const assetsUrl = `https://git.carvel.li/api/v1/repos/liza/${pluginRepo}/releases/${releaseTag}/assets`;
    const assets = await fetchJson(assetsUrl);
    if (!assets || assets.length === 0) {
      console.warn(`No assets found for plugin ${pluginName} release ${releaseTag}`);
      continue;
    }

    // Find the asset that contains the plugin manifest (ends with .json)
    const manifestAsset = assets.find(asset => asset.name.endsWith('.json'));
    if (!manifestAsset) {
      console.warn(`No manifest (.json) asset found for plugin ${pluginName} release ${releaseTag}`);
      continue;
    }

    // Fetch the manifest content
    const manifestUrl = manifestAsset.browser_download_url;
    const manifest = await fetchJson(manifestUrl);
    if (!manifest) {
      console.warn(`Failed to fetch manifest for plugin ${pluginName}`);
      continue;
    }

    plugins.push(manifest);
  }

  return plugins;
}

// Function to process other repositories (placeholder)
async function processOtherRepo(url) {
  // Implement processing for other repositories as needed
  console.warn(`Processing for repository ${url} is not implemented.`);
  return [];
}

// Main function to process all repositories
async function processRepositories() {
  const allPlugins = [];

  for (const repoUrl of repoList) {
    if (repoUrl === 'https://plugins.carvel.li/') {
      const carvelPlugins = await processCarvelRepo();
      allPlugins.push(...carvelPlugins);
    } else {
      const otherPlugins = await processOtherRepo(repoUrl);
      allPlugins.push(...otherPlugins);
    }
  }

  // Write the consolidated repository.json
  const outputPath = path.resolve(__dirname, 'repository.json');
  try {
    fs.writeFileSync(outputPath, JSON.stringify(allPlugins, null, 2));
    console.log(`Successfully wrote ${allPlugins.length} plugins to repository.json`);
  } catch (error) {
    console.error(`Error writing to repository.json: ${error.message}`);
  }
}

// Execute the script
processRepositories();
