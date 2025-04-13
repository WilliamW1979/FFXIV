import os
import json
import urllib.request
from urllib.error import HTTPError, URLError

# Function to read repository URLs from RepoList.txt
def read_repo_urls(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            # Ignore empty lines and lines that start with a comment character (#)
            return [line.strip() for line in file if line.strip() and not line.strip().startswith('#')]
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []

# Read repository URLs from RepoList.txt
repo_urls = read_repo_urls('RepoList.txt')

# Create a directory to save the downloaded files if needed
download_dir = "downloaded_repos"
os.makedirs(download_dir, exist_ok=True)

# List to store all plugin entries
all_plugins = []

# Function to fetch and process JSON from each repository URL
def process_repo(url):
    try:
        print(f"Processing {url}...")
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                # Decode bytes to string and load JSON
                data = json.loads(response.read().decode('utf-8'))
                # If the data is already a list, assume it's a list of plugins
                if isinstance(data, list):
                    count = len(data)
                    print(f"Found {count} plugins in list from {url}")
                    all_plugins.extend(data)
                # If data is a dictionary, try both 'plugins' and 'Plugins' keys
                elif isinstance(data, dict):
                    plugins = data.get('plugins') or data.get('Plugins') or []
                    if isinstance(plugins, list):
                        count = len(plugins)
                        print(f"Found {count} plugins in dictionary from {url}")
                        all_plugins.extend(plugins)
                    else:
                        print(f"Warning: The 'plugins' key in {url} is not a list.")
                else:
                    print(f"Warning: Data from {url} is neither a list nor a dictionary.")
            else:
                print(f"Warning: Received status code {response.status} for {url}")
    except HTTPError as e:
        if e.code == 404:
            print(f"Warning: 404 Not Found for {url}")
        else:
            print(f"HTTP error occurred while fetching {url}: {e}")
    except URLError as e:
        print(f"URL error occurred while fetching {url}: {e}")
    except Exception as e:
        print(f"Error processing {url}: {e}")

# Process each repository URL
for url in repo_urls:
    process_repo(url)

print(f"Total plugins found before deduplication: {len(all_plugins)}")

# Remove duplicates based on the 'Name' field
unique_plugins = {plugin.get('Name'): plugin for plugin in all_plugins if plugin.get('Name')}.values()

# Save the merged plugins to a JSON file
output_file = "repository.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(list(unique_plugins), f, ensure_ascii=False, indent=4)

print(f"Merged plugins have been saved to {output_file}")
