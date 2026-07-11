import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const BLOCK_SIZE = 1;
const WORLD_RADIUS = 10;
const RAY_DISTANCE = 7;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.28;
const MOVE_SPEED = 4.7;
const MOUSE_SENSITIVITY = 0.0022;

const blockTypes = {
  grass: {
    top: ["#53a346", "#63b64f", "#3f8f3a", "#79c35d"],
    side: ["#6b4b2f", "#795437", "#4f3826", "#63a245"],
    bottom: ["#5b402b", "#6b4b2f", "#4f3826", "#795437"],
  },
  dirt: {
    top: ["#6b4b2f", "#795437", "#4f3826", "#8a6040"],
    side: ["#6b4b2f", "#795437", "#4f3826", "#8a6040"],
    bottom: ["#5b402b", "#6b4b2f", "#4f3826", "#795437"],
  },
  stone: {
    top: ["#777b82", "#8b9098", "#62666d", "#9ba0a8"],
    side: ["#6f737a", "#858a92", "#565a60", "#989da4"],
    bottom: ["#5f6369", "#767a82", "#4f5358", "#858990"],
  },
  wood: {
    top: ["#8b5a2b", "#a46c35", "#744820", "#c28a49"],
    side: ["#6e4420", "#8b5a2b", "#523418", "#a36a32"],
    bottom: ["#744820", "#8b5a2b", "#5d391b", "#a46c35"],
  },
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91c7e8);
scene.fog = new THREE.Fog(0x91c7e8, 18, 42);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, PLAYER_HEIGHT + 2, 7);

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const statusEl = document.querySelector("#status");
const toolbarButtons = [...document.querySelectorAll("#toolbar button")];

const world = new Map();
const meshByKey = new Map();
const colliders = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
};

let selectedBlock = "grass";
let yaw = 0;
let pitch = 0;
let velocityY = 0;
let onGround = false;

initLighting();
initWorld();
initControls();
animate();

function initLighting() {
  const hemi = new THREE.HemisphereLight(0xe9f6ff, 0x6b553d, 2.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(7, 12, 4);
  sun.castShadow = true;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
}

function initWorld() {
  for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x += 1) {
    for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z += 1) {
      addBlock(x, 0, z, "grass");

      if (Math.random() > 0.88 && Math.abs(x) > 2 && Math.abs(z) > 2) {
        addBlock(x, 1, z, Math.random() > 0.55 ? "stone" : "wood");
      }
    }
  }

  for (let x = -3; x <= 3; x += 1) {
    addBlock(x, 1, -4, "dirt");
  }
}

function initControls() {
  renderer.domElement.addEventListener("click", () => {
    if (document.pointerLockElement !== renderer.domElement) {
      renderer.domElement.requestPointerLock();
      return;
    }
  });

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === renderer.domElement;
    statusEl.textContent = locked
      ? "WASD move | Mouse look | Left destroy | Right place | 1-4 blocks"
      : "Click to play";
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;

    yaw -= event.movementX * MOUSE_SENSITIVITY;
    pitch -= event.movementY * MOUSE_SENSITIVITY;
    pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
  });

  document.addEventListener("keydown", (event) => {
    setKey(event.code, true);
    selectBlockByKey(event.code);
  });

  document.addEventListener("keyup", (event) => setKey(event.code, false));

  document.addEventListener("mousedown", (event) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    if (event.button === 0) destroyTargetBlock();
    if (event.button === 2) placeTargetBlock();
  });

  document.addEventListener("contextmenu", (event) => event.preventDefault());

  toolbarButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedBlock = button.dataset.block;
      updateToolbar();
    });
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setKey(code, pressed) {
  if (code === "KeyW") input.forward = pressed;
  if (code === "KeyS") input.backward = pressed;
  if (code === "KeyA") input.left = pressed;
  if (code === "KeyD") input.right = pressed;
  if (code === "Space") input.jump = pressed;
}

function selectBlockByKey(code) {
  const index = Number(code.replace("Digit", "")) - 1;
  if (!Number.isInteger(index) || !toolbarButtons[index]) return;
  selectedBlock = toolbarButtons[index].dataset.block;
  updateToolbar();
}

function updateToolbar() {
  toolbarButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.block === selectedBlock);
  });
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateCameraRotation();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw) * -1);
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const direction = new THREE.Vector3();

  if (input.forward) direction.add(forward);
  if (input.backward) direction.sub(forward);
  if (input.right) direction.add(right);
  if (input.left) direction.sub(right);

  if (direction.lengthSq() > 0) {
    direction.normalize().multiplyScalar(MOVE_SPEED * dt);
    moveWithCollision(direction.x, 0, direction.z);
  }

  velocityY -= 18 * dt;
  if (input.jump && onGround) {
    velocityY = 6.2;
    onGround = false;
  }

  moveWithCollision(0, velocityY * dt, 0);
}

