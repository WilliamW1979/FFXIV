const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Function to fetch the latest release manifest from GitHub
async function fetchLatestManifest(owner, repo, assetExtension) {
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const response = await axios.get(apiUrl, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });

    const assets = response.data.assets;
    const manifestAsset = assets.find(asset => asset.name.endsWith(assetExtension));

    if (!manifestAsset) {
      throw new Error(`No asset ending with '${assetExtension}' found in the latest release.`);
    }

    const manifestResponse = await axios.get(manifestAsset.browser_download_url);
    return manifestResponse.data;
  } catch (error) {
    console.error(`Error fetching manifest for ${owner}/${repo}: ${error.message}`);
    return null;
  }
}

// Function to merge plugin data into repository.json
async function mergeData() {
  const plugins = [];

  // Example: Fetching the 'Questionable' plugin manifest
  const owner = 'liza';
  const repo = 'Questionable';
  const assetExtension = '.json.d12';

  const pluginData = await fetchLatestManifest(owner, repo, assetExtension);
  if (pluginData) {
    plugins.push(pluginData);
  }

  // Write the merged data to repository.json
  const filePath = path.resolve('repository.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify(plugins, null, 2));
    console.log('Merged data written to repository.json successfully.');
  } catch (err) {
    console.error('Error writing to repository.json:', err.message);
  }
}

// Execute the merge process
mergeData();
