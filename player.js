// Written in plain ES5 (no arrow functions, template strings, let/const, etc.)
// so it also runs on old iPhones and iPads.
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var audio = $('audio');
  var playBtn = $('play');
  var seek = $('seek');
  var volume = $('volume');
  var muteBtn = $('mute');
  var speed = $('speed');
  var list = $('chapters');

  var STORE_KEY = 'audiobook-state';
  var book = null;
  var current = 0;
  var seeking = false;
  var lastSave = 0;

  var store = {
    get: function () {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
    },
    set: function (patch) {
      try {
        var state = store.get();
        for (var k in patch) state[k] = patch[k];
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
      } catch (e) { /* ignore (private mode, storage full) */ }
    }
  };

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function fmt(sec) {
    if (!isFinite(sec)) return '0:00';
    sec = Math.floor(sec);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = pad2(sec % 60);
    return h ? h + ':' + pad2(m) + ':' + s : m + ':' + s;
  }

  function fileUrl(file) {
    return 'book/' + file.split('/').map(encodeURIComponent).join('/');
  }

  // Older iOS returns undefined from play(); newer returns a promise that may reject.
  function play() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function showMessage(html) {
    var el = $('message');
    el.innerHTML = html;
    el.removeAttribute('hidden');
  }

  function renderList() {
    list.innerHTML = '';
    book.chapters.forEach(function (ch, i) {
      var li = document.createElement('li');
      li.tabIndex = 0;
      li.innerHTML = '<span class="num"></span><span class="t"></span>';
      li.querySelector('.num').textContent = i + 1;
      li.querySelector('.t').textContent = ch.title;
      li.addEventListener('click', function () { load(i, 0, true); });
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.keyCode === 13) load(i, 0, true);
      });
      list.appendChild(li);
    });
  }

  function highlight() {
    var items = list.children;
    for (var i = 0; i < items.length; i++) {
      if (i === current) items[i].classList.add('current');
      else items[i].classList.remove('current');
    }
  }

  function load(index, startAt, autoplay) {
    if (!book || index < 0 || index >= book.chapters.length) return;
    current = index;
    var ch = book.chapters[index];
    audio.src = fileUrl(ch.file);
    audio.playbackRate = Number(speed.value);
    $('now-title').textContent = ch.title;
    document.title = ch.title + ' · ' + book.title;
    highlight();
    store.set({ chapter: index, position: startAt || 0 });

    if (startAt) {
      var onMeta = function () {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.currentTime = startAt;
      };
      audio.addEventListener('loadedmetadata', onMeta);
    }
    if (autoplay) play();
    updateMediaSession();
  }

  function togglePlay() {
    if (!audio.getAttribute('src')) return load(current, 0, true);
    if (audio.paused) play();
    else audio.pause();
  }

  function skip(sec) {
    if (!audio.getAttribute('src')) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + sec));
  }

  function setVolume(v) {
    v = Math.max(0, Math.min(1, v));
    audio.volume = v;
    audio.muted = false;
    volume.value = v;
    store.set({ volume: v });
  }

  function updateMuteIcon() {
    var v = audio.muted ? 0 : audio.volume;
    var waves = v === 0
      ? '<path class="stroke" d="M16 9.5l5 5m0-5l-5 5"/>'
      : '<path class="stroke" d="M15.5 9a4 4 0 0 1 0 6"/>' + (v >= 0.5 ? '<path class="stroke" d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>' : '');
    muteBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M4 9.5h3l4.4-3.7a1 1 0 0 1 1.6.8v10.8a1 1 0 0 1-1.6.8L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z"/>' + waves + '</svg>';
    var label = audio.muted ? 'Включить звук' : 'Выключить звук';
    muteBtn.setAttribute('aria-label', label);
    muteBtn.title = label;
  }

  function savePosition() {
    store.set({ chapter: current, position: audio.currentTime });
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined' || !book) return;
    var ch = book.chapters[current];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: ch.title,
      artist: book.author,
      album: book.title,
      artwork: book.cover ? [{ src: fileUrl(book.cover) }] : []
    });
  }

  function isInside(el, tagName) {
    for (; el && el !== document; el = el.parentNode) {
      if (el.tagName === tagName) return true;
    }
    return false;
  }

  // Controls
  playBtn.addEventListener('click', togglePlay);
  $('prev').addEventListener('click', function () {
    if (audio.currentTime > 3) audio.currentTime = 0;
    else load(current - 1, 0, !audio.paused);
  });
  $('next').addEventListener('click', function () { load(current + 1, 0, !audio.paused); });

  seek.addEventListener('input', function () {
    seeking = true;
    $('time-cur').textContent = fmt(Number(seek.value));
  });
  seek.addEventListener('change', function () {
    audio.currentTime = Number(seek.value);
    seeking = false;
    savePosition();
  });

  volume.addEventListener('input', function () { setVolume(Number(volume.value)); });
  volume.addEventListener('change', function () { setVolume(Number(volume.value)); });
  muteBtn.addEventListener('click', function () { audio.muted = !audio.muted; });
  speed.addEventListener('change', function () {
    audio.playbackRate = Number(speed.value);
    store.set({ speed: speed.value });
  });

  // Audio events
  audio.addEventListener('play', function () {
    playBtn.classList.add('playing');
    playBtn.setAttribute('aria-label', 'Пауза');
    playBtn.title = 'Пауза';
  });
  audio.addEventListener('pause', function () {
    playBtn.classList.remove('playing');
    playBtn.setAttribute('aria-label', 'Слушать');
    playBtn.title = 'Слушать';
    savePosition();
  });
  audio.addEventListener('loadedmetadata', function () {
    seek.max = Math.floor(audio.duration) || 0;
    $('time-dur').textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', function () {
    if (!seeking) {
      seek.value = Math.floor(audio.currentTime);
      $('time-cur').textContent = fmt(audio.currentTime);
    }
    var now = Date.now();
    if (now - lastSave > 5000) { lastSave = now; savePosition(); }
  });
  audio.addEventListener('ended', function () {
    if (current < book.chapters.length - 1) load(current + 1, 0, true);
    else store.set({ position: 0 });
  });
  audio.addEventListener('volumechange', updateMuteIcon);
  audio.addEventListener('ratechange', function () {
    // browsers reset rate when src changes; keep the chosen speed
    if (audio.playbackRate !== Number(speed.value)) audio.playbackRate = Number(speed.value);
  });
  window.addEventListener('pagehide', savePosition);

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'range') || isInside(t, 'LI')) return;
    var key = e.key || ({ 32: ' ', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown' })[e.keyCode];
    if (key === ' ' || key === 'Spacebar') { e.preventDefault(); togglePlay(); }
    else if (key === 'ArrowLeft') { e.preventDefault(); skip(-15); }
    else if (key === 'ArrowRight') { e.preventDefault(); skip(30); }
    else if (key === 'ArrowUp') { e.preventDefault(); setVolume(audio.volume + 0.05); }
    else if (key === 'ArrowDown') { e.preventDefault(); setVolume(audio.volume - 0.05); }
  });

  // Lock screen / headphone controls
  if ('mediaSession' in navigator) {
    var handlers = {
      play: play,
      pause: function () { audio.pause(); },
      previoustrack: function () { load(current - 1, 0, true); },
      nexttrack: function () { load(current + 1, 0, true); },
      seekbackward: function () { skip(-15); },
      seekforward: function () { skip(30); }
    };
    Object.keys(handlers).forEach(function (action) {
      try { navigator.mediaSession.setActionHandler(action, handlers[action]); } catch (e) { /* unsupported */ }
    });
  }

  // Init
  var saved = store.get();
  if (saved.speed) speed.value = saved.speed;
  if (typeof saved.volume === 'number') setVolume(saved.volume);
  updateMuteIcon();

  book = window.BOOK;
  if (!book) {
    showMessage('Не удалось загрузить список глав. Запустите <code>node build-manifest.js</code>.');
    return;
  }
  $('book-title').textContent = book.title;
  $('book-author').textContent = book.author || '';
  if (book.cover) { $('cover').src = fileUrl(book.cover); $('cover').removeAttribute('hidden'); }
  if (!book.chapters.length) {
    showMessage('Глав пока нет. Добавьте аудиофайлы в <code>book/</code> и запустите <code>node build-manifest.js</code>.');
    return;
  }
  renderList();
  var start = Math.min(saved.chapter || 0, book.chapters.length - 1);
  load(start, saved.chapter === start ? saved.position || 0 : 0, false);
})();
