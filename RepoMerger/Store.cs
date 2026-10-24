using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
namespace RepoMerger;
internal sealed record QuarantineEntry(string Url, DateTime FirstFailedUtc, string Reason, DateTime LastCheckedUtc);
internal sealed record HealthEntry(string Url, DateTime FirstFailedUtc, string Reason);
internal sealed record ValidatorEntry(string Url, Validator Validator, DateTime FetchedUtc);
internal sealed record SubmissionEntry(DateTime TimeUtc, string User, string Outcome, string Url);
internal static class Store
{
    public const string RepoListFile = "RepoList.txt";
    public const string QuarantineFile = "Quarantine.txt";
    public const string HealthFile = "Health.txt";
    public const string BlocklistFile = "Blocklist.txt";
    public const string ValidatorsFile = "Validators.txt";
    public const string SubmissionsFile = "Submissions.txt";
    public const string OutputFile = "repository.json";
    public const string CacheDirectory = "cache";
    public static List<string> ReadRepoList() => ReadLines(RepoListFile).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    public static List<string> ReadBlocklist() => ReadLines(BlocklistFile);
    public static void WriteRepoList(IEnumerable<string> Urls) => File.WriteAllLines(RepoListFile, Urls);
    public static void AddRepo(string Url) => WriteRepoList(ReadRepoList().Append(Url));
    public static List<QuarantineEntry> ReadQuarantine() => ReadRows(QuarantineFile, 4).Select(r => new QuarantineEntry(r[0], ParseTime(r[1], QuarantineFile), r[2], ParseTime(r[3], QuarantineFile))).ToList();
    public static void WriteQuarantine(IEnumerable<QuarantineEntry> Entries) => File.WriteAllLines(QuarantineFile, Entries.Select(e => string.Join('\t', e.Url, FormatTime(e.FirstFailedUtc), OneLine(e.Reason), FormatTime(e.LastCheckedUtc))));
    public static List<HealthEntry> ReadHealth() => ReadRows(HealthFile, 3).Select(r => new HealthEntry(r[0], ParseTime(r[1], HealthFile), r[2])).ToList();
    public static void WriteHealth(IEnumerable<HealthEntry> Entries) => File.WriteAllLines(HealthFile, Entries.Select(e => string.Join('\t', e.Url, FormatTime(e.FirstFailedUtc), OneLine(e.Reason))));
    public static void WriteValidators(IEnumerable<ValidatorEntry> Entries) => File.WriteAllLines(ValidatorsFile, Entries.Select(e => string.Join('\t', e.Url, e.Validator.ETag ?? "", e.Validator.LastModified ?? "", FormatTime(e.FetchedUtc))));
    public static List<SubmissionEntry> ReadSubmissions() => ReadRows(SubmissionsFile, 4).Select(r => new SubmissionEntry(ParseTime(r[0], SubmissionsFile), r[1], r[2], r[3])).ToList();
    public static void AppendSubmission(SubmissionEntry Entry) => File.AppendAllLines(SubmissionsFile, new[] { string.Join('\t', FormatTime(Entry.TimeUtc), Entry.User, Entry.Outcome, OneLine(Entry.Url)) });
    public static string CachePath(string Url) => Path.Combine(CacheDirectory, Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Url)))[..16].ToLowerInvariant() + ".json");
    private static string OneLine(string Value) => Sanitizer.Clean(Value, 300);
    private static string FormatTime(DateTime Time) => Time.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
    private static List<string> ReadLines(string Path) => File.Exists(Path) ? File.ReadAllLines(Path).Select(l => l.Trim()).Where(l => l.Length > 0).ToList() : new List<string>();
    private static DateTime ParseTime(string Text, string File) => DateTime.TryParse(Text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out DateTime time) ? time.ToUniversalTime() : throw new InvalidDataException($"{File} contains an invalid date: {Text}");

    public static List<ValidatorEntry> ReadValidators()
    {
        try
        {
            return ReadRows(ValidatorsFile, 4).Select(r => new ValidatorEntry(r[0], new Validator(r[1].Length == 0 ? null : r[1], r[2].Length == 0 ? null : r[2]), ParseTime(r[3], ValidatorsFile))).ToList();
        }
        catch (InvalidDataException ex)
        {
            Log.Warn($"Ignoring unreadable {ValidatorsFile}, every repository will be fetched in full: {ex.Message}");
            return [];
        }
    }

    private static List<string[]> ReadRows(string Path, int Columns)
    {
        List<string[]> rows = [];
        if (!File.Exists(Path)) return rows;
        string[] lines = File.ReadAllLines(Path);
        for (int i = 0; i < lines.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i])) continue;
            string[] parts = lines[i].Split('\t');
            if (parts.Length != Columns) throw new InvalidDataException($"{Path} line {i + 1} has {parts.Length} columns, expected {Columns}");
            rows.Add(parts);
        }
        return rows;
    }

    public static void SaveCache(string Url, List<JsonObject> Items)
    {
        Directory.CreateDirectory(CacheDirectory);
        JsonArray array = new();
        foreach (JsonObject item in Items) array.Add(item.DeepClone());
        File.WriteAllText(CachePath(Url), JsonOutput.Serialize(array));
    }

    public static List<JsonObject>? LoadCache(string Url)
    {
        string path = CachePath(Url);
        if (!File.Exists(path)) return null;
        try
        {
            return JsonNode.Parse(File.ReadAllText(path)) is JsonArray array ? array.OfType<JsonObject>().Select(o => (JsonObject)o.DeepClone()).ToList() : null;
        }
        catch (JsonException ex)
        {
            Log.Warn($"Ignoring unreadable cache file {path}: {ex.Message}");
            return null;
        }
    }

    public static void PruneCache(IEnumerable<string> KeepUrls)
    {
        if (!Directory.Exists(CacheDirectory)) return;
        HashSet<string> keep = KeepUrls.Select(u => Path.GetFullPath(CachePath(u))).ToHashSet();
        foreach (string file in Directory.GetFiles(CacheDirectory, "*.json"))
            if (!keep.Contains(Path.GetFullPath(file))) File.Delete(file);
    }
}