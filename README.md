This repository was created because like most of you, we are tired of adding tons of repositories to Dalamud. So the intent here was one repository to access all the plugins.

Now to respect all the plugin users, a special link was encoded in the master repository to tell everyone where the informatino was read from. This way people can verify it for themselves to be 100% accurate.

This github has a script that is run every 5 minutes. Every 5 minutes, it will read the repositories in the text file and combine them all. It has code to make sure there are no duplicates so your plugin list won't be loaded with multiples of the same plugin. This also makes sure that any updates from the plugin creators are passed on to you. You are still downloading and getting all your information from them. The script just takes all the JSON files and combines them into one.

No information is changed except an entry to what repo the information came from, all other data is read and copied from the sources.

Any new repositories not on the list, please submit and I will gladly add them. The amount of custom repositories has gotten out of hand and has become a headache for most users, so this was a way to automatically handle that.

Because this repository becomes the one Dalamud sees when it loads, older ones will have you remove the plug and reinstall it. This won't mess up your configurations or custom options because Dalamud stores the actual plugin code in one location, and your settings in another. So deleting and re-intalling plugins won't affect you as long as you don't touch the configuration folder in Dalamud.

Since this script is automated by github, no real work needs to be done on it except adding repositories as new ones become available. When the plugin owners update or upgrade, it will be passed on to you. The only bad thing is that you will have up to a 5 minute delay from when an update is posted before you recieve it, but 5 minutes is generally unnoticable anyways.

Hope you enjoy my work!