function updateCameraRotation() {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function moveWithCollision(dx, dy, dz) {
  camera.position.x += dx;
  if (hitsBlock()) camera.position.x -= dx;

  camera.position.z += dz;
  if (hitsBlock()) camera.position.z -= dz;

  camera.position.y += dy;
  if (hitsBlock()) {
    camera.position.y -= dy;
    if (dy < 0) onGround = true;
    velocityY = 0;
  } else if (dy !== 0) {
    onGround = false;
  }

  const floor = PLAYER_HEIGHT + 0.05;
  if (camera.position.y < floor) {
    camera.position.y = floor;
    velocityY = 0;
    onGround = true;
  }
}

function hitsBlock() {
  const feetY = camera.position.y - PLAYER_HEIGHT;
  const headY = camera.position.y - 0.1;

  for (const box of colliders) {
    const overlapsX = camera.position.x + PLAYER_RADIUS > box.min.x && camera.position.x - PLAYER_RADIUS < box.max.x;
    const overlapsZ = camera.position.z + PLAYER_RADIUS > box.min.z && camera.position.z - PLAYER_RADIUS < box.max.z;
    const overlapsY = feetY < box.max.y && headY > box.min.y;
    if (overlapsX && overlapsY && overlapsZ) return true;
  }

  return false;
}

function destroyTargetBlock() {
  const hit = getTarget();
  if (!hit) return;

  const block = hit.object.userData.block;
  if (!block || block.y === 0) return;
  removeBlock(block.x, block.y, block.z);
}

function placeTargetBlock() {
  const hit = getTarget();
  if (!hit) return;

  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).round();
  const block = hit.object.userData.block;
  const x = block.x + normal.x;
  const y = block.y + normal.y;
  const z = block.z + normal.z;

  if (world.has(blockKey(x, y, z))) return;
  if (wouldOverlapPlayer(x, y, z)) return;
  addBlock(x, y, z, selectedBlock);
}

function getTarget() {
  raycaster.setFromCamera(pointer, camera);
  raycaster.far = RAY_DISTANCE;
  const hits = raycaster.intersectObjects([...meshByKey.values()], false);
  return hits[0] || null;
}

function wouldOverlapPlayer(x, y, z) {
  const box = makeBlockBox(x, y, z);
  const feetY = camera.position.y - PLAYER_HEIGHT;
  const headY = camera.position.y - 0.1;
  return (
    camera.position.x + PLAYER_RADIUS > box.min.x &&
    camera.position.x - PLAYER_RADIUS < box.max.x &&
    camera.position.z + PLAYER_RADIUS > box.min.z &&
    camera.position.z - PLAYER_RADIUS < box.max.z &&
    feetY < box.max.y &&
    headY > box.min.y
  );
}

function addBlock(x, y, z, type) {
  const key = blockKey(x, y, z);
  if (world.has(key)) return;

  const mesh = new THREE.Mesh(createBlockGeometry(), createBlockMaterials(type));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.block = { x, y, z, type };
  scene.add(mesh);

  world.set(key, { x, y, z, type });
  meshByKey.set(key, mesh);
  colliders.push(makeBlockBox(x, y, z, key));
}

function removeBlock(x, y, z) {
  const key = blockKey(x, y, z);
  const mesh = meshByKey.get(key);
  if (!mesh) return;

  scene.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.forEach((material) => {
    material.map.dispose();
    material.dispose();
  });

  world.delete(key);
  meshByKey.delete(key);
  const index = colliders.findIndex((box) => box.key === key);
  if (index >= 0) colliders.splice(index, 1);
}

function createBlockGeometry() {
  return new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
}

function createBlockMaterials(type) {
  const pixels = blockTypes[type] || blockTypes.grass;
  const top = textureFromPalette(pixels.top);
  const side = textureFromPalette(pixels.side);
  const bottom = textureFromPalette(pixels.bottom);

  return [
    new THREE.MeshLambertMaterial({ map: side, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: side, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: top, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: bottom, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: side, color: 0xffffff }),
    new THREE.MeshLambertMaterial({ map: side, color: 0xffffff }),
  ];
}

function textureFromPalette(palette) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const noise = (x * 17 + y * 31 + x * y * 7) % palette.length;
      ctx.fillStyle = palette[noise];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBlockBox(x, y, z, key = "") {
  const half = BLOCK_SIZE / 2;
  const box = new THREE.Box3(
    new THREE.Vector3(x - half, y - half, z - half),
    new THREE.Vector3(x + half, y + half, z + half),
  );
  box.key = key;
  return box;
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}
