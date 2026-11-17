# BookBreaks

A Chrome extension that makes reading time earn YouTube video time.

## Install locally

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open the extension popup, choose a reading session length, and start reading.
5. Press **Stop and earn time** whenever you want to use the time you have read.

Only URLs containing `youtube.com/watch` are blocked. YouTube home, search,
channel pages, and other non-video links stay available.

Use the clock button in the popup to turn on scheduled blocking and choose
start/end hours. Schedule changes take effect immediately.

Edit `keywords.txt` to add one keyword per line. A video whose title contains
one of those keywords asks for manual approval. Approved keyword-matching
videos do not use earned time.
