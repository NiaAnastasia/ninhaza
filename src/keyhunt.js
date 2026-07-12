// ── ninhaza · the key hunt ───────────────────────────────────
// 35 SVG-ключей в /public/games/key-hunt/keys/ (key-01.svg … key-35.svg).
// Ключи чёрные — красятся через CSS mask + background-color,
// поэтому тон подстраивается под фон на каждом уровне.

const KEY_COUNT = 35;
const keySrc = (i) =>
  `url("/games/key-hunt/keys/key-${String(i + 1).padStart(2, "0")}.svg")`;

const MOBILE = matchMedia("(max-width: 720px)").matches;

// ── уровни ───────────────────────────────────────────────────
// keys — сколько ключей на поле · min/max — размер (px)
// time — секунды · rot — макс. поворот (±°) · mirror — доля зеркальных
// colors — тона уровня: от яркого золота к «растворению» в картине
// кривая: I–V очень мягкие, по нарастающей · VI чуть сложнее V · VII нереальный
const LEVELS = [
  { keys: 8,   min: 72, max: 100, time: 120, rot: 5,  mirror: 0,    colors: ["#f5c842", "#e8bd2f"] },
  { keys: 15,  min: 62, max: 86,  time: 100, rot: 10, mirror: 0,    colors: ["#f5c842", "#e8bd2f", "#d4a017"] },
  { keys: 25,  min: 54, max: 76,  time: 80,  rot: 18, mirror: 0,    colors: ["#f5c842", "#d4a017", "#e0b53a"] },
  { keys: 40,  min: 46, max: 64,  time: 65,  rot: 28, mirror: 0.1,  colors: ["#d4a017", "#c9a13a", "#e0b53a"] },
  { keys: 70,  min: 38, max: 54,  time: 50,  rot: 40, mirror: 0.2,  colors: ["#d4a017", "#b8985a"] },
  { keys: 110, min: 34, max: 48,  time: 40,  rot: 50, mirror: 0.3,  colors: ["#d4a017", "#c9a13a", "#b8985a"] },
  { keys: 620, min: 12, max: 19,  time: 11,  rot: 90, mirror: 0.7,  colors: ["rgba(124,132,154,0.42)", "rgba(116,124,146,0.42)"] },
];
// на тач-экранах ключи чуть крупнее, чтобы в них можно было попасть пальцем
if (MOBILE) LEVELS.forEach((l) => { l.min += 5; l.max += 5; });

const FIELD_W = 1600;
const FIELD_H = 1100;
const GOAL = 7;
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii"];

// ── DOM ──────────────────────────────────────────────────────
const stages = {
  brief: document.getElementById("brief"),
  choose: document.getElementById("choose"),
  hunt: document.getElementById("hunt"),
};
const picksEl = document.getElementById("picks");
const fieldEl = document.getElementById("field");
const fieldWrap = document.getElementById("field-wrap");
const sizerEl = document.getElementById("sizer");
const zInBtn = document.getElementById("z-in");
const zOutBtn = document.getElementById("z-out");
const hudKey = document.getElementById("hud-key");
const hudStreak = document.getElementById("hud-streak");
const hudTime = document.getElementById("hud-time");
const timebar = document.querySelector("#timebar i");
const penaltyEl = document.getElementById("penalty");
const veil = document.getElementById("veil");
const pRoman = document.getElementById("p-roman");
const pName = document.getElementById("p-name");
const pText = document.getElementById("p-text");
const pBtn = document.getElementById("p-btn");

// ── state ────────────────────────────────────────────────────
// стрик живёт только в памяти вкладки: перезагрузка = начать сначала
let streak = 0;
let targetIdx = -1; // индекс SVG-формы искомого ключа
let targetEl = null; // ссылка на элемент цели (в DOM цель неотличима от приманок)
let roundActive = false;
let endAt = 0;
let totalMs = 0;
let timerId = 0;
let penaltyId = 0;

