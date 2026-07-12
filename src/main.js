import * as THREE from "three";
import { checkGate } from "./gate.js";
import { startAmbient } from "./audio.js";
import works from "../data/works.json";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import gsap from "gsap";

// ── GOLDEN RATIO BACKGROUND (vanilla canvas) ─────────────────
const goldenCanvas = document.getElementById("golden");
const gCtx = goldenCanvas.getContext("2d");
const PHI = 1.6180339887;
let gT = 0;

// ✦ FIX: retina — канвас с учётом devicePixelRatio, иначе линии мыльные
function resizeGolden() {
  const dpr = Math.min(devicePixelRatio, 2);
  goldenCanvas.width = innerWidth * dpr;
  goldenCanvas.height = innerHeight * dpr;
  goldenCanvas.style.width = innerWidth + "px";
  goldenCanvas.style.height = innerHeight + "px";
  gCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeGolden();
window.addEventListener("resize", resizeGolden);

function drawGolden() {
  requestAnimationFrame(drawGolden);
  gT += 0.002;
  // Получаем амплитуду музыки
  let audioAmp = 0;
  if (window.audioAnalyser) {
    const dataArr = new Uint8Array(window.audioAnalyser.frequencyBinCount);
    window.audioAnalyser.getByteFrequencyData(dataArr);
    audioAmp = dataArr.reduce((a, b) => a + b, 0) / dataArr.length / 255;
  }

  gCtx.clearRect(0, 0, innerWidth, innerHeight);
  const cx = innerWidth / 2;
  const cy = innerHeight / 2;
  const maxR = Math.min(innerWidth, innerHeight) * 0.45;

  // ✦ FIX: масштаб орбит под размер экрана (на мобильном всё помещается)
  const k = Math.min(innerWidth, innerHeight) / 900;

  // ── Логарифмическая спираль ──
  for (let s = 0; s < 2; s++) {
    const offset = (s / 2) * Math.PI;
    gCtx.beginPath();
    for (let i = 0; i < 500; i++) {
      const angle = (i / 500) * Math.PI * 10 + gT * 0.2 + offset;
      const r =
        maxR *
        Math.exp(
          (-0.18 * (Math.PI * 10 - (i / 500) * Math.PI * 10)) / (Math.PI * 2),
        );
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) gCtx.moveTo(x, y);
      else gCtx.lineTo(x, y);
    }
    gCtx.strokeStyle =
      s === 0 ? "rgba(212,160,23,0.9)" : "rgba(100,140,255,0.7)";
    gCtx.lineWidth = 0.8;
    gCtx.stroke();
  }

  // ── Орбиты — чередуем сплошную и пунктир ──
  const orbits = [
    { r: 90, dash: [], color: "212,160,23", label: "φ¹" },
    { r: 145, dash: [4, 4], color: "168,170,176", label: "φ²" },
    { r: 200, dash: [], color: "212,160,23", label: "φ³" },
    { r: 265, dash: [2, 6], color: "100,140,255", label: "1.618" },
    { r: 340, dash: [], color: "168,170,176", label: "φ⁵" },
    { r: 420, dash: [6, 3, 1, 3], color: "212,160,23", label: "∞" },
  ];

  orbits.forEach((o, idx) => {
    const baseR = o.r * k;
    gCtx.save();
    gCtx.setLineDash(o.dash);
    gCtx.beginPath();
    gCtx.arc(cx, cy, baseR * (1 + audioAmp * (1 + idx * 0.3)), 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(${o.color}, 0.75)`;
    gCtx.lineWidth = 0.6;
    gCtx.stroke();
    gCtx.restore();

    // Цифры/метки на орбитах
    const labelAngle = gT * 0.03 + idx * 1.05;
    const lx = cx + (baseR + 8) * Math.cos(labelAngle);
    const ly = cy + (baseR + 8) * Math.sin(labelAngle);
    gCtx.font = "9px monospace";
    gCtx.fillStyle = `rgba(${o.color}, 0.45)`;
    gCtx.fillText(o.label, lx, ly);
  });

  // ── Числа Фибоначчи вдоль спирали ──
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
  fibs.forEach((n, i) => {
    const angle = i * 0.6 + gT * 0.1;
    const r = (30 + i * 38) * k;
    if (r > maxR) return;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    gCtx.font = "8px monospace";
    gCtx.fillStyle = `rgba(212,160,23,${0.15 + i * 0.03})`;
    gCtx.fillText(n, x, y);
  });

  // ── Планеты на орбитах ──
  const planets = [
    { r: 90, size: 5, speed: 2.2, color: "212,160,23", phase: 0 },
    { r: 145, size: 3.5, speed: 1.4, color: "100,140,255", phase: 1.2 },
    { r: 200, size: 6, speed: 0.9, color: "180,80,255", phase: 2.4 },
    { r: 265, size: 4, speed: 0.55, color: "212,160,23", phase: 0.8 },
    { r: 340, size: 3, speed: 0.32, color: "168,170,176", phase: 3.1 },
    { r: 420, size: 4, speed: 0.18, color: "100,180,255", phase: 1.7 },
    { r: 168, size: 2, speed: 4.5, color: "255,200,100", phase: 0.5 },
  ];

  planets.forEach((p) => {
    const angle = gT * p.speed + p.phase;
    const pr = p.r * k * (1 + audioAmp * 1.5);
    const x = cx + pr * Math.cos(angle);
    const y = cy + pr * Math.sin(angle);

    // Хвост
    for (let t = 1; t < 8; t++) {
      const ta = angle - t * 0.07;
      const tx = cx + p.r * k * Math.cos(ta);
      const ty = cy + p.r * k * Math.sin(ta);
      gCtx.beginPath();
      gCtx.arc(tx, ty, p.size * (1 - t / 16) * 0.7, 0, Math.PI * 2);
      gCtx.fillStyle = `rgba(${p.color},${(1 - t / 16) * 0.35})`;
      gCtx.fill();
    }

    // Свечение
    const grad = gCtx.createRadialGradient(x, y, 0, x, y, p.size * 5);
    grad.addColorStop(0, `rgba(${p.color},0.9)`);
    grad.addColorStop(0.5, `rgba(${p.color},0.3)`);
    grad.addColorStop(1, `rgba(${p.color},0)`);
    gCtx.beginPath();
    gCtx.arc(x, y, p.size * 5, 0, Math.PI * 2);
    gCtx.fillStyle = grad;
    gCtx.fill();

    // Ядро
    gCtx.beginPath();
    gCtx.arc(x, y, p.size, 0, Math.PI * 2);
    gCtx.fillStyle = `rgba(${p.color},1)`;
    gCtx.fill();
  });

  // ── Угловые расчёты по краям ──
  gCtx.font = "7px monospace";
  gCtx.fillStyle = "rgba(212,160,23,0.2)";
  const formulas = [
    "φ = 1.6180339887",
    "Fn = Fn-1 + Fn-2",
    "a/b = φ",
    "137.5°",
    "e^(iπ)+1=0",
  ];
  formulas.forEach((f, i) => {
    gCtx.fillText(f, 20, 30 + i * 16);
  });
}
drawGolden();

// ── CURSOR ──────────────────────────────────────────────────
const cur = document.getElementById("cursor");
const curR = document.getElementById("cursor-ring");
let mx = 0,
  my = 0,
  rx = 0,
  ry = 0;
document.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
  cur.style.left = mx + "px";
  cur.style.top = my + "px";
});
(function loopCur() {
  rx += (mx - rx) * 0.1;
  ry += (my - ry) * 0.1;
  curR.style.left = rx + "px";
  curR.style.top = ry + "px";
  requestAnimationFrame(loopCur);
})();

// ── RENDERER ────────────────────────────────────────────────
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false, // тени теперь внутри 3D-сцены, прозрачность не нужна
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x050407, 1);
renderer.shadowMap.enabled = true;
// ✦ FIX: ACES вместо Reinhard — глубже тени, насыщеннее золото
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85; // ✦ чуть тише свет под новую модель

// ── SCENE / CAMERA ──────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050407, 0.028);

const camera = new THREE.PerspectiveCamera(
  55,
  innerWidth / innerHeight,
  0.1,
  200,
);
// ✦ NEW: кинематографичный вход — начинаем издалека и медленно
// приближаемся к модели
camera.position.set(0, 1.6, 17);
gsap.to(camera.position, {
  y: 1,
  z: 9,
  duration: 5,
  delay: 0.4,
  ease: "power2.inOut",
});

// ── POSTPROCESSING: BLOOM ✦ NEW ─────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  0.17, // strength — сила свечения (приглушено)
  0.3, // radius — мягкость ореола
  0.93, // threshold — светятся только самые яркие точки
);
composer.addPass(bloomPass);

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ── CONTROLS ────────────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 18;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;
controls.target.set(0, 1, 0);

// ── LIGHTS ──────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x010208, 0.8));

const goldCore = new THREE.PointLight(0xffaa00, 8, 9);
goldCore.position.set(0, 1, 1);
scene.add(goldCore);

const blueKey = new THREE.PointLight(0x0033ff, 8, 14);
blueKey.position.set(0, -2, 2);
scene.add(blueKey);

const blueFront = new THREE.PointLight(0x1144ff, 10, 16);
blueFront.position.set(1, 2, 5);
scene.add(blueFront);

const goldRim = new THREE.PointLight(0xffcc00, 8, 12);
goldRim.position.set(-1, 1, -3);
scene.add(goldRim);

const goldLeft = new THREE.PointLight(0xff8800, 8, 10);
goldLeft.position.set(-3, 0, 2);
scene.add(goldLeft);

const rimLight = new THREE.PointLight(0x220044, 3, 22);
rimLight.position.set(0, 6, -10);
scene.add(rimLight);

// ── PARTICLES ────────────────────────────────────────────────
const N = 1200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(N * 3);
const pCol = new Float32Array(N * 3);
const pVel = new Float32Array(N * 3);
const pPh = new Float32Array(N);

const pal = [
  [0.1, 0.18, 1], // blue
  [0.83, 0.63, 0.09], // gold
  [0.66, 0.67, 0.69], // silver
  [0.05, 0.05, 0.22], // dark blue
];

for (let i = 0; i < N; i++) {
  const r = 5 + Math.random() * 11;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  pPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
  pPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.7;
  pPos[i * 3 + 2] = r * Math.cos(ph);
  pVel[i * 3] = (Math.random() - 0.5) * 0.002;
  pVel[i * 3 + 1] = (Math.random() - 0.5) * 0.001 + 0.0004;
  pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  pPh[i] = Math.random() * Math.PI * 2;
  const c = pal[Math.floor(Math.random() * pal.length)];
  pCol[i * 3] = c[0];
  pCol[i * 3 + 1] = c[1];
  pCol[i * 3 + 2] = c[2];
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));

const pMat = new THREE.PointsMaterial({
  size: 0.045,
  vertexColors: true,
  transparent: true,
  opacity: 0.7,
  sizeAttenuation: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const pts = new THREE.Points(pGeo, pMat);
scene.add(pts);

// ── 3D OBSERVATORY BACKDROP ✦ NEW ───────────────────────────
// Объёмная структура вокруг/позади фигуры: стопка эллиптических
// орбит с узлами и вертикальными связями (реф: астрономические
// чертежи) + золотая 3D-спираль. Медленно вращается в tick().
const observatory = new THREE.Group();
{
  const ringDefs = [
    { y: 6.0, r: 1.3 },
    { y: 4.6, r: 2.4 },
    { y: 3.0, r: 3.8 },
    { y: 1.4, r: 4.8 },
    { y: -0.2, r: 4.0 },
    { y: -1.8, r: 2.8 },
    { y: -3.4, r: 4.4 },
  ];

  const matGold = new THREE.LineBasicMaterial({
    color: 0xd4a017,
    transparent: true,
    opacity: 0.22,
  });
  const matSilver = new THREE.LineBasicMaterial({
    color: 0xa8aab0,
    transparent: true,
    opacity: 0.14,
  });
  const matBlue = new THREE.LineBasicMaterial({
    color: 0x4060ff,
    transparent: true,
    opacity: 0.16,
  });

  function makeRing(radius, y, mat) {
    const seg = 96;
    const arr = [];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      arr.push(
        new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius),
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(arr);
    return new THREE.Line(geo, mat);
  }

  const nodePositions = [];

  ringDefs.forEach((rd, i) => {
    // внешнее + внутреннее кольцо на каждом уровне
    observatory.add(makeRing(rd.r, rd.y, i % 2 === 0 ? matGold : matSilver));
    observatory.add(makeRing(rd.r * 0.45, rd.y, matBlue));

    // узлы на кольце
    const nodes = 6 + i * 2;
    for (let n = 0; n < nodes; n++) {
      const a = (n / nodes) * Math.PI * 2 + i * 0.7;
      nodePositions.push(Math.cos(a) * rd.r, rd.y, Math.sin(a) * rd.r);
    }
  });

  // вертикальная ось
  {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -4.2, 0),
      new THREE.Vector3(0, 6.8, 0),
    ]);
    observatory.add(new THREE.Line(geo, matSilver));
  }

  // вертикальные связи между соседними уровнями
  for (let i = 0; i < ringDefs.length - 1; i++) {
    const a = ringDefs[i];
    const b = ringDefs[i + 1];
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2 + i * 1.1;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(ang) * a.r, a.y, Math.sin(ang) * a.r),
        new THREE.Vector3(Math.cos(ang) * b.r, b.y, Math.sin(ang) * b.r),
      ]);
      observatory.add(new THREE.Line(geo, k % 2 === 0 ? matGold : matSilver));
    }
  }

  // светящиеся узлы
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(nodePositions, 3),
  );
  const nMat = new THREE.PointsMaterial({
    size: 0.06,
    color: 0xf5c842,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  observatory.add(new THREE.Points(nGeo, nMat));

  // золотая 3D-спираль (логарифмическая), наклонена за фигурой
  {
    const arr = [];
    const turns = 5;
    const steps = 400;
    for (let s = 0; s < steps; s++) {
      const t2 = s / steps;
      const a = t2 * Math.PI * 2 * turns;
      const r = 0.15 * Math.exp(0.28 * a * 0.5);
      if (r > 7) break;
      arr.push(
        new THREE.Vector3(Math.cos(a) * r, t2 * 1.5 - 0.5, Math.sin(a) * r),
      );
    }
    const geo = new THREE.BufferGeometry().setFromPoints(arr);
    const spiral = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xd4a017,
        transparent: true,
        opacity: 0.3,
      }),
    );
    spiral.rotation.x = Math.PI / 2.6;
    spiral.position.set(0, 1.2, -3.5);
    observatory.add(spiral);
  }

  observatory.position.set(0, 0.8, 0);
  observatory.rotation.x = 0.06; // лёгкий наклон как на чертежах
  scene.add(observatory);
}

// ── LOAD GLB ─────────────────────────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/",
);

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

let demon = null;

loader.load(
  "/models/Shedevr1-v1.glb",
  (gltf) => {
    demon = gltf.scene;

    // Centre model
    const box = new THREE.Box3().setFromObject(demon);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4.5 / maxDim;
    demon.scale.setScalar(scale);
    demon.position.sub(centre.multiplyScalar(scale));
    demon.position.y += 0.5;

    // ✦ FIX: запоминаем базовые значения — дыхание считается от них,
    // модель больше не "разрастается" со временем
    demon.userData.baseScale = scale;
    demon.userData.baseY = demon.position.y;
    demon.userData.pulse = 1;

    // Enhance materials
    demon.traverse((child) => {
      if (child.isMesh && child.material) {
        const m = child.material;
        m.envMapIntensity = 1.2;
        if (m.color) {
          // Boost blues
          if (m.color.b > m.color.r && m.color.b > m.color.g) {
            m.color.multiplyScalar(1.15);
          }
        }
      }
    });

    scene.add(demon);

    // Reveal splash
    setTimeout(() => {
      document.getElementById("splash").classList.add("on");
    }, 300);
  },
  (xhr) =>
    console.log(`Loading: ${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`),
  (err) => {
    console.error("GLB error:", err);
    // Show splash anyway
    setTimeout(
      () => document.getElementById("splash").classList.add("on"),
      300,
    );
  },
);

// ── AUDIO ────────────────────────────────────────────────────
// ✦ NEW: заглавный экран теперь играет спокойный трек из файла
// /public/audio/ambient.mp3. Если файла нет — fallback на старый
// генеративный орган-дрон, так что ничего не сломается.
let audioCtx = null,
  audioOn = false,
  ambientEl = null;

function startAudio() {
  if (audioOn) return;
  audioOn = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Анализатор для визуализации
  window.audioAnalyser = audioCtx.createAnalyser();
  window.audioAnalyser.fftSize = 256;

  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0, audioCtx.currentTime);
  master.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 4);

  // ✦ FIX: линейная цепочка master → analyser → выход
  // (раньше сигнал шёл двумя путями и звук дублировался)
  master.connect(window.audioAnalyser);
  window.audioAnalyser.connect(audioCtx.destination);

  // Пытаемся загрузить спокойный трек
  ambientEl = new Audio("/audio/ambient.mp3");
  ambientEl.loop = true;

  // Продолжаем с той позиции, где трек был на предыдущей странице
  const savedPos = parseFloat(sessionStorage.getItem("ambient-pos") || "0");
  if (savedPos > 0) ambientEl.currentTime = savedPos;

  setInterval(() => {
    if (!ambientEl.paused) {
      sessionStorage.setItem("ambient-pos", ambientEl.currentTime.toString());
      sessionStorage.setItem("ambient-on", "1");
    }
  }, 1000);

  ambientEl.addEventListener("error", () => startDrones(master));

  ambientEl
    .play()
    .then(() => {
      const src = audioCtx.createMediaElementSource(ambientEl);
      src.connect(master);
    })
    .catch(() => startDrones(master));
}

// Старый генеративный орган — теперь fallback
let dronesStarted = false;
function startDrones(master) {
  if (dronesStarted || !audioCtx) return;
  dronesStarted = true;

  // Reverb
  const conv = audioCtx.createConvolver();
  const irLen = audioCtx.sampleRate * 5;
  const irBuf = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = irBuf.getChannelData(ch);
    for (let i = 0; i < irLen; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.2);
  }
  conv.buffer = irBuf;
  const wet = audioCtx.createGain();
  wet.gain.value = 0.65;
  const dry = audioCtx.createGain();
  dry.gain.value = 0.35;
  conv.connect(wet);
  wet.connect(master);
  dry.connect(master);

  // Drones — minor cluster
  const freqs = [54.5, 73.4, 110, 130.8, 164.8, 220];
  freqs.forEach((f, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();
    osc.type = i % 3 === 0 ? "sawtooth" : i % 3 === 1 ? "triangle" : "sine";
    osc.frequency.value = f;
    osc.detune.value = (Math.random() - 0.5) * 12;
    filt.type = "lowpass";
    filt.frequency.value = 500 + i * 150;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(
      [0.15, 0.1, 0.08, 0.07, 0.05, 0.04][i],
      audioCtx.currentTime + 3 + i * 0.4,
    );
    // LFO
    const lfo = audioCtx.createOscillator();
    const lfoG = audioCtx.createGain();
    lfo.frequency.value = 0.06 + i * 0.025;
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG);
    lfoG.connect(gain.gain);
    lfo.start();
    osc.connect(filt);
    filt.connect(gain);
    gain.connect(dry);
    filt.connect(conv);
    osc.start();
  });

  // Low rumble
  const nBuf = audioCtx.createBuffer(
    1,
    audioCtx.sampleRate * 2,
    audioCtx.sampleRate,
  );
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const nSrc = audioCtx.createBufferSource();
  nSrc.buffer = nBuf;
  nSrc.loop = true;
  const nF = audioCtx.createBiquadFilter();
  nF.type = "bandpass";
  nF.frequency.value = 70;
  nF.Q.value = 0.4;
  const nG = audioCtx.createGain();
  nG.gain.value = 0.05;
  nSrc.connect(nF);
  nF.connect(nG);
  nG.connect(master);
  nSrc.start();
}

// ── SHOCKWAVE on CLICK ───────────────────────────────────────
const shockEl = document.getElementById("shockwave");

function triggerShock(x, y) {
  // CSS position
  shockEl.style.setProperty("--sx", (x / innerWidth) * 100 + "%");
  shockEl.style.setProperty("--sy", (y / innerHeight) * 100 + "%");
  shockEl.classList.add("active");

  // Ripple rings
  createRipple(x, y);

  // ✦ FIX: пульс через userData.pulse — не ломает базовый масштаб
  if (demon) {
    gsap.to(demon.userData, {
      pulse: 1.06,
      duration: 0.12,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
    });
    // Flash lights
    gsap.to(blueKey, { intensity: 13, duration: 0.08, yoyo: true, repeat: 3 });
    gsap.to(goldCore, { intensity: 11, duration: 0.1, yoyo: true, repeat: 2 });
  }

  // Burst particles from click point
  burstParticles(x, y);

  // Формулы при клике
  spawnFormulas(x, y);

  // Линии при клике
  spawnLines(x, y);

  setTimeout(() => shockEl.classList.remove("active"), 400);
}

// ── WHISPERS ─────────────────────────────────────────────────
const whisperWords = [
  // English — touch
  "touch",
  "touch",
  "touch",
  "touch",
  "feel",
  "feel",
  "sense",
  "ninhaza",
  "open",
  "open",
  "awaken",
  "awaken",
  "enter",
  "come",
  "come closer",
  "see",
  "hear",
  "breathe",
  "let go",
  "surrender",
  "witness",
  "behold",
  // French
  "ouvrir",
  "ouvrir",
  "toucher",
  "ressentir",
  "entrer",
  "voir",
  "écouter",
  "sentir",
  "approche",
  // Art & tech
  "generative",
  "algorithm",
  "φ",
  "recursion",
  "emergence",
  "entropy",
  "fractal",
  "topology",
  "sculpture",
  "form",
  "void",
  "matter",
  "signal",
  "noise",
  "data",
  "code",
  // Russian
  "откройся",
  "войди",
  "почувствуй",
  "увидь",
  "коснись",
  // Japanese
  "触れる",
  "開く",
  "感じる",
  // Dots
  "...",
  "...",
  "...",
  "·",
  "·",
];

// ✦ FIX: шёпоты стали редкими — 3–6 слов раз в 6–10 секунд,
// экран больше не захламляется текстом
function spawnWhispers() {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const word =
        whisperWords[Math.floor(Math.random() * whisperWords.length)];
      const div = document.createElement("div");
      const x = 5 + Math.random() * 90;
      const y = 5 + Math.random() * 90;
      const size = 8 + Math.random() * 18;
      const opacity = 0.08 + Math.random() * 0.25;
      div.textContent = word;
      div.style.cssText = `
        position: fixed;
        left: ${x}vw;
        top: ${y}vh;
        font-family: 'Georgia', serif;
        font-size: ${size}px;
        color: rgba(212,160,23,1);
        letter-spacing: ${0.2 + Math.random() * 0.5}em;
        text-transform: lowercase;
        pointer-events: none;
        z-index: 6;
        opacity: 0;
        white-space: nowrap;
      `;
      document.body.appendChild(div);

      gsap.to(div, {
        opacity: opacity,
        duration: 1.5 + Math.random(),
        ease: "power1.out",
        onComplete: () =>
          gsap.to(div, {
            opacity: 0,
            duration: 2 + Math.random() * 2,
            delay: 1 + Math.random() * 2,
            onComplete: () => div.remove(),
          }),
      });
    }, i * 400);
  }
  // следующая волна через 6–10 секунд
  setTimeout(spawnWhispers, 6000 + Math.random() * 4000);
}
spawnWhispers();

// ── SHADOW THEATRE: ANIMATED PROCESSION ✦ V3 ────────────────
// Анимированные спрайт-шиты (Procreate) + статичные png.
// Силуэты идут процессией по орбите золотого сечения. У спрайтов
// есть кадры РАСПАДА — при клике тень сначала проигрывает свой
// распад, потом рассыпается в формулы, и на её место выходит
// другой персонаж.
//
// Файлы в public/shadows/:
//   bird_spritesheet.png  (6×4, 24 кадра полёта)
//   dragon_spritesheet.png (4×2: 4 полёт + 4 распад)
//   knight_spritesheet.png (5×3: 9 скачка + 6 распад)
//   + статичные: horse.png, bird-2.png, bird-3.png, window.png

// спрайт-шиты: белое на чёрном → используем как альфа-маску
const SPRITES = {
  bird: {
    url: "/shadows/bird_spritesheet.png",
    cols: 6,
    rows: 4,
    frames: 23,
    loop: 23,
    fps: 8,
    width: 1.4,
  },
  dragon: {
    url: "/shadows/dragon_spritesheet.png",
    cols: 4,
    rows: 2,
    frames: 8,
    loop: 4,
    fps: 4.5,
    width: 3.4,
  },
  knight: {
    url: "/shadows/knight_spritesheet.png",
    cols: 5,
    rows: 3,
    frames: 15,
    loop: 9,
    fps: 6,
    width: 2.8,
  },
};

// статичные png (чёрный силуэт на прозрачном фоне)
const SHADOW_PNG = {
  horse: "/shadows/horse.png",
  bird2: "/shadows/bird-2.png",
  bird3: "/shadows/bird-3.png",
  window: "/shadows/window.png",
};

const SHADOW_WIDTH = { horse: 2.4, bird2: 1.3, bird3: 1.3, window: 4.2 };
const SHADOW_COLOR = 0x07060f; // цвет тени для спрайтов

const shadowGroup = new THREE.Group();
scene.add(shadowGroup);
const shadowMeshes = [];

// мягкий тёплый "экран" за фигурой
{
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x2 = c.getContext("2d");
  const grd = x2.createRadialGradient(256, 256, 0, 256, 256, 256);
  grd.addColorStop(0, "rgba(232,200,140,0.2)");
  grd.addColorStop(0.55, "rgba(212,160,23,0.06)");
  grd.addColorStop(1, "rgba(212,160,23,0)");
  x2.fillStyle = grd;
  x2.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  mat.fog = false;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat);
  screen.scale.y = 0.62;
  screen.position.set(0, 0.6, -12);
  screen.renderOrder = 0;
  shadowGroup.add(screen);
}

// ── загрузка ────────────────────────────────────────────────
const spriteSheets = {}; // type -> { tex, cfg }
const staticTextures = {}; // type -> THREE.Texture

function loadAllShadows(done) {
  let pending = Object.keys(SPRITES).length + Object.keys(SHADOW_PNG).length;
  const tick2 = () => {
    if (--pending === 0) done();
  };

  Object.entries(SPRITES).forEach(([type, cfg]) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      spriteSheets[type] = { tex, cfg };
      tick2();
    };
    img.onerror = tick2;
    img.src = cfg.url;
  });

  Object.entries(SHADOW_PNG).forEach(([type, url]) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      staticTextures[type] = tex;
      tick2();
    };
    img.onerror = tick2;
    img.src = url;
  });
}

// выставить кадр спрайта (offset в UV)
function setSpriteFrame(tex, cfg, f) {
  const col = f % cfg.cols;
  const row = Math.floor(f / cfg.cols);
  tex.offset.set(col / cfg.cols, 1 - (row + 1) / cfg.rows);
}

function makeShadowMesh(type, kind) {
  let mesh;
  if (spriteSheets[type]) {
    // анимированный спрайт: alphaMap = белое→видимо, чёрное→прозрачно
    const { tex, cfg } = spriteSheets[type];
    const myTex = tex.clone();
    myTex.needsUpdate = true;
    myTex.repeat.set(1 / cfg.cols, 1 / cfg.rows);
    setSpriteFrame(myTex, cfg, 0);
    const cellAspect =
      tex.image.width / cfg.cols / (tex.image.height / cfg.rows);
    const w = cfg.width;
    const h = w / cellAspect;
    const mat = new THREE.MeshBasicMaterial({
      color: SHADOW_COLOR,
      alphaMap: myTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.fog = false;
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    // ✦ ПЛАВНОСТЬ: второй слой со СЛЕДУЮЩИМ кадром — кадры
    // перетекают друг в друга кросс-фейдом, а не щёлкают
    const texB = tex.clone();
    texB.needsUpdate = true;
    texB.repeat.set(1 / cfg.cols, 1 / cfg.rows);
    setSpriteFrame(texB, cfg, 1 % cfg.loop);
    const matB = mat.clone();
    matB.alphaMap = texB;
    matB.fog = false;
    const child = new THREE.Mesh(mesh.geometry, matB);
    child.position.z = 0.001;
    child.renderOrder = 1;
    mesh.add(child);
    mesh.userData.spriteChild = child;
    mesh.userData.sprite = {
      tex: myTex,
      texB,
      cfg,
      phase: Math.random() * 100,
      dying: null,
      frac: 0,
    };
    mesh.userData.halfH = h / 2;
  } else if (staticTextures[type]) {
    const tex = staticTextures[type];
    const w = SHADOW_WIDTH[type] || 2;
    const img = tex.image;
    const h = img && img.width ? (w * img.height) / img.width : w * 0.7;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.fog = false;
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.userData.halfH = h / 2;
  } else {
    return null;
  }
  mesh.userData.kind = kind || "procession";
  mesh.userData.type = type;
  mesh.userData.alive = 1;
  mesh.userData.baseOpacity = 0.9;
  mesh.renderOrder = 1;
  shadowGroup.add(mesh);
  shadowMeshes.push(mesh);
  return mesh;
}

function removeShadowMesh(mesh) {
  const i = shadowMeshes.indexOf(mesh);
  if (i !== -1) shadowMeshes.splice(i, 1);
  shadowGroup.remove(mesh);
  mesh.geometry.dispose();
  if (mesh.userData.sprite) {
    mesh.userData.sprite.tex.dispose();
    if (mesh.userData.sprite.texB) mesh.userData.sprite.texB.dispose();
  }
  if (mesh.userData.spriteChild) mesh.userData.spriteChild.material.dispose();
  mesh.material.dispose();
}

// ── клик: луч из камеры ─────────────────────────────────────
const shadowRaycaster = new THREE.Raycaster();
const shadowNdc = new THREE.Vector2();
function hitShadowAt(x, y) {
  shadowNdc.x = (x / innerWidth) * 2 - 1;
  shadowNdc.y = -(y / innerHeight) * 2 + 1;
  shadowRaycaster.setFromCamera(shadowNdc, camera);
  const hits = shadowRaycaster.intersectObjects(shadowMeshes, false);
  for (const h of hits) {
    if (h.object.userData.dead) continue;
    explodeShadow(h.object, x, y);
    return true;
  }
  return false;
}

function explodeShadow(mesh, x, y) {
  if (mesh.userData.dead) return;
  spawnFormulas(x, y);
  createRipple(x, y);
  startDissolve(mesh);
}

function finishExplode(mesh) {
  dissolveParticles(mesh); // ✦ тень рассыпается на мелкие частицы
  gsap.to(mesh.userData, {
    alive: 0,
    duration: 1.8, // долгое плавное растворение
    ease: "power1.out",
    onComplete: () => {
      if (mesh.userData.kind === "bird-free") {
        removeShadowMesh(mesh);
      } else if (mesh.userData.kind === "procession") {
        const slot = procession.find((p) => p.mesh === mesh);
        if (slot) setTimeout(() => respawnSlot(slot), 2500);
      } else {
        // окно возвращается на месте
        setTimeout(() => {
          mesh.userData.dead = false;
          if (mesh.userData.sprite) mesh.userData.sprite.dying = null;
          gsap.to(mesh.userData, { alive: 1, duration: 2 });
        }, 4500);
      }
    },
  });
}

// облачко мелких частиц на месте растворяющейся тени
function dissolveParticles(mesh) {
  const count = 34;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  const origin = new THREE.Vector3();
  mesh.getWorldPosition(origin);
  const spread = mesh.userData.halfH || 0.8;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = origin.x + (Math.random() - 0.5) * spread * 2;
    pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread * 1.6;
    pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.4;
    vel.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.012,
        0.004 + Math.random() * 0.012,
        (Math.random() - 0.5) * 0.008,
      ),
    );
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.06,
    color: 0xd4a017,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mat.fog = false;
  const pts2 = new THREE.Points(geo, mat);
  shadowGroup.add(pts2);

  let life = 0;
  (function anim() {
    life += 0.012;
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += vel[i].x;
      arr[i * 3 + 1] += vel[i].y;
      arr[i * 3 + 2] += vel[i].z;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 0.55 * (1 - life));
    if (life < 1) requestAnimationFrame(anim);
    else {
      shadowGroup.remove(pts2);
      geo.dispose();
      mat.dispose();
    }
  })();
}

// ── ПРОЦЕССИЯ ───────────────────────────────────────────────
let castTypes = [];
const procession = []; // { mesh, slotPhase, bobPhase }
const PROCESSION_SLOTS = 5;
const ORBIT_RX = 6.8;
const ORBIT_RZ = 2.3;
const ORBIT_Y = -0.7;
const ORBIT_SPEED = 0.17; // очень медленное течение

// тень живёт 12–26 секунд, затем сама доигрывает кадры распада
// и растворяется в частицы
function scheduleLife(mesh) {
  const life = 12000 + Math.random() * 14000;
  setTimeout(() => {
    if (!mesh.userData.dead && mesh.parent) startDissolve(mesh);
  }, life);
}

function startDissolve(mesh) {
  mesh.userData.dead = true;
  const sp = mesh.userData.sprite;
  if (sp && sp.cfg.frames > sp.cfg.loop) {
    // кадры распада — медленнее обычного цикла
    sp.dying = {
      start: performance.now() / 1000,
      finished: false,
      fps: sp.cfg.fps * 0.7,
    };
  } else {
    finishExplode(mesh);
  }
}

function pickCastType(exclude) {
  const pool = castTypes.filter((t) => t !== exclude);
  return pool.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : castTypes[0];
}

function respawnSlot(slot) {
  const newType = pickCastType(slot.mesh.userData.type);
  removeShadowMesh(slot.mesh);
  const m = makeShadowMesh(newType, "procession");
  m.userData.alive = 0;
  // ✦ появляется с новой, случайной стороны орбиты
  slot.slotPhase = Math.random() * Math.PI * 2;
  slot.spiralPhase = Math.random() * Math.PI * 2;
  slot.dirS = 1;
  slot.mesh = m;
  gsap.to(m.userData, { alive: 1, duration: 3, ease: "power1.out" });
  scheduleLife(m);
}

function initShadows() {
  castTypes = [
    ...Object.keys(SPRITES).filter((t) => spriteSheets[t]),
    ...Object.keys(SHADOW_WIDTH).filter(
      (t) => t !== "window" && staticTextures[t],
    ),
  ];
  if (!castTypes.length) return;

  let prev = null;
  for (let i = 0; i < PROCESSION_SLOTS; i++) {
    const type = pickCastType(prev);
    prev = type;
    const m = makeShadowMesh(type, "procession");
    if (!m) continue;
    m.userData.alive = 0;
    gsap.to(m.userData, {
      alive: 1,
      duration: 2.4,
      delay: 0.6 + i * 0.45,
      ease: "power1.out",
    });
    procession.push({
      mesh: m,
      slotPhase: (i / PROCESSION_SLOTS) * Math.PI * 2,
      bobPhase: Math.random() * Math.PI * 2,
      spiralPhase: Math.random() * Math.PI * 2,
      dirS: 1,
    });
    scheduleLife(m);
  }

  if (staticTextures.window) {
    const win = makeShadowMesh("window", "window");
    win.position.set(0, 1.7, -9.5);
    win.userData.baseOpacity = 0.35;
  }

  // ── стая: птицы чаще и по несколько ──
  setInterval(() => {
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) setTimeout(spawnFreeBird, i * 900);
  }, 6000);
  for (let i = 0; i < 3; i++) setTimeout(spawnFreeBird, 1500 + i * 1200);
}

function spawnFreeBird() {
  const birds = castTypes.filter((t) => t.startsWith("bird"));
  if (!birds.length) return;
  const type = birds[Math.floor(Math.random() * birds.length)];
  const m = makeShadowMesh(type, "bird-free");
  if (!m) return;
  const fromLeft = Math.random() > 0.5;
  m.position.set(fromLeft ? -11 : 11, 3 + Math.random() * 2, -8);
  m.scale.x = fromLeft ? 1 : -1;
  m.userData.dir = fromLeft ? 1 : -1;
  m.userData.baseOpacity = 0.75;
  m.userData.alive = 0;
  const dur = 16 + Math.random() * 6;
  gsap.to(m.userData, { alive: 1, duration: 1.6, ease: "power1.out" });
  gsap.to(m.userData, {
    alive: 0,
    duration: 1.8,
    delay: dur - 2,
    ease: "power1.in",
  });
  gsap.to(m.position, {
    x: fromLeft ? 11 : -11,
    duration: dur,
    ease: "none",
    onComplete: () => removeShadowMesh(m),
  });
}

// обновление кадра спрайта: ДРОБНЫЙ кадр, соседние кадры
// смешиваются по прозрачности → плавное непрерывное движение
function advanceSprite(mesh, nowSec) {
  const sp = mesh.userData.sprite;
  if (!sp) return;
  const { cfg } = sp;
  let ft;
  if (sp.dying) {
    ft = cfg.loop + (nowSec - sp.dying.start) * (sp.dying.fps || cfg.fps);
    if (ft >= cfg.frames - 1) {
      ft = cfg.frames - 1;
      if (!sp.dying.finished) {
        sp.dying.finished = true;
        finishExplode(mesh);
      }
    }
  } else {
    ft = (nowSec * cfg.fps + sp.phase) % cfg.loop;
  }
  const fA = Math.floor(ft);
  const fB = sp.dying ? Math.min(fA + 1, cfg.frames - 1) : (fA + 1) % cfg.loop;
  sp.frac = ft - fA;
  setSpriteFrame(sp.tex, cfg, fA);
  setSpriteFrame(sp.texB, cfg, fB);
}

// прозрачность с учётом кросс-фейда между кадрами
function applyShadowOpacity(m) {
  const o = m.userData.baseOpacity * m.userData.alive;
  const sp = m.userData.sprite;
  if (sp && m.userData.spriteChild) {
    m.material.opacity = o * (1 - sp.frac);
    m.userData.spriteChild.material.opacity = o * sp.frac;
  } else {
    m.material.opacity = o;
  }
}

// вызывается из tick(): карусель + анимация кадров
function updateShadows(tt) {
  const nowSec = performance.now() / 1000;

  procession.forEach((p) => {
    const m = p.mesh;
    const a = tt * ORBIT_SPEED + p.slotPhase;
    // ✦ спиральная орбита: радиус дышит по золотому отношению,
    // а сами фигуры плавно поднимаются и опускаются вдоль витков
    const breathe = 1 + 0.22 * Math.sin(a * 0.618 + p.spiralPhase);
    m.position.x = Math.cos(a) * ORBIT_RX * breathe;
    m.position.z = -6 - Math.sin(a) * ORBIT_RZ * breathe;
    m.position.y =
      ORBIT_Y +
      m.userData.halfH +
      Math.sin(a * 0.8 + p.spiralPhase) * 0.55 +
      Math.sin(tt * 3 + p.bobPhase) * 0.06;

    const depth = (Math.sin(a) + 1) / 2;
    const s = 0.65 + (1 - depth) * 0.5;
    // ✦ ПЛАВНОСТЬ: разворот не мгновенный — фигура переворачивается
    // через "плоское" положение, как карта
    const dirTarget = -Math.sin(a) >= 0 ? 1 : -1;
    p.dirS += (dirTarget - p.dirS) * 0.06;
    m.scale.set(s * p.dirS, s, 1);
    m.userData.baseOpacity = 0.4 + (1 - depth) * 0.55;
    advanceSprite(m, nowSec);
    applyShadowOpacity(m);
  });

  for (const m of shadowMeshes) {
    if (m.userData.kind === "procession") continue;
    if (m.userData.kind === "bird-free") {
      m.scale.x = Math.abs(m.scale.x) * (m.userData.dir || 1);
      advanceSprite(m, nowSec);
    }
    applyShadowOpacity(m);
  }
}

loadAllShadows(initShadows);

// ── SPAWN FORMULAS ───────────────────────────────────────────
const mathFormulas = [
  "φ = 1.618",
  "∑∞",
  "∇f = 0",
  "e^iπ = -1",
  "ds²",
  "∂/∂t",
  "Δx·Δp ≥ ℏ/2",
  "E = mc²",
  "∮E·dA",
  "iℏ∂ψ/∂t",
  "Rμν = 0",
  "λ = h/p",
  "F = ma",
  "∇²φ = 0",
  "p = mv",
  "S = kln Ω",
];

// ── CLICK LINES BURST ────────────────────────────────────────
function spawnLines(sx, sy) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.cssText = `
    position: fixed; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 7;
    overflow: visible;
  `;
  document.body.appendChild(svg);

  const types = ["dna", "chromosome", "wave", "spiral", "helix"];
  const count = 8 + Math.floor(Math.random() * 6);

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const length = 200 + Math.random() * 400;
    const color = Math.random() > 0.5 ? "212,160,23" : "100,140,255";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    let d = "";
    const ex = sx + Math.cos(angle) * length;
    const ey = sy + Math.sin(angle) * length;

    if (type === "dna") {
      // ДНК двойная спираль
      const steps = 20;
      let d1 = `M ${sx} ${sy}`;
      let d2 = `M ${sx} ${sy}`;
      const crossLines = [];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = sx + Math.cos(angle) * length * t;
        const py = sy + Math.sin(angle) * length * t;
        const perp = angle + Math.PI / 2;
        const wave = Math.sin(t * Math.PI * 4) * 15;
        const px1 = px + Math.cos(perp) * wave;
        const py1 = py + Math.sin(perp) * wave;
        const px2 = px - Math.cos(perp) * wave;
        const py2 = py - Math.sin(perp) * wave;
        d1 += ` L ${px1} ${py1}`;
        d2 += ` L ${px2} ${py2}`;
        if (s % 3 === 0) crossLines.push([px1, py1, px2, py2]);
      }
      // Первая нить
      const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p1.setAttribute("d", d1);
      p1.setAttribute("stroke", `rgba(${color},0.8)`);
      p1.setAttribute("stroke-width", "1.2");
      p1.setAttribute("fill", "none");
      p1.setAttribute("stroke-dasharray", `${length * 2}`);
      p1.setAttribute("stroke-dashoffset", `${length * 2}`);
      svg.appendChild(p1);
      gsap.to(p1, {
        attr: { "stroke-dashoffset": 0 },
        duration: 1,
        ease: "power2.out",
        onComplete: () =>
          gsap.to(p1, {
            opacity: 0,
            duration: 0.5,
            delay: 0.8,
            onComplete: () => p1.remove(),
          }),
      });
      // Вторая нить
      const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p2.setAttribute("d", d2);
      p2.setAttribute("stroke", `rgba(100,140,255,0.6)`);
      p2.setAttribute("stroke-width", "1.2");
      p2.setAttribute("fill", "none");
      p2.setAttribute("stroke-dasharray", `${length * 2}`);
      p2.setAttribute("stroke-dashoffset", `${length * 2}`);
      svg.appendChild(p2);
      gsap.to(p2, {
        attr: { "stroke-dashoffset": 0 },
        duration: 1,
        delay: 0.1,
        ease: "power2.out",
        onComplete: () =>
          gsap.to(p2, {
            opacity: 0,
            duration: 0.5,
            delay: 0.8,
            onComplete: () => p2.remove(),
          }),
      });
      // Перемычки
      crossLines.forEach(([x1, y1, x2, y2], ci) => {
        const cl = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        cl.setAttribute("x1", x1);
        cl.setAttribute("y1", y1);
        cl.setAttribute("x2", x2);
        cl.setAttribute("y2", y2);
        cl.setAttribute("stroke", `rgba(212,160,23,0.4)`);
        cl.setAttribute("stroke-width", "0.8");
        cl.style.opacity = 0;
        svg.appendChild(cl);
        gsap.to(cl, {
          opacity: 1,
          duration: 0.2,
          delay: 0.3 + ci * 0.05,
          onComplete: () =>
            gsap.to(cl, {
              opacity: 0,
              duration: 0.5,
              delay: 1,
              onComplete: () => cl.remove(),
            }),
        });
      });
      continue;
    } else if (type === "chromosome") {
      // Х-образная хромосома
      const cx = (sx + ex) / 2;
      const cy2 = (sy + ey) / 2;
      const perp = angle + Math.PI / 2;
      const arm = 40;
      d = `M ${sx} ${sy} Q ${cx + Math.cos(perp) * 20} ${cy2 + Math.sin(perp) * 20} ${ex} ${ey}
           M ${cx + Math.cos(perp) * arm} ${cy2 + Math.sin(perp) * arm}
           Q ${cx} ${cy2} ${cx - Math.cos(perp) * arm} ${cy2 - Math.sin(perp) * arm}`;
    } else if (type === "wave") {
      // Синусоидальная волна
      let ptsStr = `M ${sx} ${sy}`;
      const steps = 30;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = sx + Math.cos(angle) * length * t;
        const py = sy + Math.sin(angle) * length * t;
        const perp = angle + Math.PI / 2;
        const w = Math.sin(t * Math.PI * 6) * 12;
        ptsStr += ` L ${px + Math.cos(perp) * w} ${py + Math.sin(perp) * w}`;
      }
      d = ptsStr;
    } else if (type === "spiral") {
      // Расходящаяся спираль
      let ptsStr = `M ${sx} ${sy}`;
      const steps = 40;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const r = t * length * 0.4;
        const a = angle + t * Math.PI * 3;
        ptsStr += ` L ${sx + Math.cos(a) * r} ${sy + Math.sin(a) * r}`;
      }
      d = ptsStr;
    } else {
      // Helix — одна нить с изгибами
      let ptsStr = `M ${sx} ${sy}`;
      const steps = 25;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = sx + Math.cos(angle) * length * t;
        const py = sy + Math.sin(angle) * length * t;
        const perp = angle + Math.PI / 2;
        const w = Math.sin(t * Math.PI * 5) * (10 + t * 15);
        ptsStr += ` L ${px + Math.cos(perp) * w} ${py + Math.sin(perp) * w}`;
      }
      d = ptsStr;
    }

    path.setAttribute("d", d);
    path.setAttribute("stroke", `rgba(${color},${0.5 + Math.random() * 0.4})`);
    path.setAttribute("stroke-width", `${0.6 + Math.random() * 1.2}`);
    path.setAttribute("fill", "none");

    const totalLen = 600;
    path.setAttribute("stroke-dasharray", `${totalLen}`);
    path.setAttribute("stroke-dashoffset", `${totalLen}`);
    svg.appendChild(path);

    gsap.to(path, {
      attr: { "stroke-dashoffset": 0 },
      duration: 0.8 + Math.random() * 0.6,
      delay: i * 0.05,
      ease: "power2.out",
      onComplete: () =>
        gsap.to(path, {
          opacity: 0,
          duration: 0.6,
          delay: 0.8 + Math.random() * 0.5,
          onComplete: () => path.remove(),
        }),
    });
  }

  // Удалить svg после всего
  setTimeout(() => {
    if (svg.parentNode) svg.remove();
  }, 4000);
}

function spawnFormulas(sx, sy) {
  for (let f = 0; f < 7; f++) {
    const formula =
      mathFormulas[Math.floor(Math.random() * mathFormulas.length)];
    const div = document.createElement("div");
    div.textContent = formula;
    div.style.cssText = `
      position: fixed;
      font-family: monospace;
      font-size: ${8 + Math.random() * 10}px;
      color: rgba(212,160,23,0.9);
      text-shadow: 0 0 10px rgba(212,160,23,0.8), 0 0 20px rgba(212,160,23,0.4);
      pointer-events: none;
      z-index: 6;
      left: ${sx}px;
      top: ${sy}px;
      opacity: 0;
    `;
    document.body.appendChild(div);
    const angle = (f / 7) * Math.PI * 2;
    const dist = 60 + Math.random() * 140;
    gsap.to(div, {
      opacity: 1,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 60,
      duration: 1,
      delay: f * 0.1,
      ease: "power2.out",
      onComplete: () =>
        gsap.to(div, {
          opacity: 0,
          y: Math.sin(angle) * dist - 120,
          duration: 1.2,
          delay: 1.5,
          onComplete: () => div.remove(),
        }),
    });
  }
}

// ── RIPPLE EFFECT ────────────────────────────────────────────
function createRipple(sx, sy) {
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement("div");
    ring.style.cssText = `
      position: fixed;
      left: ${sx}px; top: ${sy}px;
      width: 0; height: 0;
      border-radius: 50%;
      border: 1.5px solid rgba(${i % 2 === 0 ? "212,160,23" : "80,120,255"},${0.7 - i * 0.15});
      transform: translate(-50%,-50%);
      pointer-events: none;
      z-index: 8;
    `;
    document.body.appendChild(ring);
    gsap.to(ring, {
      width: 300 + i * 120,
      height: 300 + i * 120,
      opacity: 0,
      duration: 1.2 + i * 0.3,
      delay: i * 0.12,
      ease: "power2.out",
      onComplete: () => ring.remove(),
    });
  }
}

// ── PARTICLE BURST ───────────────────────────────────────────
function burstParticles(sx, sy) {
  const count = 40;
  const bGeo = new THREE.BufferGeometry();
  const bPos = new Float32Array(count * 3);
  const bVel = [];

  // Unproject click to 3D
  const ndcX = (sx / innerWidth) * 2 - 1;
  const ndcY = -(sy / innerHeight) * 2 + 1;
  const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  const origin = camera.position.clone().add(dir.multiplyScalar(4));

  for (let i = 0; i < count; i++) {
    bPos[i * 3] = origin.x;
    bPos[i * 3 + 1] = origin.y;
    bPos[i * 3 + 2] = origin.z;
    bVel.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.12 + 0.04,
        (Math.random() - 0.5) * 0.12,
      ),
    );
  }
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));

  const bMat = new THREE.PointsMaterial({
    size: 0.08,
    color: Math.random() > 0.5 ? 0xd4a017 : 0x2244ff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bPts = new THREE.Points(bGeo, bMat);
  scene.add(bPts);

  let life = 0;
  function animBurst() {
    life += 0.03;
    const arr = bGeo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += bVel[i].x;
      arr[i * 3 + 1] += bVel[i].y - life * 0.003;
      arr[i * 3 + 2] += bVel[i].z;
    }
    bGeo.attributes.position.needsUpdate = true;
    bMat.opacity = Math.max(0, 1 - life * 1.2);
    if (life < 1.2) requestAnimationFrame(animBurst);
    else {
      scene.remove(bPts);
      bGeo.dispose();
      bMat.dispose();
    }
  }
  animBurst();
}

// ── CLICK HANDLER ────────────────────────────────────────────
canvas.addEventListener("click", (e) => {
  startAudio();
  // ✦ NEW: клик по тени → она рассыпается в математические символы
  if (hitShadowAt(e.clientX, e.clientY)) return;
  triggerShock(e.clientX, e.clientY);
});

// ── ENTER GALLERY ────────────────────────────────────────────
let clickCount = 0;
canvas.addEventListener("click", () => {
  clickCount++;
  if (clickCount === 3) showEnterBtn();
});

function showEnterBtn() {
  const sub = document.querySelector(".t-sub");
  if (sub && !sub.dataset.bound) {
    sub.dataset.bound = "1"; // ✦ FIX: вешаем обработчик один раз, но НАВСЕГДА
    sub.textContent = "enter the archive";
    sub.style.cursor = "pointer";
    sub.style.pointerEvents = "all";
    // ✦ FIX: убрали { once: true } — кнопка работает и после возврата из галереи
    sub.addEventListener("click", openGallery);
  }
}

function openGallery() {
  startAudio();
  checkGate(() => {
    document.getElementById("gallery").classList.add("on");
  });
}

document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("gallery").classList.remove("on");
});

// ── GALLERY DATA (from works.json) ──────────────────────────
const grid = document.getElementById("g-grid");
let published = [];   // ✦ NEW: список для навигации
let lbIndex = 0;

fetch("/data/works.json")
  .then((r) => r.json())
  .then((works) => {
    published = works.filter((w) => w.published);
    published.forEach((w, i) => {
      const div = document.createElement("div");
      div.className = "g-item";
      div.innerHTML = `<img src="${w.src}" alt="${w.title}" loading="lazy">
        <div class="g-item-over"><span>${w.title}</span></div>`;
      div.addEventListener("click", () => openLightbox(i));
      grid.appendChild(div);
    });
  })
  .catch((err) => console.error("Failed to load works.json:", err));

// ── LIGHTBOX ──────────────────────────────────────────────────
function renderWork(work) {
  document.getElementById("lb-img").src = work.src;
  document.getElementById("lb-title").textContent = work.title;
  document.getElementById("lb-meta").textContent = [work.year, work.medium, work.dimensions]
    .filter(Boolean)
    .join(" · ");
  document.getElementById("lb-desc").textContent = work.description || "";
  document.getElementById("lb-counter").textContent =
    `${lbIndex + 1} / ${published.length}`;
}
function openLightbox(i) {
  lbIndex = i;
  renderWork(published[lbIndex]);
  document.getElementById("lightbox").classList.add("on");
}
function lbStep(dir) {
  lbIndex = (lbIndex + dir + published.length) % published.length; // по кругу
  renderWork(published[lbIndex]);
}

document.getElementById("lb-prev").addEventListener("click", (e) => {
  e.stopPropagation();   // важно: иначе сработает закрытие по клику на фон
  lbStep(-1);
});
document.getElementById("lb-next").addEventListener("click", (e) => {
  e.stopPropagation();
  lbStep(1);
});
document.getElementById("lb-close").addEventListener("click", () => {
  document.getElementById("lightbox").classList.remove("on");
});
document.getElementById("lightbox").addEventListener("click", () => {
  document.getElementById("lightbox").classList.remove("on");
});

// клавиатура на десктопе
document.addEventListener("keydown", (e) => {
  if (!document.getElementById("lightbox").classList.contains("on")) return;
  if (e.key === "ArrowLeft") lbStep(-1);
  if (e.key === "ArrowRight") lbStep(1);
  if (e.key === "Escape") document.getElementById("lightbox").classList.remove("on");
});

// свайп на мобильном
let touchX = 0;
const lbEl = document.getElementById("lightbox");
lbEl.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lbEl.addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
});

// ── LIGHTBOX LIGHT BEAM ──────────────────────────────────────
const lightboxEl = document.getElementById("lightbox");
lightboxEl.addEventListener("mousemove", (e) => {
  const x = (e.clientX / innerWidth) * 100;
  const y = (e.clientY / innerHeight) * 100;
  lightboxEl.style.setProperty("--mx", x + "%");
  lightboxEl.style.setProperty("--my", y + "%");
});

// ── MAIN LOOP ─────────────────────────────────────────────────
let t = 0;
let mouseX = 0,
  mouseY = 0,
  tgtX = 0,
  tgtY = 0;

document.addEventListener("mousemove", (e) => {
  mouseX = (e.clientX / innerWidth - 0.5) * 2;
  mouseY = (e.clientY / innerHeight - 0.5) * 2;
});

function tick() {
  requestAnimationFrame(tick);
  t += 0.005;

  // Smooth parallax on camera
  tgtX += (mouseX * 0.6 - tgtX) * 0.03;
  tgtY += (-mouseY * 0.4 - tgtY) * 0.03;
  camera.position.x += (tgtX - camera.position.x) * 0.05;
  camera.position.y += (tgtY + 1 - camera.position.y) * 0.05;

  // ✦ FIX: дыхание от базового масштаба — без накопления
  if (demon) {
    const breathe = 1 + Math.sin(t * 0.7) * 0.015;
    demon.scale.setScalar(
      demon.userData.baseScale * breathe * demon.userData.pulse,
    );
    demon.position.y = demon.userData.baseY + Math.sin(t * 0.5) * 0.08;
  }

  // Lights animate
  blueKey.position.x = Math.sin(t * 0.5) * 5;
  blueKey.position.y = Math.cos(t * 0.35) * 3 + 3;
  goldCore.position.x = Math.cos(t * 0.4) * 3;
  goldCore.position.y = Math.sin(t * 0.3) * 1.5 + 1;

  // ✦ NEW: обсерватория медленно вращается и слегка качается
  observatory.rotation.y = t * 0.12;
  observatory.rotation.z = Math.sin(t * 0.25) * 0.03;

  // ✦ театр теней: лошади по эллипсу + прозрачности
  updateShadows(t);

  // Particles drift
  const pa = pGeo.attributes.position.array;
  for (let i = 0; i < N; i++) {
    pa[i * 3] += pVel[i * 3] + Math.sin(t + pPh[i]) * 0.0007;
    pa[i * 3 + 1] += pVel[i * 3 + 1] + Math.cos(t * 0.7 + pPh[i]) * 0.0005;
    pa[i * 3 + 2] += pVel[i * 3 + 2];
    if (pa[i * 3 + 1] > 9) pa[i * 3 + 1] = -9;
    if (pa[i * 3] > 14) pa[i * 3] = -14;
    if (pa[i * 3] < -14) pa[i * 3] = 14;
  }
  pGeo.attributes.position.needsUpdate = true;

  controls.update();
  // ✦ FIX: рендерим через composer — с bloom
  composer.render();
}
tick();

// ── SOUND TOGGLE ─────────────────────────────────────────────
const soundBtn = document.getElementById("sound-btn");
const soundIcon = document.getElementById("sound-icon");
let muted = false;

soundBtn.addEventListener("click", () => {
  if (!audioOn) {
    startAudio();
    muted = false;
  } else {
    muted = !muted;
    if (audioCtx) {
      if (muted) audioCtx.suspend();
      else audioCtx.resume();
    }
    if (ambientEl) {
      if (muted) ambientEl.pause();
      else ambientEl.play().catch(() => {});
    }
  }
  soundIcon.src = muted ? "/bass.svg" : "/treble.svg";
  soundIcon.alt = muted ? "sound off" : "sound on";
  soundBtn.classList.toggle("muted", muted);
});
