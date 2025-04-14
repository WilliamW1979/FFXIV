const fs = require("fs")
const https = require("https")
const path = require("path")
const pluginDir = "plugin_repos"

if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir)

const pluginUrls = [
  "https://raw.githubusercontent.com/kalildev/PluginHosting/main/pluginmaster.json",
  "https://raw.githubusercontent.com/Caraxi/DalamudPluginRepo/master/repo.json",
  "https://raw.githubusercontent.com/unknownskl/xivplugins/main/pluginmaster.json",
  "https://raw.githubusercontent.com/Critical-Impact/TestingRepo/master/pluginmaster.json",
  "https://raw.githubusercontent.com/Bluefissure/FFXIV_ACT_Plugin/master/OverlayPlugin/OverlayPlugin.Common/Resources/pluginmaster.json",
  "https://raw.githubusercontent.com/UnknownX7/NoClippy/master/repo.json",
  "https://raw.githubusercontent.com/daemitus/MyDalamudPlugins/main/pluginmaster.json",
  "https://raw.githubusercontent.com/NightmareXIV/MyDalamudPlugins/main/pluginmaster.json",
  "https://raw.githubusercontent.com/Sebane1/DalamudPluginRepo/main/pluginmaster.json",
  "https://raw.githubusercontent.com/LeonBlade/DalamudPlugins/main/repo.json",
  "https://raw.githubusercontent.com/nyaami/NyaamiPluginRepo/main/Repository.json",
  "https://raw.githubusercontent.com/Aireil/PluginDist/main/Repository.json",
  "https://raw.githubusercontent.com/HawtSticks/FFXIV-PluginRepo/main/pluginmaster.json",
  "https://raw.githubusercontent.com/Athiee/MyDalamudPlugins/main/plugin_repository.json",
  "https://raw.githubusercontent.com/KazWolfe/ffxiv-PluginRepo/main/pluginmaster.json",
  "https://raw.githubusercontent.com/ryon5541/dalamud-repo-up/main/ffxiv_custom_repojson",
  "https://raw.githubusercontent.com/AtmoOmen/FFXIVDalamudPlugins/main/repo.json",
  "https://raw.githubusercontent.com/AsteriskAmpersand/ffxiv-repo-index/main/repo.json",
  "https://raw.githubusercontent.com/Sebane1/DalamudPlugins/main/ffxiv.json"
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`))
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on("finish", () => file.close(resolve))
    }).on("error", reject)
  })
}

(async () => {
  for (let i = 0; i < pluginUrls.length; i++) {
    const url = pluginUrls[i]
    const filename = String(i).padStart(2, "0") + "_" + path.basename(url)
    const filePath = path.join(pluginDir, filename)
    try {
      await downloadFile(url, filePath)
      console.log(`Downloaded ${filename}`)
    } catch (err) {
      console.warn(`Failed to download ${url}: ${err.message}`)
    }
  }

  let Repository_json = []
  const files = fs.readdirSync(pluginDir)

  for (const file of files) {
    const filePath = path.join(pluginDir, file)
    try {
      const content = fs.readFileSync(filePath, "utf8")
      const parsed = JSON.parse(content)
      const type = typeof parsed
      if (type === "object") {
        Repository_json.push(parsed)
        console.log(`Processed: ${file}`)
      } else {
        console.log(`Skipping ${file}: root is not a valid object or array`)
      }
    } catch (err) {
      console.log(`Skipping ${file}: invalid JSON (${err.message})`)
    }
  }

  fs.writeFileSync("Repository.json", JSON.stringify(Repository_json, null, 2))
  console.log("Repository.json written")
})()
