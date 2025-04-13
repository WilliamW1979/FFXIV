const fs = require('fs');
const path = require('path');

// Function to read and parse a JSON file
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Remove surrounding brackets and parse JSON
    const jsonData = JSON.parse(data.replace(/^\[|\]$/g, ''));
    return jsonData;
  } catch (err) {
    console.error(`Error reading or parsing file ${filePath}:`, err);
    return [];
  }
}

// Function to merge multiple JSON files into one array
function mergeJsonFiles(directory) {
  const mergedData = [];
  const files = fs.readdirSync(directory);

  files.forEach(file => {
    const filePath = path.join(directory, file);
    if (fs.statSync(filePath).isFile() && filePath.endsWith('.json')) {
      const jsonData = readJsonFile(filePath);
      mergedData.push(...jsonData);
    }
  });

  return mergedData;
}

// Specify the directory containing your JSON files
const jsonDirectory = './jsonFiles';

// Merge the JSON files
const mergedJson = mergeJsonFiles(jsonDirectory);

// Output the merged JSON array
console.log(JSON.stringify(mergedJson, null, 2));
