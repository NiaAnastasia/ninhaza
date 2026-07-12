// src/audio.js
// Общий модуль фоновой музыки (ambient.mp3) для нескольких страниц.
// Позиция трека сохраняется в sessionStorage, поэтому при переходе
// между index.html и about.html музыка продолжает играть примерно
// с того же места (полностью бесшовно невозможно — браузер
// перезагружает страницу — но разрыв минимальный).

const POS_KEY = "ambient-pos";
const ON_KEY = "ambient-on";
const SAVE_INTERVAL_MS = 1000;

let audioCtx = null;
let ambientEl = null;
let analyser = null;
let saveTimer = null;
let started = false;

function savePosition() {
  if (ambientEl && !ambientEl.paused) {
    sessionStorage.setItem(POS_KEY, ambientEl.currentTime.toString());
  }
}

function startSaving() {
  if (saveTimer) return;
  saveTimer = setInterval(savePosition, SAVE_INTERVAL_MS);
}

function stopSaving() {
  clearInterval(saveTimer);
  saveTimer = null;
}

// Запускает (или возобновляет) фоновую музыку.
// withAnalyser: true создаёт window.audioAnalyser для визуализаций
// (используется на главной странице для golden-canvas).
export function startAmbient({ withAnalyser = false } = {}) {
  if (started) return;
  started = true;

  ambientEl = new Audio("/audio/ambient.mp3");
  ambientEl.loop = true;
  ambientEl.volume = 0.6;

  const savedPos = parseFloat(sessionStorage.getItem(POS_KEY) || "0");
  if (savedPos > 0) {
    ambientEl.currentTime = savedPos;
  }

  if (withAnalyser) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    window.audioAnalyser = analyser;

    ambientEl
      .play()
      .then(() => {
        const src = audioCtx.createMediaElementSource(ambientEl);
        src.connect(analyser);
        analyser.connect(audioCtx.destination);
      })
      .catch(() => {
        started = false;
      });
  } else {
    ambientEl.play().catch(() => {
      started = false;
    });
  }

  sessionStorage.setItem(ON_KEY, "1");
  startSaving();
}

export function pauseAmbient() {
  if (ambientEl) ambientEl.pause();
  if (audioCtx) audioCtx.suspend();
  stopSaving();
  savePosition();
  sessionStorage.setItem(ON_KEY, "0");
}

export function resumeAmbient() {
  if (ambientEl) {
    ambientEl.play().catch(() => {});
  }
  if (audioCtx) audioCtx.resume();
  sessionStorage.setItem(ON_KEY, "1");
  startSaving();
}

export function isAmbientOn() {
  return sessionStorage.getItem(ON_KEY) === "1";
}

export function wasAmbientPlaying() {
  return parseFloat(sessionStorage.getItem(POS_KEY) || "0") > 0;
}

// Сохраняем позицию перед уходом со страницы
window.addEventListener("beforeunload", savePosition);