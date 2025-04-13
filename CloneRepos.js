const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const urls = [
    'https://love.puni.sh/ment.json',
    'https://github.com/daemitus/MyDalamudPlugins/raw/master/pluginmaster.json',
    'https://raw.githubusercontent.com/Aida-Enna/XIVPlugins/main/repo.json',
    'https://raw.githubusercontent.com/NightmareXIV/MyDalamudPlugins/main/pluginmaster.json',
    'https://raw.githubusercontent.com/InitialDet/MyDalamudPlugins/main/pluginmaster.json',
    'https://raw.githubusercontent.com/reckhou/DalamudPlugins-Ori/api6/pluginmaster.json',
    'https://raw.githubusercontent.com/LeonBlade/DalamudPlugins/main/repo.json',
    'https://raw.githubusercontent.com/Chalkos/Marketbuddy/main/repo.json',
    'https://raw.githubusercontent.com/UnknownX7/DalamudPluginRepo/master/pluginmaster.json',
    'https://github.com/LiangYuxuan/dalamud-plugin-cn-fetcher/raw/master/store/carvel/pluginmaster.json',
    'https://github.com/Haselnussbomber/MyDalamudPlugins/raw/main/repo.json',
    'https://puni.sh/api/repository/veyn',
    'https://plugins.carvel.li/',
    'https://puni.sh/api/repository/herc',
    'https://raw.githubusercontent.com/FFXIV-CombatReborn/CombatRebornRepo/main/pluginmaster.json',
    'https://puni.sh/api/repository/croizat',
    'https://raw.githubusercontent.com/KangasZ/DalamudPluginRepository/main/plugin_repository.json',
    'https://github.com/Athavar/Athavar.FFXIV.DalaRepo/raw/master/pluginmaster.json',
    'https://github.com/zhouhuichen741/dalamud-plugins/raw/master/repo.json',
    'https://github.com/ffxivcode/DalamudPlugins/raw/main/repojson',
    'https://github.com/UnknownX7/DalamudPluginRepo/raw/master/pluginmaster.json',
    'https://github.com/emyxiv/Dresser/raw/master/repo.json',
    'https://github.com/Milesnocte/GambaGames/raw/main/repo.json',
    'https://github.com/ryon5541/dalamud-repo-up/raw/main/ffxiv_custom_repojson',
    'https://github.com/Bluefissure/DalamudPlugins/raw/Bluefissure/pluginmaster.json',
    'https://github.com/huntsffxiv/repo/raw/main/repo.json',
    'https://github.com/GiR-Zippo/Hypnotoad-Plugin/raw/master/PluginDir/pluginmaster.json',
    'https://github.com/WilliamW1979/Repo/raw/main/ffxiv.json',
    'https://raw.githubusercontent.com/Haselnussbomber/MyDalamudPlugins/main/repo.json',
    'https://raw.githubusercontent.com/Ottermandias/Glamourer/main/repo.json'
];

if (!fs.existsSync('./repos')) fs.mkdirSync('./repos');

urls.forEach((url, index) => {
    const protocol = url.startsWith('https') ? https : http;
    const fileName = path.join('./repos', `repo_${index + 1}.json`);

    protocol.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`Failed to download ${url}: ${res.statusCode}`);
            res.resume();
            return;
        }

        const fileStream = fs.createWriteStream(fileName);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Downloaded: ${url} -> ${fileName}`);
        });
    }).on('error', (err) => {
        console.error(`Error downloading ${url}: ${err.message}`);
    });
});