// ── честный рандом ───────────────────────────────────────────
function rnd() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}
const rand = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ── смена сцены ──────────────────────────────────────────────
function show(name) {
  Object.values(stages).forEach((s) => s.classList.remove("on"));
  stages[name].classList.add("on");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── зум картины ──────────────────────────────────────────────
let zoom = 1;
const Z_MIN = 1;
const Z_MAX = 2.6;
const Z_STEP = 1.3;

function setZoom(z) {
  z = Math.min(Z_MAX, Math.max(Z_MIN, z));
  // держим центр вьюпорта на месте при масштабировании
  const cx = (fieldWrap.scrollLeft + fieldWrap.clientWidth / 2) / zoom;
  const cy = (fieldWrap.scrollTop + fieldWrap.clientHeight / 2) / zoom;
  zoom = z;
  sizerEl.style.width = `${FIELD_W * zoom}px`;
  sizerEl.style.height = `${FIELD_H * zoom}px`;
  fieldEl.style.transform = `scale(${zoom})`;
  fieldWrap.scrollLeft = cx * zoom - fieldWrap.clientWidth / 2;
  fieldWrap.scrollTop = cy * zoom - fieldWrap.clientHeight / 2;
  zInBtn.disabled = zoom >= Z_MAX - 0.01;
  zOutBtn.disabled = zoom <= Z_MIN + 0.01;
}
zInBtn.addEventListener("click", () => setZoom(zoom * Z_STEP));
zOutBtn.addEventListener("click", () => setZoom(zoom / Z_STEP));

// ── 1 · правила → выбор ──────────────────────────────────────
document.getElementById("begin-btn").addEventListener("click", () => {
  buildPicks();
  show("choose");
});

// ── 2 · выбор ключа ──────────────────────────────────────────
function buildPicks() {
  picksEl.innerHTML = "";
  const pool = [...Array(KEY_COUNT).keys()];
  for (let n = 0; n < 6; n++) {
    const idx = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const b = document.createElement("button");
    b.className = "pick";
    b.setAttribute("aria-label", "hunt this key");
    const g = document.createElement("span");
    g.className = "glyph";
    g.style.setProperty("--m", keySrc(idx));
    b.appendChild(g);
    b.addEventListener("click", () => {
      targetIdx = idx;
      startHunt();
    });
    picksEl.appendChild(b);
  }
}

// ── 3 · охота ────────────────────────────────────────────────
function startHunt() {
  const level = LEVELS[Math.min(streak, LEVELS.length - 1)];

  // HUD
  hudKey.style.setProperty("--m", keySrc(targetIdx));
  hudStreak.textContent = `hunt ${ROMAN[Math.min(streak, GOAL - 1)]} of vii`;

  // поле
  fieldEl.innerHTML = "";
  const frag = document.createDocumentFragment();
  const decoyPool = [...Array(KEY_COUNT).keys()].filter((i) => i !== targetIdx);
  const targetSlot = Math.floor(rnd() * level.keys); // цель прячется среди приманок и в DOM

  for (let n = 0; n < level.keys; n++) {
    const isTarget = n === targetSlot;
    const shape = isTarget ? targetIdx : pick(decoyPool);
    const size = Math.round(rand(level.min, level.max));
    const box = size + 12; // padding 6px = зона нажатия больше видимого ключа
    const el = document.createElement("button");
    el.className = "k";
    el.style.setProperty("--m", keySrc(shape));
    el.style.setProperty("--tint", pick(level.colors));
    el.style.setProperty("--r", `${rand(-level.rot, level.rot).toFixed(1)}deg`);
    if (!isTarget && rnd() < level.mirror) el.style.setProperty("--sx", "-1");
    el.style.width = `${box}px`;
    el.style.height = `${box}px`;
    el.style.left = `${Math.round(rand(24, FIELD_W - box - 24))}px`;
    el.style.top = `${Math.round(rand(24, FIELD_H - box - 24))}px`;
    el.style.zIndex = String(1 + Math.floor(rnd() * level.keys));
    if (isTarget) el.style.zIndex = String(level.keys + 1); // цель никогда не похоронена под приманками
    el.addEventListener("click", () => {
      if (!roundActive) return;
      el === targetEl ? win() : wrong(el);
    });
    if (isTarget) targetEl = el;
    frag.appendChild(el);
  }
  fieldEl.appendChild(frag);

  // показать сцену: зум в исходное и старт со случайной точки картины
  show("hunt");
  requestAnimationFrame(() => {
    setZoom(Z_MIN);
    fieldWrap.scrollLeft = rand(0, Math.max(0, FIELD_W - fieldWrap.clientWidth));
    fieldWrap.scrollTop = rand(0, Math.max(0, FIELD_H - fieldWrap.clientHeight));
  });

  // таймер
  totalMs = level.time * 1000;
  endAt = performance.now() + totalMs;
  roundActive = true;
  clearInterval(timerId);
  timerId = setInterval(tick, 100);
  tick();
}

function tick() {
  const left = Math.max(0, endAt - performance.now());
  const sec = Math.ceil(left / 1000);
  hudTime.textContent = String(sec);
  hudTime.classList.toggle("low", sec <= 10);
  timebar.style.transform = `scaleX(${left / totalMs})`;
  if (left <= 0) lose();
}

function wrong(el) {
  el.classList.remove("no");
  void el.offsetWidth; // перезапуск анимации
  el.classList.add("no");
  endAt -= 2000;
  penaltyEl.classList.add("show");
  clearTimeout(penaltyId);
  penaltyId = setTimeout(() => penaltyEl.classList.remove("show"), 700);
  tick();
}

function stopRound() {
  roundActive = false;
  clearInterval(timerId);
}

// ── итоги ────────────────────────────────────────────────────
function win() {
  stopRound();
  streak++;
  if (streak >= GOAL) {
    panel(
      "vii",
      "seven flawless hunts",
      "the room is speechless. it kept one promise it never thought it would have to — write to the artist and say the room sent you.",
      "return",
      () => {
        streak = 0;
        show("brief");
      },
    );
    return;
  }
  const left = GOAL - streak;
  panel(
    ROMAN[streak - 1],
    "the key surrendered",
    left === 1
      ? "one hunt remains. the room holds its breath."
      : `${left} hunts remain. the painting grows quieter.`,
    "next hunt",
    () => {
      buildPicks();
      show("choose");
    },
  );
}

function lose() {
  stopRound();
  const had = streak;
  streak = 0;
  // ✦ показать, где прятался ключ: подсветка + плавный скролл к нему
  revealTarget();
  setTimeout(() => {
    panel(
      "·",
      "the keys scattered",
      had > 0
        ? "the streak is broken. the key reveals itself — too late."
        : "time burned out. there it was, glowing in the paint.",
      "hunt again",
      () => {
        buildPicks();
        show("choose");
      },
    );
  }, 2100);
}

function revealTarget() {
  if (!targetEl) return;
  targetEl.classList.add("reveal");
  const x = targetEl.offsetLeft + targetEl.offsetWidth / 2;
  const y = targetEl.offsetTop + targetEl.offsetHeight / 2;
  fieldWrap.scrollTo({
    left: x * zoom - fieldWrap.clientWidth / 2,
    top: y * zoom - fieldWrap.clientHeight / 2,
    behavior: "smooth",
  });
}

function panel(roman, name, text, btn, onBtn) {
  pRoman.textContent = roman;
  pName.textContent = name;
  pText.textContent = text;
  pBtn.textContent = btn;
  pBtn.onclick = () => {
    veil.classList.remove("on");
    onBtn();
  };
  veil.classList.add("on");
}