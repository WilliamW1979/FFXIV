const fs = require('fs');
const axios = require('axios');

// Read the list of URLs from the RepoList.txt file
fs.readFile('RepoList.txt', 'utf8', async (err, data) => {
    if (err) {
        console.error('Error reading RepoList.txt:', err);
        process.exit(1);
    }

    // Split the content of RepoList.txt into an array of URLs
    const urls = data.split('\n').filter(url => url.trim() !== '');

    // Initialize an empty array to hold the merged data
    let mergedData = [];

    console.log('Processing the following URLs:', urls);  // Debugging: Log URLs being processed

    // Process each URL asynchronously
    for (let url of urls) {
        try {
            console.log(`Fetching data from: ${url}`);  // Debugging: Log each URL being fetched
            const response = await axios.get(url.trim());

            // Check if the response contains JSON data
            if (response.data) {
                console.log(`Fetched ${response.data.length} items from ${url}`);  // Debugging: Log number of items fetched
                mergedData = mergedData.concat(response.data);  // Merge the data into the array
            } else {
                console.error(`No data found at ${url}`);
            }
        } catch (error) {
            console.error(`Error fetching data from ${url}:`, error.message);
        }
    }

    // After all URLs are processed, write the merged data into Repository.json
    if (mergedData.length > 0) {
        fs.writeFile('Repository.json', JSON.stringify(mergedData, null, 2), (err) => {
            if (err) {
                console.error('Error writing to Repository.json:', err);
            } else {
                console.log('Merged data written to Repository.json successfully.');
            }
        });
    } else {
        console.log('No data to write to Repository.json. Please check the fetched URLs.');
    }
});
