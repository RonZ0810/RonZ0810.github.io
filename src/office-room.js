import * as THREE from 'three';
import { desktopTexture, addOfficeDetails } from './office-details.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options });
function box(parent, size, position, mat, radius = 0.015) {
  const geo = radius ? new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(v => v / 3))) : new THREE.BoxGeometry(...size);
  if (mat.name === 'oak') {
    const uv=geo.attributes.uv, pos=geo.attributes.position, normal=geo.attributes.normal;
    for(let i=0;i<uv.count;i++) {
      const nx=Math.abs(normal.getX(i)), ny=Math.abs(normal.getY(i)), nz=Math.abs(normal.getZ(i));
      uv.setXY(i, nx>ny && nx>nz ? pos.getZ(i) : pos.getX(i), ny>nx && ny>nz ? pos.getZ(i) : pos.getY(i));
    }
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function cylinder(parent, top, bottom, height, position, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 32), mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function rod(parent, start, end, radius, mat) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const mesh = cylinder(parent, radius, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(0.5).toArray(), mat);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
}
function group(parent, position = [0, 0, 0]) {
  const result = new THREE.Group(); result.position.set(...position); parent.add(result); return result;
}
function canvasTexture(draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
function fabricTexture() {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#c9c3b8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 3) {
      ctx.fillStyle = i % 2 ? '#bab4a9' : '#d4cec3'; ctx.fillRect(i, 0, 1, h);
      ctx.fillStyle = 'rgba(85,75,65,.13)'; ctx.fillRect(0, i, w, 1);
    }
  }, 256, 256);
}
function printTexture(kind) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#eeeae0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#343f40';
    if (kind === 'timeline') {
      ctx.font = '24px sans-serif'; ctx.fillText('EXPERIENCE', 42, 66);
      ctx.fillStyle = '#b56842'; ctx.fillRect(56, 126, 3, 272);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(57, 144 + i * 106, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#455052'; ctx.fillRect(92, 133 + i * 106, 220 - i * 27, 8);
        ctx.fillStyle = '#bab6ac'; ctx.fillRect(92, 155 + i * 106, 170, 5); ctx.fillStyle = '#b56842';
      }
    } else {
      ctx.fillStyle = '#b86444'; ctx.beginPath(); ctx.arc(256, 211, 128, Math.PI, 0); ctx.lineTo(384, 378); ctx.lineTo(128, 378); ctx.fill();
      ctx.fillStyle = '#e0d7c5'; ctx.beginPath(); ctx.arc(256, 238, 77, Math.PI, 0); ctx.lineTo(333, 380); ctx.lineTo(179, 380); ctx.fill();
      ctx.fillStyle = '#4c5c59'; ctx.fillRect(73, 382, 366, 3);
      ctx.font = '15px sans-serif'; ctx.fillText('SPACE TO THINK', 73, 427);
    }
  });
}

