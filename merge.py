import requests
import json

# List of plugin manifest URLs
manifest_urls = [
    "https://love.puni.sh/ment.json",
    "https://github.com/daemitus/MyDalamudPlugins/raw/master/pluginmaster.json",
    "https://raw.githubusercontent.com/Aida-Enna/XIVPlugins/main/repo.json",
    # Add more URLs as needed
]

merged_plugins = []

for url in manifest_urls:
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        plugins = data.get("Plugins", [])
        merged_plugins.extend(plugins)
    except Exception as e:
        print(f"Error fetching {url}: {e}")

with open("repo.json", "w", encoding="utf-8") as f:
    json.dump({"Plugins": merged_plugins}, f, ensure_ascii=False, indent=2)
