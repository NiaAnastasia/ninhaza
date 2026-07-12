// ── ninhaza · the atelier ────────────────────────────────────
// Покраска вершинными цветами: у скульптов из Nomad нет UV-развёрток,
// поэтому «краска» пишется прямо в color-атрибут геометрии
// (raycast → все вершины в радиусе кисти, мягкий спад к краям).
//
// raycast ускорен three-mesh-bvh (npm i three-mesh-bvh):
// без BVH перебор 150–250k треугольников на каждый кадр
// не потянет покраску на мобильном.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ── конфиг ───────────────────────────────────────────────────
const MODELS = [
  "/games/atelier/computer-1.glb",
  "/games/atelier/computer-2.glb",
  "/games/atelier/computer-3.glb",
];
// палитра — стандартная радуга + нейтральные + два золота сайта
const PALETTE = [
  { name: "red", hex: "#ff0000" },
  { name: "orange", hex: "#ff7f00" },
  { name: "yellow", hex: "#ffe100" },
  { name: "green", hex: "#16a824" },
  { name: "blue", hex: "#1a2fff" },
  { name: "indigo", hex: "#4b0082" },
  { name: "violet", hex: "#8f00ff" },
  { name: "pink", hex: "#ff7ab8" },
  { name: "brown", hex: "#7a4a21" },
  { name: "white", hex: "#ffffff" },
  { name: "silver", hex: "#a8aab0" },
  { name: "black", hex: "#101010" },
  { name: "gold", hex: "#d4a017" },
  { name: "bright gold", hex: "#f5c842" },
];

const SIZES = [0.045, 0.09, 0.16]; // радиус кисти — доля радиуса модели
const FLOW = 4.5; // скорость набора краски при удержании, 1/с

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TOUCH = matchMedia("(pointer: coarse)").matches;

// ── DOM ──────────────────────────────────────────────────────
const stages = {
  brief: document.getElementById("brief"),
  studio: document.getElementById("studio"),
};
const beginBtn = document.getElementById("begin-btn");
const shell = document.getElementById("canvas-shell");
const canvas = document.getElementById("gl");
const hintEl = document.getElementById("hint");
const loadEl = document.getElementById("loading");
const paletteEl = document.getElementById("palette");
const machineBtns = [...document.querySelectorAll(".m-btn")];
const modeBtns = [...document.querySelectorAll(".mode-btn")];
const brushBtns = [...document.querySelectorAll(".b-btn")];
const washBtn = document.getElementById("wash-btn");

// ── state ────────────────────────────────────────────────────
let mode = "turn"; // "turn" | "spray"
let modelIdx = 0;
let sizeIdx = 1;
let color = new THREE.Color(PALETTE[0].hex);
let modelRoot = null;
let targets = []; // покрасочные меши: геометрия + буферы
let brushBase = 1.2; // радиус сферы модели (после нормализации)
let started = false;

// ── рендерер · сцена · камера ────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch {
  loadEl.textContent = "this room needs webgl · try another browser";
  loadEl.classList.remove("off");
  throw new Error("webgl unavailable");
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78; // приглушено: модели почти белые, легко пересветить

const scene = new THREE.Scene();

// студийное окружение — краска бликует как на металле
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
camera.position.set(1.9, 0.9, 3.2);

scene.add(new THREE.HemisphereLight(0xf5e8c8, 0x1a1030, 0.35));
const key = new THREE.DirectionalLight(0xfff2d0, 1.1);
key.position.set(2.5, 3, 2);
scene.add(key);
const rim = new THREE.DirectionalLight(0x4a5aff, 0.5);
rim.position.set(-3, 1.5, -2.5);
scene.add(rim);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !REDUCED;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 2.0;
controls.maxDistance = 7;
controls.autoRotate = !REDUCED; // ленивое вращение до первого касания
controls.autoRotateSpeed = 0.9;

