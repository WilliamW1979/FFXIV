import os
import json
import urllib.request
from urllib.error import HTTPError, URLError

def read_repo_urls(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return [line.strip() for line in file if line.strip() and not line.strip().startswith('#')]
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []

repo_urls = read_repo_urls('RepoList.txt')

download_dir = "downloaded_repos"
os.makedirs(download_dir, exist_ok=True)

all_plugins = []

def process_repo(url):
    try:
        print(f"Processing {url}...")
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                if isinstance(data, list):
                    count = len(data)
                    print(f"Found {count} plugins in raw list from {url}")
                    all_plugins.extend(data)
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
        print(f"Warning: {e.code} for {url}" if e.code == 404 else f"HTTP error from {url}: {e}")
    except URLError as e:
        print(f"URL error from {url}: {e}")
    except Exception as e:
        print(f"Unhandled error from {url}: {e}")

for url in repo_urls:
    process_repo(url)

print(f"Total plugins found before deduplication: {len(all_plugins)}")

unique_plugins = {plugin.get('Name'): plugin for plugin in all_plugins if plugin.get('Name')}.values()

output_file = "repository.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(list(unique_plugins), f, ensure_ascii=False, indent=4)

print(f"Merged plugins have been saved to {output_file}")
