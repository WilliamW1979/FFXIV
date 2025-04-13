const fs = require('fs');
const https = require('https');
const path = require('path');

// Function to fetch JSON content from a URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      // Accumulate data chunks
      res.on('data', (chunk) => {
        data += chunk;
      });

      // On end, parse JSON
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(`Error parsing JSON from ${url}: ${err}`);
        }
      });
    }).on('error', (err) => {
      reject(`Error fetching ${url}: ${err}`);
    });
  });
}

// Main function to read URLs and combine JSON files
async function combineJsonFiles() {
  try {
    const repoListPath = path.join(__dirname, 'RepoList.txt');

    // Read the RepoList.txt file
    const urls = fs.readFileSync(repoListPath, 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const combinedData = [];

    for (const url of urls) {
      try {
        const jsonData = await fetchJson(url);

        // If the fetched JSON is an array, concatenate it
        if (Array.isArray(jsonData)) {
          combinedData.push(...jsonData);
        } else {
          combinedData.push(jsonData);
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Write the combined JSON array to a file
    const outputPath = path.join(__dirname, 'combined.json');
    fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2));
    console.log(`Combined JSON written to ${outputPath}`);
  } catch (err) {
    console.error(`Error: ${err}`);
  }
}

// Execute the main function
combineJsonFiles();