// ── размер канваса ───────────────────────────────────────────
new ResizeObserver(() => {
  const w = shell.clientWidth;
  const h = shell.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}).observe(shell);

// ── загрузка моделей (Draco) ─────────────────────────────────
const draco = new DRACOLoader();
draco.setDecoderPath("/draco/gltf/"); // декодер лежит в public/draco/gltf/
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

function disposeModel() {
  if (!modelRoot) return;
  scene.remove(modelRoot);
  modelRoot.traverse((c) => {
    if (!c.isMesh) return;
    c.geometry.disposeBoundsTree?.();
    c.geometry.dispose();
    (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) =>
      m?.dispose(),
    );
  });
  modelRoot = null;
  targets = [];
}

// цвет-атрибут → всегда «наш» Float32 (glTF может дать
// нормализованный Uint8 или interleaved — приводим к общему виду)
function ensureFloatColors(geometry, material) {
  const count = geometry.attributes.position.count;
  const src = geometry.attributes.color;
  const item = src ? src.itemSize : 3;
  const arr = new Float32Array(count * item);
  if (src) {
    for (let i = 0; i < count; i++) {
      arr[i * item] = src.getX(i);
      arr[i * item + 1] = src.getY(i);
      arr[i * item + 2] = src.getZ(i);
      if (item > 3) arr[i * item + 3] = src.getW(i);
    }
  } else {
    // вершинных цветов нет — запекаем цвет материала как базу
    const base = material?.color ? material.color.clone() : new THREE.Color(1, 1, 1);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = base.r;
      arr[i * 3 + 1] = base.g;
      arr[i * 3 + 2] = base.b;
    }
    if (material?.color) material.color.set(0xffffff);
  }
  const attr = new THREE.BufferAttribute(arr, item);
  geometry.setAttribute("color", attr);
  if (material) {
    material.vertexColors = true;
    material.needsUpdate = true;
  }
  return attr;
}

function buildTargets(root) {
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (!child.isMesh) return;
    const g = child.geometry;
    const m = child.material;
    if (m) {
      // приглушаем метал/шершавость, чтобы краска читалась при любом экспорте
      m.metalness = Math.min(m.metalness ?? 0, 0.25);
      m.roughness = Math.max(m.roughness ?? 1, 0.5);
      m.envMapIntensity = 0.45;
    }
    const attr = ensureFloatColors(g, m);
    g.computeBoundsTree();
    g.computeBoundingBox();

    // плоская копия позиций — быстрый доступ при покраске
    const pa = g.attributes.position;
    const pos = new Float32Array(pa.count * 3);
    for (let i = 0; i < pa.count; i++) {
      pos[i * 3] = pa.getX(i);
      pos[i * 3 + 1] = pa.getY(i);
      pos[i * 3 + 2] = pa.getZ(i);
    }

    // карта «островов» — связных кусков геометрии (union-find по индексам):
    // тап в режиме fill заливает весь остров, в который попал луч
    let island = null;
    if (g.index) {
      const n = pa.count;
      const parent = new Int32Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      const find = (a) => {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      };
      const ia = g.index.array;
      for (let i = 0; i < ia.length; i += 3) {
        const a = find(ia[i]);
        const b = find(ia[i + 1]);
        const d = find(ia[i + 2]);
        if (b !== a) parent[b] = a;
        if (d !== a) parent[d] = a;
      }
      island = new Int32Array(n);
      for (let i = 0; i < n; i++) island[i] = find(i);
    }

    targets.push({
      mesh: child,
      attr,
      item: attr.itemSize,
      pos,
      count: pa.count,
      original: attr.array.slice(), // для wash
      bbox: g.boundingBox,
      invScale: 1 / child.getWorldScale(new THREE.Vector3()).x,
      island,
    });
  });
}

