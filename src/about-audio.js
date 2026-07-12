// src/about-audio.js
import { startAmbient, pauseAmbient, resumeAmbient, isAmbientOn, wasAmbientPlaying } from "./audio.js";

const soundBtn = document.getElementById("sound-btn");
const soundIcon = document.getElementById("sound-icon");

let started = false;
let muted = false;

function setIcon() {
  soundIcon.src = muted ? "/bass.svg" : "/treble.svg";
  soundIcon.alt = muted ? "sound off" : "sound on";
  soundBtn.classList.toggle("muted", muted);
}

// Если музыка уже играла на предыдущей странице, кнопка
// сразу показывает "включено", но сам звук стартует только
// после первого клика (требование браузера).
if (wasAmbientPlaying() && isAmbientOn()) {
  muted = false;
} else {
  muted = true;
}
setIcon();

soundBtn.addEventListener("click", () => {
  if (!started) {
    started = true;
    startAmbient({ withAnalyser: false });
    muted = false;
  } else {
    muted = !muted;
    if (muted) {
      pauseAmbient();
    } else {
      resumeAmbient();
    }
  }
  setIcon();
});