export function createOffice(owner) {
  const room = group(owner.scene);
  const m = {
    oak: material('#b49b75', { roughness: 0.46 }), floor: material('#d6c7af', { roughness: 0.6 }),
    white: material('#e9e7df', { roughness: 0.86 }), dark: material('#303736', { metalness: 0.4, roughness: 0.33 }),
    metal: material('#a2a5a0', { metalness: 0.92, roughness: 0.23 }), orange: material('#b96743'),
    paper: material('#f4eddf', { roughness: 0.98 }), fabric: material('#dfd8c9', { map: fabricTexture(), roughness: 1 }),
  };
  m.oak.name = 'oak';
  owner.roomMaterials = m;
  const envScene = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(owner.renderer);
  owner.environmentTarget = pmrem.fromScene(envScene, 0.025);
  owner.scene.environment = owner.environmentTarget.texture; owner.scene.environmentIntensity = 0.45;
  envScene.dispose(); pmrem.dispose();
  owner.scene.add(new THREE.HemisphereLight('#edf3fb', '#b4a18b', 1.15));
  const sun = new THREE.DirectionalLight('#fff1d7', 3.4);
  sun.position.set(-8, 5.5, -1.5); sun.target.position.set(0, 0, -0.2); sun.castShadow = true;
  sun.shadow.mapSize.set(owner.softwareRenderer ? 256 : owner.mobile ? 512 : 1024, owner.softwareRenderer ? 256 : owner.mobile ? 512 : 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.00012; sun.shadow.radius = 1.5;
  owner.scene.add(sun, sun.target); owner.sun = sun;
  const fill = new THREE.DirectionalLight('#dae7f3', 0.65); fill.position.set(5, 3, 5); owner.scene.add(fill);

  // Human-scale architecture: enclosed office and a hallway at the entrance.
  box(room, [6.9, 0.16, 4.95], [0, -0.14, 0], material('#706b61'), 0.04);
  box(room, [6.8, 0.07, 4.8], [0, -0.025, 0], m.floor);
  const back = group(room), left = group(room);
  box(back, [6.8, 3.1, 0.12], [0, 1.55, -2.44], m.white.clone());
  box(back, [6.8, 0.09, 0.035], [0, 0.085, -2.35], m.white.clone());
  box(left, [0.12, 3.1, 0.56], [-3.44, 1.55, -2.12], m.white.clone());
  box(left, [0.12, 3.1, 0.66], [-3.44, 1.55, 2.07], m.white.clone());
  box(left, [0.12, 0.53, 3.6], [-3.44, 0.265, -0.02], m.white.clone());
  box(left, [0.12, 0.31, 3.6], [-3.44, 2.945, -0.02], m.white.clone());
  const windowMat = material('#c2c9c6', { metalness: 0.45, roughness: 0.31 });
  for (const z of [-1.82, -0.62, 0.58, 1.78]) box(left, [0.16, 2.26, 0.055], [-3.4, 1.67, z], windowMat.clone());
  for (const y of [0.54, 2.8]) box(left, [0.16, 0.055, 3.65], [-3.4, y, -0.02], windowMat.clone());
  box(left, [0.34, 0.065, 3.86], [-3.31, 0.54, -0.02], m.white.clone());
  createEnclosure(owner, room, m);
  const garden = createGarden(owner, m);
  box(room, [3.5, 0.018, 2.8], [-0.35, 0.024, 0.35], m.fabric, 0.045);
  const contactMap = canvasTexture((ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(30,24,18,.30)'); grad.addColorStop(0.65, 'rgba(30,24,18,.12)'); grad.addColorStop(1, 'rgba(30,24,18,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  }, 128, 128);
  for (const [x, z, sx, sz] of [[-0.4, -0.45, 3, 1.7], [-0.3, 1, 1.3, 1.4], [2.4, 0.2, 1.6, 1.2]]) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: contactMap, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.04, z); room.add(mesh);
  }
  const desk = group(room, [-0.35, 0, -0.4]);
  box(desk, [2.8, 0.085, 1.18], [0, 0.77, 0], m.oak, 0.035);
  for (const x of [-1.19, 1.19]) {
    for (const z of [-0.42, 0.42]) rod(desk, [x * 1.03, 0.04, z * 1.08], [x, 0.73, z], 0.036, m.dark);
    rod(desk, [x, 0.15, -0.44], [x, 0.15, 0.44], 0.025, m.dark);
  }
  rod(desk, [-1.19, 0.61, 0], [1.19, 0.61, 0], 0.024, m.dark);
  const monitor = group(room, [0.08, 0.82, -0.66]);
  box(monitor, [0.36, 0.023, 0.24], [0, 0, 0.025], m.metal);
  box(monitor, [0.065, 0.26, 0.05], [0, 0.14, -0.03], m.metal);
  box(monitor, [1.08, 0.64, 0.044], [0, 0.49, -0.02], m.dark, 0.025);
  const screenMap = desktopTexture(canvasTexture, owner.mobile);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.015, 0.57), new THREE.MeshStandardMaterial({ map: screenMap, emissiveMap: screenMap, emissive: '#ffffff', emissiveIntensity: 0.20, roughness: 0.28 }));
  screen.position.set(0, 0.5, 0.005); monitor.add(screen);
  owner.registerClickable(monitor, { type: 'navigate', href: '/projects/', label: 'Projects · the monitor' });
  const keyboard = box(desk, [0.61, 0.025, 0.21], [0.45, 0.828, 0.34], m.metal);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) box(keyboard, [0.035, 0.006, 0.038], [-0.273 + c * 0.042, 0.016, -0.075 + r * 0.045], m.paper, 0.003);
  box(desk, [0.07, 0.033, 0.115], [0.95, 0.829, 0.32], m.paper, 0.02);
  const notebook = group(room, [-0.94, 0.8205, 0.05]); notebook.rotation.y = -0.12;
  box(notebook, [0.43, 0.016, 0.31], [0, 0, 0], m.orange);
  box(notebook, [0.414, 0.022, 0.29], [0, 0.017, 0], m.paper, 0.004);
  for (let i = 0; i < 4; i++) box(notebook, [0.415, 0.001, 0.29], [0, 0.01 + i * 0.004, 0], material('#c8c1b3'), 0);
  const hinge = group(notebook, [-0.215, 0.035, 0]);
  box(hinge, [0.43, 0.012, 0.31], [0.215, 0, 0], m.orange);
  box(hinge, [0.13, 0.002, 0.014], [0.215, 0.008, -0.025], m.paper, 0.001);
  owner.notebookHinge = hinge;
  owner.registerClickable(notebook, { type: 'navigate', href: '/about/', label: 'About · the notebook' });
  const lamp = group(room, [-1.47, 0.82, -0.75]);
  cylinder(lamp, 0.13, 0.145, 0.035, [0, 0, 0], m.dark);
  rod(lamp, [0, 0.02, 0], [-0.1, 0.43, 0], 0.014, m.dark);
  rod(lamp, [-0.1, 0.43, 0], [0.23, 0.7, 0], 0.014, m.dark);
  for (const p of [[0, 0.02, 0], [-0.1, 0.43, 0], [0.23, 0.7, 0]]) cylinder(lamp, 0.032, 0.032, 0.037, p, m.metal).rotation.x = Math.PI / 2;
  const shade = group(lamp, [0.25, 0.68, 0]); shade.rotation.z = -0.32;
  cylinder(shade, 0.045, 0.14, 0.12, [0, 0, 0], m.dark);
  owner.lampMaterial = material('#fff2d4', { emissive: '#ffce86', emissiveIntensity: 2.2 });
  cylinder(shade, 0.128, 0.128, 0.006, [0, -0.062, 0], owner.lampMaterial);
  owner.lampLight = new THREE.SpotLight('#ffca87', 7, 4, Math.PI / 3.1, 0.7, 2);
  owner.lampLight.position.set(-1.22, 1.46, -0.75); owner.lampLight.target.position.set(-0.8, 0.78, -0.1);
  room.add(owner.lampLight, owner.lampLight.target);
  owner.registerClickable(lamp, { type: 'lamp', label: 'Switch desk lamp' });
  const cup = group(desk, [0.88, 0.873, 0.05]);
  cylinder(cup, 0.054, 0.044, 0.12, [0, 0, 0], m.white);
  cylinder(cup, 0.044, 0.044, 0.002, [0, 0.061, 0], material('#443026'));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 10, 24), m.white); handle.position.set(0.055, 0, 0); cup.add(handle);
  const shelves = group(room, [-2.15, 0, -1.92]);
  for (const y of [0.12, 0.73, 1.36, 2.01]) box(shelves, [1.64, 0.052, 0.59], [0, y, 0], m.oak);
  for (const x of [-0.76, 0.76]) box(shelves, [0.045, 2.02, 0.045], [x, 1.04, -0.24], m.dark);
  const books = group(shelves, [0, 1.40, 0.01]);
  const colors = ['#b66545', '#b1b7a6', '#e7dfcb', '#435557', '#a6ada5', '#d3bea1', '#393f3b'];
  for (let i = 0; i < 7; i++) {
    const height = 0.31 + (i % 3) * 0.045;
    const book = box(books, [0.105, height, 0.36], [-0.58 + i * 0.155, height / 2, 0], material(colors[i]), 0.007);
    box(book, [0.07, 0.007, 0.003], [0, height / 2 - 0.055, 0.183], m.paper, 0);
  }
  owner.registerClickable(books, { type: 'navigate', href: '/education/', label: 'Education · the bookshelf' });
  for (let i = 0; i < 3; i++) box(shelves, [0.52, 0.055, 0.4], [0.3, 0.79 + i * 0.059, 0], material(colors[i]));
  cylinder(shelves, 0.13, 0.1, 0.25, [-0.44, 0.89, 0], m.white);
  const timeline = group(back, [1.55, 1.88, -2.32]);
  box(timeline, [1.04, 1.2, 0.042], [0, 0, 0], m.oak);
  const timelineImage = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.10), material('#ffffff', { map: printTexture('timeline') })); timelineImage.position.z = 0.026; timeline.add(timelineImage);
  owner.registerClickable(timeline, { type: 'navigate', href: '/experience/', label: 'Experience · the timeline' });
  const art = group(back, [0.12, 1.88, -2.32]);
  box(art, [1.02, 1.2, 0.045], [0, 0, 0], m.dark);
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 1.11), material('#ffffff', { map: printTexture('art') })); artwork.position.z = 0.026; art.add(artwork);
  const consoleTable = group(room, [2.65, 0, 0.24]);
  box(consoleTable, [1.32, 0.065, 0.7], [0, 0.83, 0], m.oak, 0.025);
  for (const x of [-0.56, 0.56]) for (const z of [-0.25, 0.25]) rod(consoleTable, [x, 0.03, z], [x, 0.8, z], 0.023, m.dark);
  box(consoleTable, [1.18, 0.035, 0.56], [0, 0.21, 0], m.oak);
  for (let i = 0; i < 3; i++) box(consoleTable, [0.42, 0.046, 0.32], [-0.27, 0.26 + i * 0.048, 0], material(colors[i]));
  const cameraGroup = group(room, [2.63, 0.863, 0.36]); cameraGroup.rotation.y = 0.3;
  const cameraProxy = group(cameraGroup);
  box(cameraProxy, [0.26, 0.17, 0.1], [0, 0.09, 0], m.dark);
  cylinder(cameraProxy, 0.06, 0.06, 0.12, [0, 0.09, 0.08], m.dark).rotation.x = Math.PI / 2;
  owner.registerClickable(cameraGroup, { type: 'navigate', href: '/hobbies/', label: 'Hobbies · the camera' });
  const sculptureRoot = group(room, [0.76, 0.813, -0.12]);
  box(sculptureRoot, [0.2, 0.04, 0.19], [0, 0.02, 0], material('#77786f'));
  const sculpture = new THREE.Mesh(new THREE.TorusKnotGeometry(0.089, 0.022, 100, 14, 2, 3), material('#b78e54', { metalness: 0.85, roughness: 0.26 }));
  sculpture.position.y = 0.17; sculpture.castShadow = true; sculptureRoot.add(sculpture); owner.sculpture = sculpture;
  owner.registerClickable(sculptureRoot, { type: 'inspect', label: 'Inspect the bronze sculpture' });
  const chairRoot = group(room, [-0.4, 0.035, 0.98]); chairRoot.rotation.y = -0.16;
  const chairProxy = group(chairRoot); chairProxy.name = 'asset-proxy';
  box(chairProxy, [0.73, 0.12, 0.68], [0, 0.44, 0], m.fabric, 0.08);
  box(chairProxy, [0.73, 0.65, 0.12], [0, 0.79, 0.27], m.fabric, 0.07);
  for (const x of [-0.28, 0.28]) for (const z of [-0.26, 0.26]) rod(chairProxy, [x, 0, z], [x, 0.4, z], 0.022, m.oak);
  const plantRoot = group(room, [2.54, 0.011, -1.66]), plantProxy = group(plantRoot);
  plantProxy.name = 'asset-proxy';
  cylinder(plantProxy, 0.22, 0.17, 0.36, [0, 0.18, 0], m.white);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    rod(plantProxy, [0, 0.3, 0], [Math.sin(a) * 0.3, 0.72 + (i % 3) * 0.18, Math.cos(a) * 0.3], 0.007, material('#4c6550'));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material('#526f4e')); leaf.scale.set(0.10, 0.24, 0.028); leaf.position.set(Math.sin(a) * 0.28, 0.75 + (i % 3) * 0.18, Math.cos(a) * 0.28); leaf.rotation.set(0.4, a, 0.6); plantProxy.add(leaf);
  }
  addOfficeDetails(owner, room, m, { box, cylinder, rod, group, canvasTexture, material });
  batchStaticGeometry(room);
  owner.essentialAssets = loadWood(owner, m);
  owner.decorativeAssets = owner.essentialAssets.then(() => owner.destroyed ? [] : Promise.allSettled([
    loadModel(owner, 'modern_arm_chair_01', chairRoot, chairProxy, 1.05, Math.PI),
    loadModel(owner, 'Camera_01', cameraGroup, cameraProxy, 0.22, 0),
    loadModel(owner, 'potted_plant_01', plantRoot, plantProxy, 1.45, 0),
    loadGardenShrubs(owner, garden),
  ])).then(results => {
    if (owner.destroyed) return;
    owner.container.dataset.assets = results.every(result => result.status === 'fulfilled') && !owner.assetFailure ? 'ready' : 'partial'; owner.invalidate();
  });
  return room;
}
function createEnclosure(owner, room, m) {
  const wall = m.white;
  box(room, [0.12, 3.1, 4.9], [3.44, 1.55, 0], wall);
  box(room, [4.15, 3.1, 0.18], [-1.325, 1.55, 2.41], wall);
  box(room, [1.35, 3.1, 0.18], [2.725, 1.55, 2.41], wall);
  box(room, [1.3, 0.75, 0.18], [1.4, 2.725, 2.41], wall);
  box(room, [6.9, 0.14, 6.96], [0, 3.17, 1], wall);
  const hallwayFloor = material('#c7c3b8', { roughness: 0.65 });
  box(room, [6.9, 0.08, 2.04], [0, -0.03, 3.46], hallwayFloor);
  box(room, [6.9, 3.1, 0.14], [0, 1.55, 4.45], wall);
  for (const x of [-3.44, 3.44]) {
    box(room, [0.12, 3.1, 2.08], [x, 1.55, 3.46], wall);
    box(room, [0.035, 0.09, 6.8], [x * 0.975, 0.07, 1], wall);
  }
  for (const [x, width] of [[-1.325, 4.15], [2.725, 1.35]]) {
    for (const z of [2.29, 2.53]) box(room, [width, 0.09, 0.035], [x, 0.07, z], wall);
  }
  for (const x of [0.70, 2.10]) box(room, [0.09, 2.42, 0.25], [x, 1.21, 2.41], m.oak);
  box(room, [1.49, 0.085, 0.25], [1.4, 2.39, 2.41], m.oak);
  const door = box(room, [0.055, 2.32, 1.16], [2.085, 1.17, 3.08], m.oak, 0.012);
  cylinder(door, 0.027, 0.027, 0.13, [-0.09, -0.11, 0.43], m.metal).rotation.z = Math.PI / 2;
  box(room, [0.3, 0.2, 0.016], [0.55, 2.05, 2.514], m.dark);
  const nameplate = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), material('#ffffff', { map: canvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#333e38'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#eee9dc';
    ctx.textAlign = 'center'; ctx.font = '60px sans-serif'; ctx.fillText('RONALD', w / 2, 103);
    ctx.fillStyle = '#c4c5b8'; ctx.font = '26px sans-serif'; ctx.fillText('THE OFFICE / 01', w / 2, 164);
  }, 512, 256) }));
  nameplate.position.set(0.55, 2.05, 2.526); room.add(nameplate);
  owner.registerClickable(nameplate, { type: 'navigate', href: '/', label: 'Home · the entrance' });
  owner.registerClickable(door, { type: 'navigate', href: '/', label: 'Home · return to the hallway' });
  // Soft ceiling light keeps the enclosed interior readable without brightening windows.
  for (const [x, z] of [[0, 3.45]]) {
    box(room, [1.3, 0.025, 0.12], [x, 3.075, z], material('#fff4d9', { emissive: '#fff1d7', emissiveIntensity: 1 }));
    const light = new THREE.PointLight('#ffecd1', z > 2 ? 10 : 16, 9, 2);
    light.position.set(x, 2.88, z); room.add(light);
  }
  // A quiet hallway print provides detail when the visitor turns around.
  const hallPrint = group(room, [-0.4, 1.72, 4.35]); hallPrint.rotation.y = Math.PI;
  box(hallPrint, [0.9, 1.1, 0.035], [0, 0, 0], m.oak);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.02), material('#ffffff', { map: printTexture('art') })); print.position.z = 0.024; hallPrint.add(print);
}
function createGarden(owner, m) {
  const garden = group(owner.scene); garden.name = 'window-garden';
  owner.scene.background = new THREE.Color('#d6e5ed'); owner.scene.fog = new THREE.Fog('#d6e5ed', 18, 48);
  box(garden, [28, 0.08, 36], [-17.6, -0.12, 0], material('#779260', { roughness: 1 }), 0);
  box(garden, [1.4, 0.025, 16], [-4.45, -0.035, 0], material('#b8b7a7'), 0);
  for (let z = -8; z <= 8; z += 0.8) box(garden, [1.43, 0.003, 0.012], [-4.45, -0.019, z], material('#95958b'), 0);
  const hedge = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 7), material('#4d6c47'), 54);
  for (let i = 0; i < 54; i++) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(-14 + Math.sin(i * 3) * 0.23, 0.47 + (i % 3) * 0.11, -14 + Math.floor(i / 3) * 1.6 + (i % 3 - 1) * 0.48), new THREE.Quaternion(), new THREE.Vector3(0.8, 0.62, 0.84));
    hedge.setMatrixAt(i, matrix);
  }
  garden.add(hedge);
  let seed = 81;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const leafGeometry = new THREE.SphereGeometry(1, 8, 5), leafMaterial = material('#5a7947', { roughness: 0.95 });
  const matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  for (const [x, z, height] of [[-8, -3.2, 5.6], [-10.5, 3, 6.5], [-7.2, 6.8, 5.2], [-11.8, -8, 6.2]]) {
    const tree = group(garden, [x, 0, z]);
    cylinder(tree, 0.065, 0.18, height * 0.65, [0, height * 0.325, 0], material('#655344'));
    for (let k = 0; k < 7; k++) {
      const angle = k * 2.4;
      rod(tree, [0, height * 0.3, 0], [Math.sin(angle) * 1.15, height * (0.6 + k * 0.035), Math.cos(angle) * 1.15], 0.04, m.oak);
    }
    const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, 650);
    for (let i = 0; i < 650; i++) {
      const theta = random() * Math.PI * 2, y = random() * 2 - 1, radius = Math.cbrt(random());
      const ring = Math.sqrt(1 - y * y);
      position.set(Math.cos(theta) * ring * radius * 1.85, height * 0.7 + y * radius * 1.55, Math.sin(theta) * ring * radius * 1.85);
      quat.setFromEuler(new THREE.Euler(random() * 3, random() * 6, random() * 3));
      scale.set(0.15 + random() * 0.13, 0.04, 0.09 + random() * 0.1);
      matrix.compose(position, quat, scale); leaves.setMatrixAt(i, matrix);
      leaves.setColorAt(i, new THREE.Color().setHSL(0.22 + random() * 0.09, 0.25 + random() * 0.2, 0.25 + random() * 0.15));
    }
    tree.add(leaves);
  }
  return garden;
}
async function loadGardenShrubs(owner, garden) {
  const holder = group(garden, [-5.8, 0, -0.5]), proxy = group(holder);
  await loadModel(owner, 'shrub_01', holder, proxy, 1.35, 0);
  if (owner.destroyed) return;
  const keepOutside = object => {
    object.updateWorldMatrix(true, true);
    const edge = new THREE.Box3().setFromObject(object).max.x;
    if (edge > -3.85) object.position.x -= edge + 3.85;
  };
  keepOutside(holder);
  for (const [x, z, scale] of [[-6.2, 2.4, 0.8], [-5.6, -3.9, 1.1], [-9.6, 0.5, 1.4]]) {
    const shrub = holder.clone(); shrub.position.set(x, 0, z); shrub.scale.setScalar(scale); garden.add(shrub); keepOutside(shrub);
  }
  owner.invalidate(true);
}
async function loadWood(owner, m) {
  const tier = owner.mobile ? '1k' : '2k', loader = new THREE.TextureLoader();
  const results = await Promise.allSettled(['color', 'normal', 'roughness'].map(name => loader.loadAsync(`/office/wood/${name}-${name === 'color' ? tier : '1k'}.jpg`)));
  if (owner.destroyed) { results.forEach(r => r.status === 'fulfilled' && r.value.dispose()); return; }
  const names = ['map', 'normalMap', 'roughnessMap'];
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') { owner.assetFailure = true; return; }
    const texture = result.value; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2); texture.anisotropy = Math.min(4, owner.renderer.capabilities.getMaxAnisotropy());
    if (i === 0) texture.colorSpace = THREE.SRGBColorSpace;
    m.floor[names[i]] = texture; m.floor.needsUpdate = true;
    const deskTexture = texture.clone(); deskTexture.repeat.set(1.2, 1.2); deskTexture.needsUpdate = true;
    m.oak[names[i]] = deskTexture; m.oak.needsUpdate = true;
  });
  m.floor.normalScale.set(0.35, 0.35); m.oak.normalScale.set(0.22, 0.22); owner.invalidate();
}
async function loadModel(owner, id, parent, proxy, height, yaw) {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`/office/${id}.glb`);
  if (owner.destroyed) { disposeObject(gltf.scene); return; }
  const model = gltf.scene; model.rotation.y = yaw; model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  model.scale.setScalar(height / size.y); model.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(model), center = scaled.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaled.min.y, -center.z);
  model.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  parent.add(model); parent.remove(proxy);
  // Fallbacks share materials with the room; dispose only their unique geometry here.
  (owner.retiredProxies ??= []).push(proxy); owner.invalidate(true);
}
export function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!mat) continue; materials.add(mat); Object.values(mat).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
}

// Keep independently interactive objects intact; consolidate architectural detail
// into a few draws, with exactly the same world-space geometry and raycast surface.
function batchStaticGeometry(room) {
  room.updateMatrixWorld(true);
  const batches = new Map();
  room.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material) || mesh.material.transparent) return;
    let parent = mesh;
    while (parent && parent !== room) {
      if (parent.userData.action || parent.name === 'ceiling-fan' || parent.name === 'asset-proxy') return;
      parent = parent.parent;
    }
    const key = `${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(mesh);
  });
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      // Imported tangents and vertex colors aren't present on these primitives.
      return geometry;
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const batch = new THREE.Mesh(merged, meshes[0].material);
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow;
    room.add(batch);
    meshes.forEach(mesh => { mesh.removeFromParent(); mesh.geometry.dispose(); });
  }
}
