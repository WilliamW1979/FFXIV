import requests
import os
import json

def read_repo_urls(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return [line.strip() for line in file if line.strip() and not line.strip().startswith('#')]
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []

repo_urls = read_repo_urls('RepoList.txt')
os.makedirs("downloaded_repos", exist_ok=True)
all_plugins = []

def process_repo(url):
    try:
        print(f"Processing {url}...")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            all_plugins.extend(data)
            print(f"Found {len(data)} plugins in list from {url}")
        elif isinstance(data, dict):
            plugins = data.get('plugins') or data.get('Plugins')
            if isinstance(plugins, list):
                all_plugins.extend(plugins)
                print(f"Found {len(plugins)} plugins in dictionary from {url}")
            else:
                print(f"Warning: 'plugins' key not a list in {url}")
        else:
            print(f"Warning: Unexpected JSON format from {url}")
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error for {url}: {e}")
    except requests.exceptions.RequestException as e:
        print(f"Request error for {url}: {e}")
    except json.JSONDecodeError:
        print(f"Invalid JSON from {url}")

for url in repo_urls:
    process_repo(url)

print(f"Total plugins found before deduplication: {len(all_plugins)}")
unique_plugins = {p.get('Name'): p for p in all_plugins if p.get('Name')}.values()

with open("repository.json", "w", encoding="utf-8") as f:
    json.dump(list(unique_plugins), f, ensure_ascii=False, indent=4)

print("Merged plugins saved to repository.json")
