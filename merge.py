import requests
import json
import os

# List of plugin manifest URLs
manifest_urls = [
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

merged_plugins = []

for url in manifest_urls:
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        # Check if the data is a dictionary and contains the "Plugins" key
        if isinstance(data, dict) and "Plugins" in data:
            plugins = data["Plugins"]
        # Check if the data is a list
        elif isinstance(data, list):
            plugins = data
        else:
            print(f"Skipping {url}: Unexpected data format")
            continue

        merged_plugins.extend(plugins)

    except Exception as e:
        print(f"Error processing JSON from {url}: {e}")

# Ensure the repository.json file exists
if not os.path.exists("repository.json"):
    with open("repository.json", "w", encoding="utf-8") as f:
        json.dump({"Plugins": []}, f, ensure_ascii=False, indent=2)

# Write the merged plugins to repository.json
with open("repository.json", "w", encoding="utf-8") as f:
    json.dump({"Plugins": merged_plugins}, f, ensure_ascii=False, indent=2)
