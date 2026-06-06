# Post Clipboard to Simple Editor

This folder contains a private signed Apple Shortcut:

`Post Clipboard to Simple Editor.shortcut`

It also contains a simplified version:

`Post Clipboard to Simple Editor Simple.shortcut`

The simplified version only:

1. Posts the clipboard as raw `text/plain`.
2. Gets `shareUrl` from the response.
3. Copies that URL to the clipboard.
4. Shows the copied URL.

It reads the clipboard, sends it to:

`https://simple-editor.natepuls.workers.dev/api/shortcut`

Then it copies the returned `shareUrl` and opens the published page.

The shortcut includes a private bearer token. Do not publish this shortcut file publicly.

Copies were placed at:

- `/Users/nathanpuls/Downloads/Post Clipboard to Simple Editor.shortcut`
- `/Users/nathanpuls/Library/Mobile Documents/com~apple~CloudDocs/Simple Editor/Post Clipboard to Simple Editor.shortcut`
- `/Users/nathanpuls/Downloads/Post Clipboard to Simple Editor Simple.shortcut`
- `/Users/nathanpuls/Library/Mobile Documents/com~apple~CloudDocs/Simple Editor/Post Clipboard to Simple Editor Simple.shortcut`