function loadModel(idx) {
  modelIdx = idx;
  machineBtns.forEach((b, i) =>
    b.setAttribute("aria-pressed", String(i === idx)),
  );
  disposeModel();
  loadEl.textContent = "loading the machine…";
  loadEl.classList.remove("off");

  loader.load(
    MODELS[idx],
    (gltf) => {
      loadEl.textContent = "preparing the surface…";
      // даём оверлею отрисоваться перед тяжёлым построением BVH
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const root = gltf.scene;

          // нормализация: центр в ноль, габарит ~2 юнита
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const centre = box.getCenter(new THREE.Vector3());
          const s = 2 / Math.max(size.x, size.y, size.z);
          root.scale.setScalar(s);
          root.position.sub(centre.multiplyScalar(s));

          buildTargets(root);

          box.setFromObject(root);
          brushBase = box.getBoundingSphere(new THREE.Sphere()).radius;

          modelRoot = root;
          scene.add(root);
          loadEl.classList.add("off");
        }),
      );
    },
    (xhr) => {
      if (xhr.total) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        loadEl.textContent = `loading the machine · ${pct}%`;
      }
    },
    () => {
      loadEl.textContent = "the machine refused to load · try again";
    },
  );
}

// ── покраска ─────────────────────────────────────────────────
const ray = new THREE.Raycaster();
ray.firstHitOnly = true; // three-mesh-bvh: только ближайшее попадание
const ndc = new THREE.Vector2();
const _local = new THREE.Vector3();
const _step = new THREE.Vector3();
let spraying = false;
let lastHit = null;
let activePointers = 0;

function setNDC(e) {
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function paintAt(worldPoint, radiusWorld, alpha) {
  for (const t of targets) {
    _local.copy(worldPoint);
    t.mesh.worldToLocal(_local);
    const rad = radiusWorld * t.invScale;
    if (t.bbox.distanceToPoint(_local) > rad) continue;

    const r2 = rad * rad;
    const { pos, count, item } = t;
    const c = t.attr.array;
    let touched = false;

    for (let i = 0; i < count; i++) {
      const dx = pos[i * 3] - _local.x;
      const dy = pos[i * 3 + 1] - _local.y;
      const dz = pos[i * 3 + 2] - _local.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;
      // мягкий спад: smoothstep от центра к краю кисти
      const f = 1 - Math.sqrt(d2) / rad;
      const w = f * f * (3 - 2 * f) * alpha;
      const j = i * item;
      c[j] += (color.r - c[j]) * w;
      c[j + 1] += (color.g - c[j + 1]) * w;
      c[j + 2] += (color.b - c[j + 2]) * w;
      touched = true;
    }
    if (touched) t.attr.needsUpdate = true;
  }
}

function sprayStep(dt) {
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(modelRoot, true);
  if (!hits.length) {
    lastHit = null;
    return;
  }
  const p = hits[0].point;
  const rad = brushBase * SIZES[sizeIdx];
  const alpha = Math.min(1, FLOW * dt);

  // быстрый мазок не рвётся: докрашиваем отрезок между кадрами
  if (lastHit) {
    const dist = lastHit.distanceTo(p);
    if (dist > rad * 0.5 && dist < rad * 10) {
      const steps = Math.min(6, Math.ceil(dist / (rad * 0.5)));
      for (let i = 1; i <= steps; i++) {
        paintAt(_step.lerpVectors(lastHit, p, i / steps), rad, alpha);
      }
      lastHit.copy(p);
      return;
    }
  }
  paintAt(p, rad, alpha);
  lastHit = (lastHit || new THREE.Vector3()).copy(p);
}

// fill: тап по детали заливает весь её остров текущим цветом
function fillTap() {
  if (!modelRoot) return;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(modelRoot, true);
  if (!hits.length) return;
  const hit = hits[0];
  const t = targets.find((x) => x.mesh === hit.object);
  if (!t) return;
  const c = t.attr.array;
  const item = t.item;
  const id = t.island && hit.face ? t.island[hit.face.a] : null;
  for (let i = 0; i < t.count; i++) {
    if (id !== null && t.island[i] !== id) continue;
    const j = i * item;
    c[j] = color.r;
    c[j + 1] = color.g;
    c[j + 2] = color.b;
  }
  t.attr.needsUpdate = true;
}

let downX = 0;
let downY = 0;
let gesturePointers = 0; // сколько пальцев участвовало в жесте

canvas.addEventListener("pointerdown", (e) => {
  activePointers++;
  gesturePointers = Math.max(gesturePointers, activePointers);
  controls.autoRotate = false; // первое касание — модель твоя
  downX = e.clientX;
  downY = e.clientY;
  if (mode === "spray" && activePointers === 1) {
    canvas.setPointerCapture(e.pointerId);
    setNDC(e);
    spraying = true;
    lastHit = null;
  } else {
    spraying = false;
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (spraying) setNDC(e);
});
["pointerup", "pointercancel"].forEach((t) =>
  canvas.addEventListener(t, (e) => {
    // заливка — только чистый тап одним пальцем, не смахивание и не щипок
    if (
      t === "pointerup" &&
      mode === "fill" &&
      gesturePointers === 1 &&
      Math.hypot(e.clientX - downX, e.clientY - downY) < 8
    ) {
      setNDC(e);
      fillTap();
    }
    activePointers = Math.max(0, activePointers - 1);
    if (activePointers === 0) gesturePointers = 0;
    spraying = false;
    lastHit = null;
  }),
);

// ── режимы · кисти · палитра ─────────────────────────────────
function setMode(m) {
  mode = m;
  spraying = false;
  controls.enableRotate = m === "turn";
  canvas.classList.toggle("spray", m !== "turn");
  modeBtns.forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === m)),
  );
  const zoom = TOUCH ? "two fingers to zoom" : "scroll to zoom";
  hintEl.textContent =
    m === "spray"
      ? `hold to spray · ${zoom}`
      : m === "fill"
        ? `tap a part to fill it · ${zoom}`
        : TOUCH
          ? "drag to turn · pinch to zoom"
          : "drag to turn · scroll to zoom";
}
modeBtns.forEach((b) =>
  b.addEventListener("click", () => setMode(b.dataset.mode)),
);

