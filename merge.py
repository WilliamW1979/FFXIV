import os
import json
import requests

# List of repository URLs
repo_urls = [
    "https://love.puni.sh/ment.json",
    "https://github.com/daemitus/MyDalamudPlugins/raw/master/pluginmaster.json",
    "https://raw.githubusercontent.com/Aida-Enna/XIVPlugins/main/repo.json",
    "https://raw.githubusercontent.com/NightmareXIV/MyDalamudPlugins/main/pluginmaster.json",
    "https://raw.githubusercontent.com/InitialDet/MyDalamudPlugins/main/pluginmaster.json",
    "https://raw.githubusercontent.com/reckhou/DalamudPlugins-Ori/api6/pluginmaster.json",
    "https://raw.githubusercontent.com/LeonBlade/DalamudPlugins/main/repo.json",
    "https://raw.githubusercontent.com/Chalkos/Marketbuddy/main/repo.json",
    "https://raw.githubusercontent.com/UnknownX7/DalamudPluginRepo/master/pluginmaster.json",
    "https://github.com/LiangYuxuan/dalamud-plugin-cn-fetcher/raw/master/store/carvel/pluginmaster.json",
    "https://github.com/Haselnussbomber/MyDalamudPlugins/raw/main/repo.json",
    "https://puni.sh/api/repository/veyn",
    "https://plugins.carvel.li/",
    "https://puni.sh/api/repository/herc",
    "https://raw.githubusercontent.com/FFXIV-CombatReborn/CombatRebornRepo/main/pluginmaster.json",
    "https://puni.sh/api/repository/croizat",
    "https://raw.githubusercontent.com/KangasZ/DalamudPluginRepository/main/plugin_repository.json",
    "https://github.com/Athavar/Athavar.FFXIV.DalaRepo/raw/master/pluginmaster.json",
    "https://github.com/zhouhuichen741/dalamud-plugins/raw/master/repo.json",
    "https://github.com/ffxivcode/DalamudPlugins/raw/main/repojson",
    "https://github.com/UnknownX7/DalamudPluginRepo/raw/master/pluginmaster.json",
    "https://github.com/emyxiv/Dresser/raw/master/repo.json",
    "https://github.com/Milesnocte/GambaGames/raw/main/repo.json",
    "https://github.com/ryon5541/dalamud-repo-up/raw/main/ffxiv_custom_repojson",
    "https://github.com/Bluefissure/DalamudPlugins/raw/Bluefissure/pluginmaster.json",
    "https://github.com/huntsffxiv/repo/raw/main/repo.json",
    "https://github.com/GiR-Zippo/Hypnotoad-Plugin/raw/master/PluginDir/pluginmaster.json",
    "https://github.com/WilliamW1979/Repo/raw/main/ffxiv.json",
    "https://raw.githubusercontent.com/Haselnussbomber/MyDalamudPlugins/main/repo.json",
    "https://raw.githubusercontent.com/Ottermandias/Glamourer/main/repo.json"
]

# Directory to save the downloaded JSON files
download_dir = "downloaded_repos"
os.makedirs(download_dir, exist_ok=True)

# List to store all plugins
all_plugins = []

# Function to fetch and process each repository JSON
def process_repo(url):
    try:
        print(f"Processing {url}...")
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, list):
            all_plugins.extend(data)
        else:
            print(f"Warning: Data from {url} is not a list.")
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
    except ValueError as e:
        print(f"Error processing JSON from {url}: {e}")

# Process each repository
for url in repo_urls:
    process_repo(url)

# Save the merged plugins to a JSON file
output_file = "merged_plugins.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(all_plugins, f, ensure_ascii=False, indent=4)

print(f"Merged plugins have been saved to {output_file}")
