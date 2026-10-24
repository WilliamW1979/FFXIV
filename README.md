# Dalamud Plugin Repository Merger

Merges many Dalamud custom plugin repositories into a single `repository.json`, so users only have to add one URL to the game. The merge runs automatically every 5 minutes on GitHub Actions, and anyone can submit a new repository by opening an issue.

## Using the merged repository

Add this URL as a custom plugin repository in Dalamud:

[https://raw.githubusercontent.com/WilliamW1979/FFXIV/main/repository.json](https://raw.githubusercontent.com/WilliamW1979/FFXIV/main/repository.json)

## Submitting a repository

1. Open a new issue and choose **Submit a plugin repository**.
2. Paste the direct URL to your repo JSON file.
3. Wait a minute or two. A bot replies on the issue and closes it.

If the repository passes every check it is added immediately and shows up in the next merged `repository.json`. If it fails, the reply explains why. Fix the problem and open a new submission.

### Submission requirements

- The URL is `https://`, on a public domain name, 300 characters or fewer, with no credentials, custom port, IP address or internal host.
- The URL is not on the blocklist, not already in the list, and not currently quarantined.
- The repository can be read and contains at least one plugin.
- Every plugin has an `InternalName` and a `Name`. `InternalName` may only contain letters, digits, dots, dashes and underscores (64 characters max).

## How the merge works

Each run does the following:

1. Reads `RepoList.txt` and drops anything matching `Blocklist.txt`.
2. Fetches the repositories, up to 4 at a time, with retries. A repository whose server reports it unchanged since the last run (via `ETag` or `Last-Modified`) is not downloaded again, and its cached plugins are used instead. Every repository is still fully re-fetched at least every 6 hours. Plugins missing `InternalName` or `Name` are skipped with a warning.
3. Normalizes each plugin: a missing `Author` becomes `Unknown`, and `RepoUrl` and `SourceRepo` are filled in.
4. Deduplicates by `InternalName`. The winner is the entry with a download link, then the higher `AssemblyVersion`, then the one with more fields. The other sources are listed in `AlternateSources`. If the copies come from different authors, a warning is logged, since that usually means two different plugins share one `InternalName`.
5. Writes `repository.json` and the report files, then commits and pushes if anything changed.

### Dedication

This MEGA Repository was written for a woman who loved playing FFXIV. She passed away on April 7th, 2026. Even though I don't play the game anymore, I keep this going out of respect for her. I fully automated the system because originally she was the one who managed this after I wrote the initial code. Since she can't manage it anymore, I fully automated it.

### Notes

I originally wrote this in JavaScript but re-created the same script in C# so that it could run more efficiently and effectively. I have it set it to email me if there are any problems with how it runs so I will be closely monitoring it from this day forth.
