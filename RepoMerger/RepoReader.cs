using System.Text.Json.Nodes;
namespace RepoMerger;
internal readonly record struct RepoRead(List<JsonObject> Plugins, string? Error, bool NotModified, Validator Validator)
{
    public static RepoRead Failed(string Error) => new([], Error, false, default);
    public static RepoRead Loaded(List<JsonObject> Plugins, Validator Validator) => new(Plugins, null, false, Validator);
    public static RepoRead Unchanged() => new([], null, true, default);
}
internal static class RepoReader
{
    public static Task<RepoRead> ReadAsync(string Url, int Retries, Validator Known = default) => Url == Settings.CarvelUrl ? ReadCarvelAsync(Url, Retries) : ReadStandardAsync(Url, Retries, Known);

    private static async Task<RepoRead> ReadStandardAsync(string Url, int Retries, Validator Known)
    {
        JsonFetchResult fetched = await WebFetch.FetchJsonAsync(Url, Retries, Known);
        if (fetched.NotModified) return RepoRead.Unchanged();
        if (fetched.Node is null) return RepoRead.Failed(fetched.Error ?? "no data returned");
        List<JsonObject>? plugins = PluginTools.Extract(fetched.Node);
        return plugins is null ? RepoRead.Failed("unrecognized JSON structure") : RepoRead.Loaded(plugins, fetched.Validator);
    }

    private static async Task<RepoRead> ReadCarvelAsync(string Url, int Retries)
    {
        Log.Info("Processing carvel.li with special handler");
        JsonFetchResult config = await WebFetch.FetchJsonAsync(Settings.CarvelConfigUrl, Retries);
        if (config.Node is not JsonObject root || root["Plugins"] is not JsonArray entries) return RepoRead.Failed(config.Error ?? "carvel config has no plugins");
        List<JsonObject> plugins = [];
        foreach (JsonObject entry in entries.OfType<JsonObject>())
        {
            string? name = PluginTools.GetString(entry, "Name");
            if (string.IsNullOrEmpty(name)) continue;
            JsonFetchResult release = await WebFetch.FetchJsonAsync($"https://git.carvel.li/api/v1/repos/liza/{Uri.EscapeDataString(name)}/releases/latest", Retries);
            if (release.Node is not JsonObject releaseRoot || releaseRoot["assets"] is not JsonArray assets)
            {
                Log.Warn($"No release assets found for carvel plugin {name}");
                continue;
            }
            JsonObject? jsonAsset = assets.OfType<JsonObject>().FirstOrDefault(a => (PluginTools.GetString(a, "name") ?? "").Contains("json", StringComparison.OrdinalIgnoreCase));
            JsonObject? zipAsset = assets.OfType<JsonObject>().FirstOrDefault(a => (PluginTools.GetString(a, "name") ?? "").EndsWith(".zip", StringComparison.OrdinalIgnoreCase));
            string? jsonUrl = jsonAsset is null ? null : PluginTools.GetString(jsonAsset, "browser_download_url");
            string? zipUrl = zipAsset is null ? null : PluginTools.GetString(zipAsset, "browser_download_url");
            if (string.IsNullOrEmpty(jsonUrl) || string.IsNullOrEmpty(zipUrl))
            {
                Log.Warn($"Missing required assets for carvel plugin {name}");
                continue;
            }
            JsonFetchResult meta = await WebFetch.FetchJsonAsync(jsonUrl, Retries);
            if (meta.Node is not JsonObject plugin)
            {
                Log.Warn($"Could not read metadata for carvel plugin {name}: {meta.Error ?? "unexpected structure"}");
                continue;
            }
            plugin["DownloadLinkInstall"] = zipUrl;
            plugin["DownloadLinkUpdate"] = zipUrl;
            plugin["DownloadLinkTesting"] = zipUrl;
            plugin["DalamudApiLevel"] = Settings.DalamudApiLevel;
            plugins.Add(plugin);
        }
        Log.Info($"Loaded {plugins.Count} plugins from carvel");
        return plugins.Count == 0 ? RepoRead.Failed("no plugins could be loaded from carvel") : RepoRead.Loaded(plugins, default);
    }
}