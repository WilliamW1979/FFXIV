import os
import json
import urllib.request

# Read repository URLs from RepoList.txt
repo_urls = []
with open('RepoList.txt', 'r') as file:
    repo_urls = [line.strip() for line in file.readlines()]

# Directory to save the downloaded JSON files
download_dir = "downloaded_repos"
os.makedirs(download_dir, exist_ok=True)

# List to store all plugins
all_plugins = []

# Function to fetch and process each repository JSON
def process_repo(url):
    try:
        print(f"Processing {url}...")
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                data = json.load(response)
                if isinstance(data, list):
                    all_plugins.extend(data)
                elif isinstance(data, dict):
                    plugins = data.get('plugins', [])
                    all_plugins.extend(plugins)
                else:
                    print(f"Warning: Data from {url} is neither a list nor a dictionary.")
            else:
                print(f"Warning: Received status code {response.status} for {url}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Warning: 404 Not Found for {url}")
        else:
            print(f"HTTP error occurred: {e}")
    except Exception as e:
        print(f"Error processing {url}: {e}")

# Process each repository
for url in repo_urls:
    process_repo(url)

# Remove duplicates based on the 'Name' field
unique_plugins = {plugin['Name']: plugin for plugin in all_plugins}.values()

# Save the merged plugins to a JSON file
output_file = "repository.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(list(unique_plugins), f, ensure_ascii=False, indent=4)

print(f"Merged plugins have been saved to {output_file}")
