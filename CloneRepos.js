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
    } else if (url.includes('github.com')) {
      // Handle GitHub raw content URLs
      const baseUrl = url.trim().endsWith('/') ? url.trim() : `${url.trim()}/`;
      const jsonUrl = `${baseUrl}raw/main/repojson`; // Adjust as needed
      const response = await axios.get(jsonUrl);
      return response.data;
    } else if (url.includes('puni.sh')) {
      // Handle puni.sh API endpoints
      const response = await axios.get(url);
      return response.data;
    } else if (url.includes('plugins.carvel.li')) {
      // Handle carvel.li HTML pages
      const response = await axios.get(url);
      // Parse HTML to extract JSON data if necessary
      // Implement HTML parsing logic here
      return parsedData;
    } else {
      // Default case for other URLs
      const baseUrl = url.trim().endsWith('/') ? url.trim() : `${url.trim()}/`;
      const jsonUrl = `${baseUrl}pluginmaster.json`;
      const response = await axios.get(jsonUrl);
      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching data from ${url}: ${error.response ? error.response.status : error.message}`);
    return null; // Return null to indicate an error
  }
}

async function mergeData() {
  let mergedData = [];

  for (const url of repoList) {
    const data = await fetchData(url);

    if (data) {
      if (Array.isArray(data)) {
        mergedData = mergedData.concat(data);
      } else if (data.items && Array.isArray(data.items)) {
        mergedData = mergedData.concat(data.items);
      } else if (data.plugins && Array.isArray(data.plugins)) {
        mergedData = mergedData.concat(data.plugins);
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

mergeData();
