/* =========================================================
 * Pixel Minecraft MVP - Vanilla JS + Three.js
 * - 1인칭 시점 (WASD + 마우스, Pointer Lock)
 * - 좌클릭: 블록 파괴 / 우클릭: 블록 설치
 * - 절차 생성 픽셀 아트 텍스처 (외부 이미지 불필요)
 * ========================================================= */
'use strict';

// ---------- 설정 ----------
const WORLD_SIZE = 24;        // 지형 가로/세로 (블록 수)
const PLAYER_HEIGHT = 1.7;
const MOVE_SPEED = 5.0;
const GRAVITY = 20.0;
const JUMP_SPEED = 7.5;
const REACH = 6;              // 블록 상호작용 거리

// ---------- 픽셀 아트 텍스처 생성 ----------
// 8x8 캔버스에 픽셀을 찍고 NearestFilter로 확대 → 도트 느낌
function makePixelTexture(baseColor, altColor, noise = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = Math.random() < noise ? baseColor : altColor;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;   // 핵심: 픽셀 그대로 확대
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const BLOCK_TYPES = {
  grass: { name: '잔디', material: null, colors: ['#4caf50', '#388e3c'] },
  dirt:  { name: '흙',   material: null, colors: ['#8d6e63', '#6d4c41'] },
  stone: { name: '돌',   material: null, colors: ['#9e9e9e', '#757575'] },
  wood:  { name: '나무', material: null, colors: ['#a1887f', '#795548'] },
};
const BLOCK_KEYS = Object.keys(BLOCK_TYPES); // 1~4 키 매핑
let currentBlock = 'grass';

for (const key of BLOCK_KEYS) {
  const t = BLOCK_TYPES[key];
  t.material = new THREE.MeshLambertMaterial({
    map: makePixelTexture(t.colors[0], t.colors[1]),
  });
}

// ---------- 씬 / 카메라 / 렌더러 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#87ceeb'); // 하늘색
scene.fog = new THREE.Fog('#87ceeb', 20, 60);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.1, 200
);

const renderer = new THREE.WebGLRenderer({ antialias: false }); // 픽셀 느낌 유지
renderer.setPixelRatio(1);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 조명
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(30, 50, 20);
scene.add(sun);

// ---------- 월드 (블록 저장소) ----------
const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
const blocks = new Map(); // "x,y,z" -> Mesh

function blockKey(x, y, z) { return `${x},${y},${z}`; }

function addBlock(x, y, z, type) {
  const key = blockKey(x, y, z);
  if (blocks.has(key)) return;
  const mesh = new THREE.Mesh(cubeGeo, BLOCK_TYPES[type].material);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5); // 격자 정렬
  mesh.userData = { x, y, z };
  scene.add(mesh);
  blocks.set(key, mesh);
}

function removeBlock(mesh) {
  const { x, y, z } = mesh.userData;
  scene.remove(mesh);
  blocks.delete(blockKey(x, y, z));
}

// 초기 지형: 평평한 잔디밭 + 흙 층 + 간단한 언덕
function generateTerrain() {
  const half = WORLD_SIZE / 2;
  for (let x = -half; x < half; x++) {
    for (let z = -half; z < half; z++) {
      // 사인파 기반의 아주 단순한 높이맵
      const h = Math.max(0, Math.round(
        Math.sin(x * 0.4) * Math.cos(z * 0.4) * 2
      ));
      for (let y = 0; y <= h; y++) {
        addBlock(x, y, z, y === h ? 'grass' : 'dirt');
      }
    }
  }
}
generateTerrain();

// ---------- 플레이어 (1인칭 컨트롤) ----------
const player = {
  pos: new THREE.Vector3(0, 6, 0),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: false,
};
const keys = {};

