# BetterIG

**Instagram on your browser, the way it was meant to be.**

A real video player for Instagram Web.

Remember that jump scare when the audio blasts at full volume and you can't even rewind? That's over. BetterIG adds a native video player to Instagram Web with real controls, keyboard shortcuts, quality selection and stories you can actually scrub — the experience the desktop version always should have had.

---

## Real video controls

A full control bar attached to whatever video you're actually watching: exact timestamps, a seekable progress bar, mute, playback speed and fullscreen. It follows the active video as you scroll and stays out of the way until you need it.

![BetterIG video controls on Instagram Web](https://github-production-user-asset-6210df.s3.amazonaws.com/59659214/649160264-c085bdc5-fc46-452b-9850-39c9a7da9784.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260910%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260910T033602Z&X-Amz-Expires=300&X-Amz-Signature=1a41ffd93b4ea2c07c058910ddf511788be7aa09e581378f2336ff8c603631fa&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

## Pick your own video quality

Instagram decides the resolution for you, and it often lands on a blurry 360p when 1080p is right there. The quality menu inside the player lists every resolution available for the current video. Pick one and it sticks, or leave it on Auto and see which resolution is actually playing.

![BetterIG video quality menu](https://github-production-user-asset-6210df.s3.amazonaws.com/59659214/649161488-fd1629cd-ea41-4fba-897d-e759ec6477a4.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260910%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260910T033706Z&X-Amz-Expires=300&X-Amz-Signature=0610a84880a6572d405b6ed2d8cb8508dc7050b226e79af2a663df8d8bb60fe8&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

## Keyboard shortcuts

Everything is one key away. The shortcuts panel lives inside the control bar, so you never have to guess.

![BetterIG keyboard shortcuts modal](https://github-production-user-asset-6210df.s3.amazonaws.com/59659214/649161760-8809e2b4-93f0-4446-81bc-bafc63ff5c20.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260910%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260910T033728Z&X-Amz-Expires=300&X-Amz-Signature=bae09f48b8bb2df7a41f5fe70e1c3108a6e950d351d51289d693ebd30cb045ca&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

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

![BetterIG extension popup with watch time and feature toggles](https://github-production-user-asset-6210df.s3.amazonaws.com/59659214/649161936-a188b9dd-9a3d-4838-befd-bb48f4cb3be4.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20260910%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260910T033752Z&X-Amz-Expires=300&X-Amz-Signature=307661f47ce8739f1ec50cd750db626a1d22df3ee51e40e8039201e1feb7699d&X-Amz-SignedHeaders=host&response-content-type=image%2Fpng)

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

- It fixes the broken video experience on Instagram Web today
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

## Disclaimer

BetterIG is not affiliated with, sponsored, or endorsed by Instagram or Meta Platforms, Inc. Instagram is a trademark of Meta Platforms, Inc.
