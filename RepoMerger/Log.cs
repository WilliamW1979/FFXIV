namespace RepoMerger;
internal static class Log
{
    private static readonly Lock Gate = new();
    private static readonly List<string> ErrorList = [];
    private static readonly List<string> WarningList = [];
    public static IReadOnlyList<string> Errors => ErrorList;
    public static IReadOnlyList<string> Warnings => WarningList;
    public static void Info(string Message) => Console.WriteLine($"[INFO] {Message}");

    public static void Warn(string Message)
    {
        lock (Gate) WarningList.Add(Message);
        Console.WriteLine($"[WARN] {Message}");
    }

    public static void Error(string Message)
    {
        lock (Gate) ErrorList.Add(Message);
        Console.WriteLine($"[ERROR] {Message}");
    }
}