# Report Helper for LeetCode Contests

A small Chrome extension (Manifest V3) that speeds up the **Code Replay → Report Cheating** flow on LeetCode
contest ranking pages. You pick the user and the question, and the extension does the clicking: open replay,
open the report dialog, tick the reason, fill the note, submit, close.

> **You decide who gets reported.** The extension never chooses targets. Only report when you have looked at the
> code and have a real reason. False or bulk reports can get your own account penalised, and automated reporting
> may be restricted by LeetCode's Terms of Service. You are responsible for how you use it.
> This project is not affiliated with or endorsed by LeetCode.

## Install

1. Download or clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open a contest ranking page, e.g. `https://leetcode.com/contest/weekly-contest-519/ranking/`.

## Use

A floating **Report Helper** panel appears on contest pages.

- **Prev / Skip / row number** choose a participant on the current ranking page. Each Q button shows that user's solve time and is disabled if they have no submission.
- **Q1–Q4** reports that question. **Report all solved questions** reports every solved question for that user, after a confirmation prompt.
- **Reason** is one of LeetCode's report reasons. **Note** is sent to reviewers.
- **Auto-submit** off: it fills the form and stops at the highlighted Submit so you press it yourself. On: it submits.
- Drag the header to move the panel; **–** minimises, **×** closes. Reopen with the round button, **Alt+R**, or the toolbar icon.
- Reports are logged in your browser (`localStorage`), and the user card shows `Reported: Q1, Q2` for what you already reported in that contest.

### Note placeholders

The note box supports `{contest}`, `{user}`, `{q}` and `{time}`, filled in per report. The default note makes a
specific claim (AI-generated, lightly edited, pasted), so edit it to match what you actually saw. The final text is
printed in the DevTools console before each report.

### Your own account

Your own row is never reportable. The extension learns your username from the row LeetCode labels **"You"** and stores it locally.
If that label isn't shown (not logged in, other language), set it manually in the console:

```js
localStorage.setItem('lcrh_self', 'your_username')   // several: 'a,b'
```

## How it finds things

LeetCode's class names are Tailwind utilities and Radix ids change, so the script relies on stable hooks only:
`.ranking-guide-anchor` (time cells), `a[href^="/u/"]` (usernames), `[role=dialog]`, `[aria-haspopup=dialog]` with the text
"Report Cheating", `[role=checkbox]` inside `label`s, and button text. If LeetCode changes its UI, things may break:
run `lcrhDebug()` in the console on a ranking page to see how many rows were detected, and open an issue.

## Files

| File | Role |
|---|---|
| `manifest.json` | Extension manifest (runs on `https://leetcode.com/contest/*`) |
| `content.js` | Panel UI and the report flow (runs in the page context) |
| `bridge.js` | Relays the toolbar-icon click and the icon to the page |
| `background.js` | Handles the toolbar click and reads the icon file |

## License

MIT, see `LICENSE`.

## Terms

Use of this extension is governed by [TERMS.md](TERMS.md). You are responsible for every report you submit.
