namespace RepoMerger;
internal static class Sanitizer
{
    public static string Clean(string Value, int Max = 200)
    {
        string clean = new(Value.Select(c => c is >= ' ' and <= '~' && c is not ('`' or '<' or '>' or '|' or '@') ? c : ' ').ToArray());
        clean = string.Join(' ', clean.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return clean.Length > Max ? clean[..Max] + "..." : clean;
    }
}
