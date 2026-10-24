using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
namespace RepoMerger;
internal static class Submission
{
    public const string ResultFile = "submission-result.txt";
    private const string UrlCharacters = @"^[A-Za-z0-9\-._~:/?#@!$&()*+,;=%]+$";
    private const string UserPattern = @"^[A-Za-z0-9-]{1,39}$";
    private const string NumberPattern = @"^[0-9]{1,10}$";
    private const string NamePattern = @"^[A-Za-z0-9._-]{1,64}$";
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromSeconds(1);
    private static bool Matches(string Value, string Pattern) => Regex.IsMatch(Value, Pattern, RegexOptions.CultureInvariant, RegexTimeout);
    private static string Normalize(string Url) => Url.Trim().TrimEnd('/');

    private static string? ExtractUrl(string Body)
    {
        string[] lines = Body.Replace("\r", "").Split('\n');
        int heading = Array.FindIndex(lines, l => l.Trim().StartsWith("### Repository URL", StringComparison.OrdinalIgnoreCase));
        string? candidate = heading < 0 ? null : lines.Skip(heading + 1).Select(l => l.Trim()).FirstOrDefault(l => l.Length > 0);
        return candidate is null || candidate.StartsWith('#') ? null : candidate;
    }


    private static bool IsHttpUrl(string? Link) => Uri.TryCreate(Link, UriKind.Absolute, out Uri? uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);

    private static string? CheckUrl(string Url)
    {
        if (Url.Length == 0) return "No repository URL was found in the issue.";
        if (Url.Length > Settings.MaxUrlLength) return $"The URL is longer than {Settings.MaxUrlLength} characters.";
        if (!Matches(Url, UrlCharacters)) return "The URL contains characters that are not allowed.";
        if (!Uri.TryCreate(Url, UriKind.Absolute, out Uri? uri) || uri.Scheme != Uri.UriSchemeHttps) return "The URL must be a valid https:// address.";
        if (uri.UserInfo.Length > 0 || !uri.IsDefaultPort) return "The URL must not contain credentials or a custom port.";
        if (uri.HostNameType != UriHostNameType.Dns || !uri.Host.Contains('.') || uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase)) return "The URL must use a public domain name, not an IP address or an internal host.";
        if (Store.ReadBlocklist().Any(b => Url.Contains(b, StringComparison.OrdinalIgnoreCase))) return "This URL is on the blocklist.";
        string normalized = Normalize(Url);
        if (Store.ReadRepoList().Any(u => string.Equals(Normalize(u), normalized, StringComparison.OrdinalIgnoreCase))) return "This repository is already included.";
        if (Store.ReadQuarantine().Any(q => string.Equals(Normalize(q.Url), normalized, StringComparison.OrdinalIgnoreCase))) return "This repository is already known but is currently failing its checks. It will be restored automatically once it reads cleanly again.";
        return null;
    }

    private static List<string> CheckPlugins(List<JsonObject> Items)
    {
        List<string> problems = [];
        foreach (JsonObject plugin in Items)
        {
            string? name = PluginTools.GetString(plugin, "InternalName");
            string label = Sanitizer.Clean(name ?? PluginTools.GetString(plugin, "Name") ?? "unnamed plugin", 64);
            if (string.IsNullOrWhiteSpace(name) || !PluginTools.HasField(plugin, "Name"))
            {
                problems.Add($"{label}: InternalName and Name are required");
                continue;
            }
            if (!Matches(name, NamePattern))
            {
                problems.Add($"{label}: InternalName may only contain letters, digits, dots, dashes and underscores");
                continue;
            }
            if (PluginTools.HasField(plugin, "RepoUrl") && !IsHttpUrl(PluginTools.GetString(plugin, "RepoUrl"))) problems.Add($"{label}: RepoUrl must be a valid http:// or https:// link");
        }
        return problems;
    }

    private static async Task<(string? Reason, int Count)> EvaluateAsync(string Url, string User)
    {
        int recent = Store.ReadSubmissions().Count(s => s.Outcome == "REJECTED" && string.Equals(s.User, User, StringComparison.OrdinalIgnoreCase) && DateTime.UtcNow - s.TimeUtc < Settings.RateWindow);
        if (recent >= Settings.MaxRejectionsPerWindow) return ($"You have had {Settings.MaxRejectionsPerWindow} rejected submissions in the last {Settings.RateWindow.TotalHours:0} hours. Please try again later.", 0);
        string? urlProblem = CheckUrl(Url);
        if (urlProblem is not null) return (urlProblem, 0);
        RepoRead read = await RepoReader.ReadAsync(Url, Settings.SubmissionRetries);
        if (read.Error is not null) return ($"The repository could not be read: {read.Error}", 0);
        if (read.Plugins.Count == 0) return ("The repository was read successfully but contains no plugins.", 0);
        List<string> problems = CheckPlugins(read.Plugins);
        if (problems.Count > 0) return ($"Problems found: {string.Join("; ", problems.Take(5))}{(problems.Count > 5 ? $" (and {problems.Count - 5} more)" : "")}", 0);
        return (null, read.Plugins.Count);
    }

    public static async Task<int> RunAsync()
    {
        string body = Environment.GetEnvironmentVariable("ISSUE_BODY") ?? "";
        string user = Environment.GetEnvironmentVariable("SUBMITTER") ?? "";
        string number = Environment.GetEnvironmentVariable("ISSUE_NUMBER") ?? "";
        if (!Matches(user, UserPattern) || !Matches(number, NumberPattern)) throw new InvalidOperationException("SUBMITTER or ISSUE_NUMBER is missing or malformed");
        string url = ExtractUrl(body) ?? "";
        (string? reason, int count) = await EvaluateAsync(url, user);
        Store.AppendSubmission(new SubmissionEntry(DateTime.UtcNow, user, reason is null ? "ACCEPTED" : "REJECTED", Sanitizer.Clean(url, Settings.MaxUrlLength)));
        if (reason is not null)
        {
            Log.Info($"Rejected submission from {user}: {reason}");
            File.WriteAllText("commit-message.txt", $"Log rejected submission from issue #{number}\n");
            File.WriteAllText(ResultFile, $"REJECTED\n{Sanitizer.Clean(reason, 600)}\n");
            return 0;
        }
        Store.AddRepo(url);
        MergeSummary summary = await Merger.RunAsync($"➕ Add repository from issue #{number} ({count} plugins)");
        Log.Info($"Accepted submission from {user}: {count} plugins, merge exit code {summary.ExitCode}");
        File.WriteAllText(ResultFile, $"ACCEPTED\nThanks! The repository was added with {count} plugin(s) and is already live in the merged repository.\n");
        return 0;
    }
}