brushBtns.forEach((b) =>
  b.addEventListener("click", () => {
    sizeIdx = +b.dataset.s;
    brushBtns.forEach((x) =>
      x.setAttribute("aria-pressed", String(x === b)),
    );
  }),
);

PALETTE.forEach((p, i) => {
  const b = document.createElement("button");
  b.className = "swatch";
  b.style.setProperty("--c", p.hex);
  b.title = p.name;
  b.setAttribute("aria-label", p.name);
  b.setAttribute("aria-pressed", String(i === 0));
  b.addEventListener("click", () => {
    color = new THREE.Color(p.hex);
    paletteEl
      .querySelectorAll(".swatch")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  });
  paletteEl.appendChild(b);
});

machineBtns.forEach((b) =>
  b.addEventListener("click", () => {
    const i = +b.dataset.i;
    if (i !== modelIdx) loadModel(i);
  }),
);

// wash — вода смывает всё: возвращаем исходные вершинные цвета
washBtn.addEventListener("click", () => {
  for (const t of targets) {
    t.attr.array.set(t.original);
    t.attr.needsUpdate = true;
  }
});

// ── старт ────────────────────────────────────────────────────
beginBtn.addEventListener("click", () => {
  stages.brief.classList.remove("on");
  stages.studio.classList.add("on");
  setMode(TOUCH ? "turn" : "spray"); // на десктопе сразу дать краску в руки
  if (!started) {
    started = true;
    loadModel(0);
  }
});

// ── цикл ─────────────────────────────────────────────────────
let lastT = performance.now();
function animate(t) {
  requestAnimationFrame(animate);
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  if (spraying && modelRoot) sprayStep(dt);
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);