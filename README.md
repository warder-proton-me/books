# Audiobook Player

A simple static website that plays audiobook chapters.

## Add chapters

1. Put the audio files in `book/` or a subfolder such as `book/files/` (mp3, m4a, m4b, ogg, opus, wav, aac, flac).
   They play in filename order, numbers sorted naturally: `Chapter 2` comes before `Chapter 10`.
2. Optional: add a cover as `book/cover.jpg` (or .png/.webp).
3. Optional: add the title and author in `book/book.json`:
   ```json
   { "title": "My Book", "author": "Author Name", "chapterLabel": "Chapter" }
   ```
   If a file is named with only a number, like `007.mp3`, it is shown as "<chapterLabel> 7".
4. Run `node build-manifest.js`. Run it again each time you add or rename files.

## Run locally

```sh
python3 -m http.server 8000
```
Then open http://localhost:8000. You can also just double-click `index.html`.

## Publish

Upload the whole folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, or any web server).

## Features

Play/pause, back 15s, forward 30s, previous/next chapter, seek bar, volume slider with mute, and playback speed.
When a chapter ends, the next one starts. The page remembers the chapter and position, so a reload picks up where you stopped.
Keyboard: Space plays/pauses, ←/→ skips back/forward, ↑/↓ changes volume. Lock-screen and headphone controls also work.
