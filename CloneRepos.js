const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

  // Log the merged data before writing to the file
  console.log('Merged Data:', mergedData);

  // Check if mergedData is valid and contains items
  if (mergedData.length > 0) {
    const filePath = path.resolve('Repository.json'); // Ensure absolute path to the file
    console.log(`Writing merged data to: ${filePath}`); // Log the full path being used
    
    try {
      // Log the JSON data being written to ensure correctness
      console.log('Data to be written:', JSON.stringify(mergedData, null, 2));

      // Write the merged data to Repository.json
      fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
      console.log('Merged data written to Repository.json successfully.');
    } catch (err) {
      console.error('Error writing to Repository.json:', err.message);
    }
  } else {
    console.log('No valid data to write to Repository.json.');
  }
}

mergeData();
