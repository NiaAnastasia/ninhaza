// ── ninhaza · tarot ──────────────────────────────────────────
import DECK from "../data/tarot.json";

const BACK_URL = "/tarot/back.webp"; // рубашка (WebP из Squoosh)
const REVERSED_CHANCE = 0.28; // шанс перевёрнутой карты

// ── DOM ──────────────────────────────────────────────────────
const stages = {
  intro: document.getElementById("intro"),
  pick: document.getElementById("pick"),
  reading: document.getElementById("reading"),
};
const fanEl = document.getElementById("fan");
const pickHint = document.getElementById("pick-hint");
const revealBtn = document.getElementById("reveal-btn");
const slotsEl = document.getElementById("slots");
const readingHint = document.getElementById("reading-hint");
const againBtn = document.getElementById("again");

// ── state ────────────────────────────────────────────────────
let spreadSize = 1;
let shuffled = []; // порядок колоды в веере
let picked = []; // выбранные индексы веера

const LABELS = {
  1: ["your card"],
  3: ["past", "present", "future"],
};

// ── честный рандом (crypto) ──────────────────────────────────
function cryptoRandom() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(cryptoRandom() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── смена сцены ──────────────────────────────────────────────
function show(name) {
  Object.values(stages).forEach((s) => s.classList.remove("on"));
  stages[name].classList.add("on");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── 1 · выбор расклада ───────────────────────────────────────
document.querySelectorAll(".spread-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    spreadSize = Number(btn.dataset.spread);
    buildFan();
    show("pick");
  });
});

// ── 2 · веер ─────────────────────────────────────────────────
function buildFan() {
  shuffled = shuffle(DECK);
  picked = [];
  revealBtn.classList.remove("ready");
  fanEl.innerHTML = "";
  updateHint();

  const n = shuffled.length;
  for (let i = 0; i < n; i++) {
    const c = document.createElement("div");
    c.className = "fan-card";
    c.style.setProperty("--rot", `${(i - (n - 1) / 2) * 3.4}deg`);
    c.style.setProperty("--i", i); // ✦ каскадное появление веера
    c.style.setProperty("--back", `url("${BACK_URL}")`);
    c.setAttribute("role", "button");
    c.setAttribute("aria-label", "face-down card");
    c.tabIndex = 0;
    const toggle = () => togglePick(i, c);
    c.addEventListener("click", toggle);
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    fanEl.appendChild(c);
  }
}

function togglePick(i, el) {
  const at = picked.indexOf(i);
  if (at >= 0) {
    picked.splice(at, 1);
    el.classList.remove("sel");
  } else {
    if (picked.length >= spreadSize) return;
    picked.push(i);
    el.classList.add("sel");
  }
  updateHint();
  revealBtn.classList.toggle("ready", picked.length === spreadSize);
}

function updateHint() {
  const left = spreadSize - picked.length;
  pickHint.textContent =
    left === 0
      ? "the cards are chosen"
      : `choose ${left} card${left > 1 ? "s" : ""} · trust the hand`;
}

revealBtn.addEventListener("click", () => {
  if (picked.length !== spreadSize) return;
  // выбранные взлетают, остальные гаснут
  [...fanEl.children].forEach((el, i) => {
    if (!picked.includes(i)) el.classList.add("gone");
  });
  setTimeout(() => {
    buildReading();
    show("reading");
  }, 620);
});

// ── 3 · расклад ──────────────────────────────────────────────
function buildReading() {
  slotsEl.innerHTML = "";
  againBtn.classList.remove("ready");
  readingHint.style.opacity = 1;
  let flippedCount = 0;

  picked.forEach((fanIndex, slotIdx) => {
    const arcana = shuffled[fanIndex];
    const reversed = cryptoRandom() < REVERSED_CHANCE;

    const slot = document.createElement("div");
    slot.className = "slot";

    const label = document.createElement("p");
    label.className = "slot-label";
    label.textContent = LABELS[spreadSize][slotIdx];

    // карта
    const card = document.createElement("div");
    card.className = "card" + (reversed ? " rev" : "");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `turn card ${slotIdx + 1}`);
    card.tabIndex = 0;

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const back = document.createElement("div");
    back.className = "face face-back";
    back.style.backgroundImage = `url("${BACK_URL}")`;

    const front = document.createElement("div");
    front.className = "face face-front";
    const content = document.createElement("div");
    content.className = "flip-content";

    if (arcana.file) {
      const img = document.createElement("img");
      img.src = arcana.file;
      img.alt = arcana.name;
      img.loading = "lazy";
      img.decoding = "async";
      content.appendChild(img);
    } else {
      // аркан ещё не нарисован → туманная карта
      content.innerHTML = `
        <div class="fog-face">
          <div class="fog-layer"></div>
          <div class="fog-layer l2"></div>
          <span class="fog-roman">${arcana.roman}</span>
          <span class="fog-name">${arcana.name}</span>
          <span class="fog-hint">emerging from the mist</span>
        </div>`;
    }
    front.appendChild(content);
    inner.append(back, front);
    card.appendChild(inner);

    // толкование
    const meaning = document.createElement("div");
    meaning.className = "meaning";
    meaning.innerHTML = `
      <p class="m-name">${arcana.roman} · ${arcana.name}</p>
      <p class="m-pos">${reversed ? "reversed" : "upright"}</p>
      <p class="m-text">${reversed ? arcana.reversed : arcana.upright}</p>`;

    const flip = () => {
      if (card.classList.contains("flipped")) return;
      card.classList.add("flipped");
      slot.classList.add("open");
      flippedCount++;
      if (flippedCount === picked.length) {
        readingHint.style.opacity = 0;
        againBtn.classList.add("ready");
      }
    };
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });

    slot.append(label, card, meaning);
    slotsEl.appendChild(slot);
  });
}

againBtn.addEventListener("click", () => show("intro"));

// прогреваем рубашку — она нужна сразу
const preload = new Image();
preload.src = BACK_URL;