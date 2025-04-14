const axios = require('axios');
const fs = require('fs');

// Read the list of repositories
const repoList = fs.readFileSync('RepoList.txt', 'utf-8').split('\n').filter(url => url.trim());

async function fetchData(url) {
  try {
    const response = await axios.get(url);
    console.log(`Fetched data from: ${url}`);
    console.log('Fetched data:', response.data); // Log the fetched data
    return response.data; // Return the fetched data
  } catch (error) {
    console.error(`Error fetching data from ${url}: ${error.message}`);
    return []; // Return an empty array if there's an error
  }
}

async function mergeData() {
  let mergedData = [];

  for (const url of repoList) {
    console.log(`Fetching data from: ${url}`);
    const data = await fetchData(url);

    // If the data is an array, merge it; if it's an object with an array, extract and merge
    if (Array.isArray(data)) {
      mergedData = mergedData.concat(data);
    } else if (data && Array.isArray(data.items)) {
      mergedData = mergedData.concat(data.items); // If the data has an 'items' array
    } else {
      console.log(`Skipping URL (unexpected structure): ${url}`);
    }
  }

  // Write the merged data to Repository.json
  fs.writeFileSync('Repository.json', JSON.stringify(mergedData, null, 2));
  console.log('Merged data written to Repository.json successfully.');
}

mergeData();
