const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Path to the RepoList.txt file
const repoListPath = path.join(__dirname, 'RepoList.txt');

// Function to read the repo list
function readRepoList() {
    return new Promise((resolve, reject) => {
        fs.readFile(repoListPath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                // Split the content into an array of repository URLs
                resolve(data.split('\n').map(line => line.trim()).filter(line => line !== ''));
            }
        });
    });
}

// Function to clone each repository from the list
function cloneRepos(repos) {
    repos.forEach((repo, index) => {
        console.log(`Cloning repo ${index + 1}: ${repo}`);
        
        // Run the git clone command
        exec(`git clone ${repo}`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error cloning repo ${repo}: ${err.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
            }
            console.log(`stdout: ${stdout}`);
        });
    });
}

// Main function to run the script
async function main() {
    try {
        const repos = await readRepoList();
        if (repos.length === 0) {
            console.log('No repositories found in RepoList.txt.');
        } else {
            cloneRepos(repos);
        }
    } catch (err) {
        console.error('Error reading RepoList.txt:', err.message);
    }
}

// Execute the main function
main();
