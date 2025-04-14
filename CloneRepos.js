const fs = require('fs');
const axios = require('axios');

// Read the RepoList.txt file which contains the list of JSON URLs
fs.readFile('RepoList.txt', 'utf8', async (err, data) => {
  if (err) {
    console.error('Error reading RepoList.txt:', err);
    return;
  }

  // Split the file content by new lines to get the individual URLs
  const urls = data.split('\n').map(url => url.trim()).filter(url => url.length > 0);
  
  let combinedJson = [];

  // Fetch and process each URL
  for (const url of urls) {
    try {
      console.log(`Fetching data from: ${url}`);
      const response = await axios.get(url);

      // Assuming the response is JSON, merge it with the combinedJson array
      if (response.data) {
        combinedJson = [...combinedJson, ...response.data];
      } else {
        console.warn(`No valid JSON data found at: ${url}`);
      }
    } catch (err) {
      console.error(`Error fetching data from ${url}:`, err);
    }
  }

  // Write the combined JSON data to Repository.json
  try {
    fs.writeFileSync('Repository.json', JSON.stringify(combinedJson, null, 2));
    console.log('Repository.json has been updated with combined data.');
  } catch (err) {
    console.error('Error writing Repository.json:', err);
  }
});
