const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Read the list of repositories
const repoList = fs.readFileSync('RepoList.txt', 'utf-8').split('\n').filter(url => url.trim());

async function fetchData(url) {
  try {
    // Check if the URL ends with '.json'
    if (url.trim().endsWith('.json')) {
      const response = await axios.get(url);
      return response.data;
    } else {
      // Attempt to fetch 'pluginmaster.json' from the repository's base URL
      const baseUrl = url.trim().endsWith('/') ? url.trim() : `${url.trim()}/`;
      const jsonUrl = `${baseUrl}pluginmaster.json`;
      const response = await axios.get(jsonUrl);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error.message);
    return [];
  }
}

async function mergeData() {
  let mergedData = [];

  for (const url of repoList) {
    const data = await fetchData(url);

    if (Array.isArray(data)) {
      mergedData = mergedData.concat(data);
    } else if (data && Array.isArray(data.items)) {
      mergedData = mergedData.concat(data.items);
    } else if (data && Array.isArray(data.plugins)) {
      mergedData = mergedData.concat(data.plugins);
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

mergeData();
