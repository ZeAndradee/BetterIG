# BetterIG

**Instagram on your browser, the way it was meant to be.**

Everything Instagram Web should have been, in one extension.

Instagram on the desktop always felt like a stripped-down copy of the app. BetterIG fills the gaps and improves the whole Instagram Web experience. It starts with the biggest pain: video. Remember that jump scare when the audio blasts at full volume and you can't even rewind? That's over. You get real video controls, keyboard shortcuts, quality selection, stories you can actually scrub and a clear view of the time you spend on the platform, with more of Instagram being improved in every update.

---

## Real video controls

A full control bar attached to whatever video you're actually watching: exact timestamps, a seekable progress bar, mute, playback speed and fullscreen. It follows the active video as you scroll and stays out of the way until you need it.

![BetterIG video controls on Instagram Web](https://github.com/user-attachments/assets/423cf5b6-aa61-4dbd-923b-6000bac723f4)

## Pick your own video quality

Instagram decides the resolution for you, and it often lands on a blurry 360p when 1080p is right there. The quality menu inside the player lists every resolution available for the current video. Pick one and it sticks, or leave it on Auto and see which resolution is actually playing.

![BetterIG video quality menu](https://github.com/user-attachments/assets/af22a37f-b8b9-42d0-ba09-e9ae5a7c491d)

## Keyboard shortcuts

Everything is one key away. The shortcuts panel lives inside the control bar, so you never have to guess.

![BetterIG keyboard shortcuts modal](https://github.com/user-attachments/assets/da730171-8a49-492c-aa98-55a2887c008d)

| Action          | Key            |
| --------------- | -------------- |
| Play / Pause    | `Space`        |
| 2x speed        | `Space` (hold) |
| Like            | `L`            |
| Mute / Unmute   | `M`            |
| Fullscreen      | `F`            |
| Seek forward 5s | `→`            |
| Seek back 5s    | `←`            |

## Time status and personalization

The extension popup shows how much time you actually spent on reels — this week or all time — along with reels watched, stories viewed and interactions. Each feature can be turned on or off independently, and every counter can be reset at any moment.

![BetterIG extension popup with watch time and feature toggles](https://github.com/user-attachments/assets/b9a23c52-c533-4699-9f71-e197e9960fe7)

---

## Features

- Full playback controls with exact timestamps
- Rewind, fast-forward and adjustable playback speed (0.5x to 2x)
- Manual video quality selection, or Auto with the playing resolution shown
- A true fullscreen mode
- Auto-scroll to the next reel when a video ends
- Seekable progress bar on stories, with segment indicators
- Pause state that persists while you browse the feed
- Local watch-time and interaction stats, weekly and all-time
- A short welcome tour the first time you open Instagram after installing

## Why people use BetterIG

- It fixes what's broken on Instagram Web today, starting with video
- 100% local — your data is never collected, sold, or sent anywhere
- Lightweight: it reorganizes the screen without changing the Instagram look you already know
- Actively developed, with frequent updates

## Coming next

- A cleaner chronological feed, with the option to hide Reels and filter by keyword
- Powered-up DMs: keyboard shortcuts, quick replies, jump-to-date and in-conversation search
- Photo zoom and downloads
- Productivity mode with a built-in Pomodoro and Reel limits

## Install

BetterIG is available on the Chrome Web Store.

To run it from source:

```bash
npm install
npm run dev            # Chrome
npm run dev:firefox    # Firefox
```

To produce a build:

```bash
npm run build          # output in .output/chrome-mv3
npm run zip            # packaged extension
```

Then load the unpacked build from `chrome://extensions` with developer mode enabled.

## Tech stack

Built with [WXT](https://wxt.dev), React 19 and TypeScript. The UI is injected through a shadow root, so Instagram's own styles are never touched. State lives in `browser.storage.local` and nowhere else.

```
entrypoints/    content script, popup and background
components/     video controls, config menu, shortcuts modal
hooks/video/    active video detection, story segments, shortcuts, quality, state
utils/store.ts  flags and stats persistence
```

## Feedback

Got a bug or a feature idea? Open an issue. BetterIG grows from what the community asks for.

## Privacy

BetterIG has no servers and sends nothing off your device. See the [privacy policy](PRIVACY.md).

## Disclaimer

BetterIG is not affiliated with, sponsored, or endorsed by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc.
