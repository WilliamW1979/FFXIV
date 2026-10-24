using RepoMerger;
string mode = args.Length > 0 ? args[0].ToLowerInvariant() : "merge";
if (mode == "merge") return (await Merger.RunAsync()).ExitCode;
if (mode == "submit") return await Submission.RunAsync();
Console.Error.WriteLine("Usage: RepoMerger [merge|submit]");
return 2;
