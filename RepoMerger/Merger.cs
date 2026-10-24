using System.Text.Json.Nodes;
namespace RepoMerger;
internal sealed record MergeSummary(int ExitCode, int Active, int Succeeded, int Failed, int Quarantined, int NewQuarantined, int Restored, int Fetched, int Unique, bool MassFailure);
internal sealed record RepoStatus(string Url, string Status, int Plugins, string? Error);
file sealed record ReadResult(string Url, List<JsonObject> Valid, string? Error, bool Unchanged, Validator Validator);
file static class Fetch
{
    public static (List<JsonObject> Valid, string? Error) Evaluate(string Url, RepoRead Read)
    {
        List<JsonObject> valid = Read.Plugins.Where(PluginTools.IsValid).ToList();
        foreach (JsonObject plugin in valid) PluginTools.Normalize(plugin, Url);
        if (Read.Error is not null) return (new List<JsonObject>(), Read.Error);
        if (valid.Count == 0) return (valid, "no valid plugins found");
        return (valid, null);
    }

    private static async Task<ReadResult> ReadRepoAsync(string Url, ValidatorEntry? Known, DateTime Now)
    {
        List<JsonObject>? cached = Known is not null && Now - Known.FetchedUtc < Settings.FullRefreshInterval ? Store.LoadCache(Url) : null;
        Validator sent = cached is not null && Known is not null ? Known.Validator : default;
        RepoRead read = await RepoReader.ReadAsync(Url, Settings.MaxRetries, sent);
        if (read.NotModified) return cached is null ? new ReadResult(Url, [], "the server reported no changes but no cached copy exists", false, default) : new ReadResult(Url, cached, null, true, sent);
        (List<JsonObject> valid, string? error) = Evaluate(Url, read);
        return new ReadResult(Url, valid, error, false, read.Validator);
    }

    private static async Task<ReadResult> ReadLimitedAsync(SemaphoreSlim Gate, string Url, ValidatorEntry? Known, DateTime Now)
    {
        await Gate.WaitAsync();
        try
        {
            ReadResult result = await ReadRepoAsync(Url, Known, Now);
            await Task.Delay(Settings.PerRepoDelay);
            return result;
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task<List<ReadResult>> ReadAllAsync(List<string> Urls, Dictionary<string, ValidatorEntry> Known, DateTime Now)
    {
        using SemaphoreSlim gate = new(Settings.MaxParallelFetches);
        return (await Task.WhenAll(Urls.Select(u => ReadLimitedAsync(gate, u, Known.GetValueOrDefault(u), Now)))).ToList();
    }
}
internal static class Merger
{
    private static bool IsBlocked(string Url, List<string> Blocklist) => Blocklist.Any(b => Url.Contains(b, StringComparison.OrdinalIgnoreCase));

    public static async Task<MergeSummary> RunAsync(string? CommitMessage = null)
    {
        DateTime now = DateTime.UtcNow;
        List<string> blocklist = Store.ReadBlocklist();
        List<string> listed = Store.ReadRepoList();
        foreach (string blocked in listed.Where(u => IsBlocked(u, blocklist))) Log.Warn($"Removed blocklisted repository {blocked}");
        List<string> active = listed.Where(u => !IsBlocked(u, blocklist)).ToList();
        Dictionary<string, HealthEntry> health = Store.ReadHealth().ToDictionary(h => h.Url, StringComparer.OrdinalIgnoreCase);
        List<QuarantineEntry> quarantine = Store.ReadQuarantine().Where(q => !IsBlocked(q.Url, blocklist)).ToList();
        Dictionary<string, ValidatorEntry> validators = Store.ReadValidators().GroupBy(v => v.Url, StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        Dictionary<string, ValidatorEntry> nextValidators = new(StringComparer.OrdinalIgnoreCase);
        Log.Info($"Starting merge: {active.Count} active repositories, {quarantine.Count} quarantined");
        List<ReadResult> results = await Fetch.ReadAllAsync(active, validators, now);
        Log.Info($"{results.Count(r => r.Unchanged)} of {results.Count} repositories were unchanged and served from cache");
        int failedNow = results.Count(r => r.Error is not null);
        bool massFailure = results.Count > 0 && (double)failedNow / results.Count > Settings.MassFailureRatio;
        if (massFailure) Log.Error($"{failedNow} of {results.Count} repositories failed in one run. This looks like an outage on our side, so no failure counts were recorded and nothing was quarantined.");
        List<JsonObject> all = [];
        List<string> stillActive = [];
        List<RepoStatus> statuses = [];
        List<QuarantineEntry> fresh = [];
        List<QuarantineEntry> remaining = [];
        int restored = 0;
        foreach (ReadResult result in results)
        {
            if (result.Error is null)
            {
                if (result.Unchanged)
                {
                    if (validators.TryGetValue(result.Url, out ValidatorEntry? unchanged)) nextValidators[result.Url] = unchanged;
                }
                else
                {
                    Store.SaveCache(result.Url, result.Valid);
                    if (result.Validator.HasValue) nextValidators[result.Url] = new ValidatorEntry(result.Url, result.Validator, now);
                }
                health.Remove(result.Url);
                all.AddRange(result.Valid);
                stillActive.Add(result.Url);
                statuses.Add(new RepoStatus(result.Url, "success", result.Valid.Count, null));
                Log.Info(result.Unchanged ? $"{result.Url} is unchanged, using {result.Valid.Count} cached plugins" : $"Loaded {result.Valid.Count} plugins from {result.Url}");
                continue;
            }
            string error = result.Error;
            if (validators.TryGetValue(result.Url, out ValidatorEntry? knownValidator)) nextValidators[result.Url] = knownValidator;
            List<JsonObject>? cached = Store.LoadCache(result.Url);
            health.TryGetValue(result.Url, out HealthEntry? previous);
            DateTime firstFailed = previous?.FirstFailedUtc ?? now;
            if (!massFailure && now - firstFailed >= Settings.QuarantineAfter)
            {
                fresh.Add(new QuarantineEntry(result.Url, firstFailed, error, now));
                health.Remove(result.Url);
                statuses.Add(new RepoStatus(result.Url, "quarantined", 0, error));
                Log.Error($"Quarantined {result.Url} after failing continuously since {firstFailed:yyyy-MM-dd HH:mm} UTC: {error}");
                continue;
            }
            if (!massFailure) health[result.Url] = new HealthEntry(result.Url, firstFailed, previous?.Reason ?? error);
            stillActive.Add(result.Url);
            if (cached is not null) all.AddRange(cached);
            statuses.Add(new RepoStatus(result.Url, "failed", cached?.Count ?? 0, error));
            Log.Error($"{result.Url} has been failing since {firstFailed:yyyy-MM-dd HH:mm} UTC ({(now - firstFailed).TotalHours:0.0} of {Settings.QuarantineAfter.TotalHours:0} hours before quarantine): {error}{(cached is null ? "" : " - serving cached plugins")}");
        }
        foreach (QuarantineEntry entry in quarantine)
        {
            if (massFailure || now - entry.LastCheckedUtc < Settings.QuarantineRetryInterval)
            {
                remaining.Add(entry);
                statuses.Add(new RepoStatus(entry.Url, "quarantined", 0, entry.Reason));
                continue;
            }
            RepoRead read = await RepoReader.ReadAsync(entry.Url, Settings.MaxRetries);
            (List<JsonObject> valid, string? error) = Fetch.Evaluate(entry.Url, read);
            if (error is null)
            {
                Store.SaveCache(entry.Url, valid);
                if (read.Validator.HasValue) nextValidators[entry.Url] = new ValidatorEntry(entry.Url, read.Validator, now);
                all.AddRange(valid);
                stillActive.Add(entry.Url);
                restored++;
                statuses.Add(new RepoStatus(entry.Url, "restored", valid.Count, null));
                Log.Info($"Restored {entry.Url} from quarantine with {valid.Count} plugins");
                continue;
            }
            remaining.Add(entry with { Reason = error, LastCheckedUtc = now });
            statuses.Add(new RepoStatus(entry.Url, "quarantined", 0, error));
            Log.Info($"{entry.Url} is still failing: {error}");
            await Task.Delay(Settings.PerRepoDelay);
        }
        List<JsonObject> unique = PluginTools.Deduplicate(all);
        JsonArray output = new();
        foreach (JsonObject plugin in unique) output.Add(plugin);
        File.WriteAllText(Store.OutputFile, JsonOutput.Serialize(output));
        Log.Info($"Wrote {Store.OutputFile} with {unique.Count} plugins");
        List<QuarantineEntry> allQuarantined = remaining.Concat(fresh).ToList();
        Store.WriteRepoList(stillActive);
        Store.WriteQuarantine(allQuarantined);
        Store.WriteHealth(stillActive.Where(health.ContainsKey).Select(u => health[u]));
        Store.WriteValidators(stillActive.Where(nextValidators.ContainsKey).Select(u => nextValidators[u]));
        Store.PruneCache(stillActive);
        MergeSummary summary = new(massFailure ? 1 : 0, results.Count, results.Count(r => r.Error is null), failedNow, allQuarantined.Count, fresh.Count, restored, all.Count, unique.Count, massFailure);
        Report.Write(summary, statuses, fresh, CommitMessage);
        return summary;
    }
}