// Pointer Lock
const overlay = document.getElementById('start-overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  overlay.style.display =
    document.pointerLockElement === renderer.domElement ? 'none' : 'flex';
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.002;
  player.pitch -= e.movementY * 0.002;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // 1~4 블록 선택
  const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
  if (idx >= 0) {
    currentBlock = BLOCK_KEYS[idx];
    document.getElementById('block-name').textContent = BLOCK_TYPES[currentBlock].name;
  }
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- 블록 설치 / 파괴 (레이캐스팅) ----------
const raycaster = new THREE.Raycaster();
raycaster.far = REACH;
const centerScreen = new THREE.Vector2(0, 0);

function getTargetBlock() {
  raycaster.setFromCamera(centerScreen, camera);
  const hits = raycaster.intersectObjects([...blocks.values()]);
  return hits.length > 0 ? hits[0] : null;
}

document.addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  const hit = getTargetBlock();
  if (!hit) return;

  if (e.button === 0) {
    // 좌클릭: 파괴
    removeBlock(hit.object);
  } else if (e.button === 2) {
    // 우클릭: 맞은 면의 법선 방향으로 새 블록 설치
    const { x, y, z } = hit.object.userData;
    const n = hit.face.normal;
    const nx = x + n.x, ny = y + n.y, nz = z + n.z;

    // 플레이어 몸과 겹치면 설치 금지
    const px = Math.floor(player.pos.x);
    const pz = Math.floor(player.pos.z);
    const pyFeet = Math.floor(player.pos.y - PLAYER_HEIGHT);
    const pyHead = Math.floor(player.pos.y);
    if (nx === px && nz === pz && (ny === pyFeet || ny === pyHead)) return;

    addBlock(nx, ny, nz, currentBlock);
  }
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- 물리 & 충돌 ----------
function isSolid(x, y, z) {
  return blocks.has(blockKey(Math.floor(x), Math.floor(y), Math.floor(z)));
}

function updatePlayer(dt) {
  // 이동 입력 (yaw 기준 전후좌우)
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const move = new THREE.Vector3();
  if (keys['KeyW']) move.add(forward);
  if (keys['KeyS']) move.sub(forward);
  if (keys['KeyD']) move.add(right);
  if (keys['KeyA']) move.sub(right);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(MOVE_SPEED);

  player.vel.x = move.x;
  player.vel.z = move.z;
  player.vel.y -= GRAVITY * dt;

  if (keys['Space'] && player.onGround) {
    player.vel.y = JUMP_SPEED;
    player.onGround = false;
  }

  // 축별 이동 + 간단한 복셀 충돌 (눈높이 기준: pos.y가 카메라 높이)
  const p = player.pos;
  const feetOffset = PLAYER_HEIGHT;

  // X
  let nx = p.x + player.vel.x * dt;
  if (!collides(nx, p.y, p.z)) p.x = nx;
  // Z
  let nz = p.z + player.vel.z * dt;
  if (!collides(p.x, p.y, nz)) p.z = nz;
  // Y
  let ny = p.y + player.vel.y * dt;
  if (collides(p.x, ny, p.z)) {
    if (player.vel.y < 0) player.onGround = true;
    player.vel.y = 0;
  } else {
    p.y = ny;
    player.onGround = false;
  }

  // 맵 밖으로 떨어지면 리스폰
  if (p.y < -20) {
    p.set(0, 6, 0);
    player.vel.set(0, 0, 0);
  }

  function collides(x, y, z) {
    const r = 0.3; // 플레이어 반지름
    for (const [ox, oz] of [[-r, -r], [-r, r], [r, -r], [r, r]]) {
      // 발 ~ 머리 사이 두 지점 검사
      if (isSolid(x + ox, y - feetOffset, z + oz)) return true;
      if (isSolid(x + ox, y - 0.2, z + oz)) return true;
    }
    return false;
  }

  // 카메라 갱신
  camera.position.copy(p);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

// ---------- 게임 루프 ----------
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05); // 프레임 드랍 보호
  lastTime = now;
  updatePlayer(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// 리사이즈 대응
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
