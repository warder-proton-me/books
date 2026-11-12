#!/usr/bin/env node
// Scans book/ for audio files and writes book/chapters.js.
// Usage: node build-manifest.js
const fs = require('fs');
const path = require('path');

const BOOK_DIR = path.join(__dirname, 'book');
const AUDIO_EXT = ['.mp3', '.m4a', '.m4b', '.ogg', '.oga', '.opus', '.wav', '.aac', '.flac', '.webm'];
const COVER_NAMES = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp'];

if (!fs.existsSync(BOOK_DIR)) {
  console.error('No book/ folder found next to this script.');
  process.exit(1);
}

// Collect files from book/ and its subfolders, as paths relative to book/.
function walk(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => !d.name.startsWith('.'))
    .flatMap((d) => {
      const rel = prefix ? `${prefix}/${d.name}` : d.name;
      return d.isDirectory() ? walk(path.join(dir, d.name), rel) : [rel];
    });
}
const files = walk(BOOK_DIR);

let meta = {};
const metaPath = path.join(BOOK_DIR, 'book.json');
if (fs.existsSync(metaPath)) {
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse book/book.json:', e.message);
  }
}
const chapterLabel = meta.chapterLabel || 'Chapter';

// "007" -> "Chapter 7"; "Intro_part-1" -> "Intro part 1"
function titleFor(file) {
  const name = path.basename(file, path.extname(file));
  if (/^\d+$/.test(name)) return `${chapterLabel} ${Number(name)}`;
  return name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const chapters = files
  .filter((f) => AUDIO_EXT.includes(path.extname(f).toLowerCase()))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  .map((file) => ({
    file,
    title: titleFor(file),
  }));

const cover = files.find((f) => COVER_NAMES.includes(path.basename(f).toLowerCase())) || null;

const manifest = {
  title: meta.title || 'Audiobook',
  author: meta.author || '',
  cover,
  chapters,
};

// A .js file (not .json) so the page also works when opened directly from disk (file://).
fs.writeFileSync(path.join(BOOK_DIR, 'chapters.js'), 'window.BOOK = ' + JSON.stringify(manifest, null, 2) + ';\n');
console.log(`Wrote book/chapters.js with ${chapters.length} chapter(s)${cover ? ' and a cover' : ''}.`);
