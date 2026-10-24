using System.Text;
namespace RepoMerger;
internal static class Report
{
    private static string Icon(string Status) => Status switch { "success" => "✅", "restored" => "♻️", "failed" => "❌", _ => "🚫" };

    public static void Write(MergeSummary Summary, List<RepoStatus> Statuses, List<QuarantineEntry> NewQuarantine, string? CommitMessage)
    {
        int errors = Log.Errors.Count;
        int warnings = Log.Warnings.Count;
        File.WriteAllText("stats.txt", string.Join('\n', $"total_repos={Summary.Active}", $"successful_repos={Summary.Succeeded}", $"failed_repos={Summary.Failed}", $"quarantined_repos={Summary.Quarantined}", $"new_quarantined={Summary.NewQuarantined}", $"restored_repos={Summary.Restored}", $"total_plugins_fetched={Summary.Fetched}", $"unique_plugins={Summary.Unique}", $"duplicates_removed={Summary.Fetched - Summary.Unique}", $"errors={errors}", $"warnings={warnings}") + "\n");
        File.WriteAllLines("errors.txt", Log.Errors.Select(e => Sanitizer.Clean(e, 400)));
        StringBuilder report = new();
        report.AppendLine("# Plugin Repository Merge Report");
        report.AppendLine();
        report.AppendLine("## Summary");
        report.AppendLine($"- **Active Repositories**: {Summary.Active}");
        report.AppendLine($"- **Successful**: {Summary.Succeeded} ✅");
        report.AppendLine($"- **Failing**: {Summary.Failed} ❌");
        report.AppendLine($"- **Quarantined**: {Summary.Quarantined} 🚫");
        report.AppendLine($"- **Restored This Run**: {Summary.Restored} ♻️");
        report.AppendLine();
        report.AppendLine($"- **Total Plugins Fetched**: {Summary.Fetched}");
        report.AppendLine($"- **Unique Plugins**: {Summary.Unique}");
        report.AppendLine($"- **Duplicates Removed**: {Summary.Fetched - Summary.Unique}");
        report.AppendLine();
        report.AppendLine($"- **Errors**: {errors}");
        report.AppendLine($"- **Warnings**: {warnings}");
        report.AppendLine();
        report.AppendLine("## Repository Status");
        report.AppendLine();
        foreach (RepoStatus status in Statuses) report.AppendLine($"{Icon(status.Status)} **{status.Url}**  \n   - Status: {status.Status}  \n   - Plugins: {status.Plugins}{(status.Error is null ? "" : $"  \n   - Error: {Sanitizer.Clean(status.Error, 300)}")}  \n");
        if (errors > 0)
        {
            report.AppendLine($"## Errors ({errors})");
            report.AppendLine();
            foreach (string error in Log.Errors.Take(20)) report.AppendLine($"- {Sanitizer.Clean(error, 300)}");
            if (errors > 20) report.AppendLine($"- ... and {errors - 20} more. See errors.txt for the full list.");
            report.AppendLine();
        }
        if (warnings > 0)
        {
            report.AppendLine($"## Warnings ({warnings})");
            report.AppendLine();
            foreach (string warning in Log.Warnings.Take(20)) report.AppendLine($"- {Sanitizer.Clean(warning, 300)}");
            if (warnings > 20) report.AppendLine($"- ... and {warnings - 20} more.");
        }
        File.WriteAllText("REPORT.md", report.ToString());
        string commit = CommitMessage ?? (errors > 0 || Summary.Failed > 0 ? $"⚠️ Update repository.json: {Summary.Unique} plugins ({Summary.Succeeded}/{Summary.Active} repos, {errors} errors)" : $"✅ Update repository.json: {Summary.Unique} plugins (all {Summary.Active} repos successful)");
        File.WriteAllText("commit-message.txt", commit + "\n");
        if (Summary.MassFailure) File.WriteAllText("alert.md", $"Plugin repo merge: mass failure - {DateTime.UtcNow:yyyy-MM-dd}\n{Summary.Failed} of {Summary.Active} repositories failed in a single run. This is treated as an outage, so no failure counts were recorded and nothing was quarantined. Cached plugin entries were served instead.\n");
        else if (Summary.NewQuarantined > 0) File.WriteAllText("alert.md", $"Plugin repo merge: repositories quarantined - {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC\n{string.Join('\n', NewQuarantine.Select(q => $"- Quarantined `{q.Url}` after failing continuously since {q.FirstFailedUtc:yyyy-MM-dd HH:mm} UTC: {Sanitizer.Clean(q.Reason, 300)}"))}\n\nQuarantined repositories are re-checked every {Settings.QuarantineRetryInterval.TotalHours:0} hours without further notices and restored automatically once they read cleanly.\n");
    }
}
