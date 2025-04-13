import os
import json
import urllib.request

# Function to read URLs from a text file
def read_repo_urls(file_path):
    try:
        with open(file_path, 'r') as file:
            urls = file.read().splitlines()
        return [url for url in urls if url]  # Remove any empty lines
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []

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
            data = json.load(response)
            if isinstance(data, list):
                all_plugins.extend(data)
            else:
                print(f"Warning: Data from {url} is not a list.")
    except Exception as e:
        print(f"Error processing {url}: {e}")

# Read repository URLs from RepoList.txt
repo_urls = read_repo_urls("RepoList.txt")

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
