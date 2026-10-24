using System.Text.Json.Nodes;
namespace RepoMerger;
internal static class PluginTools
{
    public static string? GetString(JsonObject Plugin, string Name) => Plugin[Name] is JsonValue value && value.TryGetValue<string>(out string? text) ? text : null;
    public static bool HasField(JsonObject Plugin, string Name) => !string.IsNullOrWhiteSpace(GetString(Plugin, Name));
    private static bool HasDownload(JsonObject Plugin) => HasField(Plugin, "DownloadLinkInstall") || HasField(Plugin, "DownloadLinkUpdate");
    private static List<JsonObject> ToObjects(JsonArray Array) => Array.OfType<JsonObject>().Select(o => (JsonObject)o.DeepClone()).ToList();
    private static int[] ParseParts(string Version) => Version.Split('.').Select(LeadingInt).ToArray();

    public static List<JsonObject>? Extract(JsonNode Data)
    {
        if (Data is JsonArray array) return ToObjects(array);
        if (Data is not JsonObject root) return null;
        if (root["items"] is JsonArray items) return ToObjects(items);
        if (root["plugins"] is JsonArray plugins) return ToObjects(plugins);
        if (root["plugins"] is JsonObject single) return new List<JsonObject> { (JsonObject)single.DeepClone() };
        if (root["InternalName"] is not null) return new List<JsonObject> { (JsonObject)root.DeepClone() };
        return null;
    }

    public static bool IsValid(JsonObject Plugin)
    {
        string[] missing = new[] { "InternalName", "Name" }.Where(f => !HasField(Plugin, f)).ToArray();
        if (missing.Length == 0) return true;
        Log.Warn($"Plugin missing required fields: {GetString(Plugin, "InternalName") ?? "unknown"} ({string.Join(", ", missing)})");
        return false;
    }

    public static void Normalize(JsonObject Plugin, string SourceUrl)
    {
        string? author = GetString(Plugin, "Author")?.Trim();
        Plugin["Author"] = string.IsNullOrEmpty(author) ? "Unknown" : author;
        Plugin["RepoUrl"] = HasField(Plugin, "RepoUrl") ? GetString(Plugin, "RepoUrl") : SourceUrl;
        Plugin["SourceRepo"] = SourceUrl;
    }

    private static int LeadingInt(string Part)
    {
        string text = Part.Trim();
        int length = 0;
        while (length < text.Length && char.IsAsciiDigit(text[length])) length++;
        return length > 0 && int.TryParse(text[..length], out int number) ? number : 0;
    }

    public static int CompareVersions(string First, string Second)
    {
        int[] a = ParseParts(First);
        int[] b = ParseParts(Second);
        for (int i = 0; i < Math.Max(a.Length, b.Length); i++)
        {
            int left = i < a.Length ? a[i] : 0;
            int right = i < b.Length ? b[i] : 0;
            if (left != right) return left > right ? 1 : -1;
        }
        return 0;
    }

    private static int CompareCandidates(JsonObject First, JsonObject Second)
    {
        bool firstHas = HasDownload(First);
        bool secondHas = HasDownload(Second);
        if (firstHas != secondHas) return secondHas ? 1 : -1;
        string? firstVersion = GetString(First, "AssemblyVersion");
        string? secondVersion = GetString(Second, "AssemblyVersion");
        if (!string.IsNullOrEmpty(firstVersion) && !string.IsNullOrEmpty(secondVersion)) return CompareVersions(secondVersion, firstVersion);
        return 0;
    }

    public static List<JsonObject> Deduplicate(List<JsonObject> All)
    {
        List<JsonObject> result = [];
        foreach (IGrouping<string, JsonObject> group in All.GroupBy(p => GetString(p, "InternalName") ?? ""))
        {
            List<JsonObject> versions = group.ToList();
            if (versions.Count == 1)
            {
                result.Add(versions[0]);
                continue;
            }
            Log.Info($"Found {versions.Count} versions of {group.Key}");
            List<JsonObject> sorted = versions.OrderBy(p => p, Comparer<JsonObject>.Create(CompareCandidates)).ToList();
            JsonArray alternates = new();
            foreach (string source in sorted.Skip(1).Select(p => GetString(p, "SourceRepo")).OfType<string>().Distinct()) alternates.Add(source);
            sorted[0]["AlternateSources"] = alternates;
            result.Add(sorted[0]);
        }
        return result;
    }
}
