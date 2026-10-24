namespace RepoMerger;
internal static class Settings
{
    public static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(30);
    public static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(2);
    public static readonly TimeSpan PerRepoDelay = TimeSpan.FromMilliseconds(500);
    public static readonly TimeSpan QuarantineRetryInterval = TimeSpan.FromHours(6);
    public static readonly TimeSpan QuarantineAfter = TimeSpan.FromDays(3);
    public static readonly TimeSpan RateWindow = TimeSpan.FromHours(24);
    public static readonly TimeSpan FullRefreshInterval = TimeSpan.FromHours(6);
    public const int MaxRetries = 3;
    public const int MaxParallelFetches = 4;
    public const int SubmissionRetries = 2;
    public const int MaxRejectionsPerWindow = 3;
    public const int MaxUrlLength = 300;
    public const int MaxBodyBytes = 5 * 1024 * 1024;
    public const int DalamudApiLevel = 12;
    public const double MassFailureRatio = 0.3;
    public const string CarvelUrl = "https://plugins.carvel.li/";
    public const string CarvelConfigUrl = "https://git.carvel.li/liza/plugin-repo/raw/branch/master/_config.json";
}