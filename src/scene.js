import * as THREE from 'three';
import { getSceneRoute, hotspotPoints } from './scene-routes.js';

const PALETTE = {
  plaster: 0xd8cdbd,
  paper: 0xf2eadc,
  charcoal: 0x29231d,
  walnut: 0x5d3b28,
  darkWalnut: 0x3d281d,
  brass: 0xa78252,
  accent: 0xb65d34,
  fadedAccent: 0x87513a,
  courtyard: 0x825b3d,
  dusk: 0x2f2925,
  green: 0x526148,
};

const vec = (values) => new THREE.Vector3(...values);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const easeOutQuart = (progress) => 1 - Math.pow(1 - progress, 4);

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.74,
    metalness: 0,
    ...options,
  });
}

function addBox(parent, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 18),
    material,
  );
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addSphere(parent, radius, position, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPlane(parent, width, height, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export class StudyScene {
  constructor(container, options = {}) {
    if (!supportsWebGL()) {
      throw new Error('WebGL is unavailable.');
    }

    this.container = container;
    this.onHotspot = options.onHotspot ?? (() => {});
    this.onTransitionState = options.onTransitionState ?? (() => {});
    this.reducedMotion = Boolean(options.reducedMotion);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.plaster);
    this.scene.fog = new THREE.Fog(PALETTE.plaster, 15, 28);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'study-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.replaceChildren(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clickables = [];
    this.focusRings = new Map();
    this.hotspotElements = [];
    this.currentKey = 'home';
    this.transition = null;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.zoom = 1;
    this.pointerStart = null;
    this.dragged = false;
    this.basePosition = vec(getSceneRoute('home').camera.position);
    this.baseTarget = vec(getSceneRoute('home').camera.target);
    this.baseFov = getSceneRoute('home').camera.fov;

    this.buildStudy();
    this.resize();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.transitionTo('home', { immediate: true });
    this.renderFrame = this.renderFrame.bind(this);
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = reducedMotion;
    if (reducedMotion && this.transition) {
      this.skipTransition();
    }
  }

  setHotspotElements(elements) {
    this.hotspotElements = [...elements]
      .map((element) => ({ element, key: element.dataset.hotspot }))
      .filter(({ key }) => hotspotPoints[key]);
    this.updateHotspots();
  }

  transitionTo(key, { immediate = false } = {}) {
    const route = getSceneRoute(key);
    const nextPosition = vec(route.camera.position);
    const nextTarget = vec(route.camera.target);
    const shouldJump = immediate || this.reducedMotion;
    this.currentKey = key;
    this.orbitYaw = 0;
    this.orbitPitch = 0;
    this.zoom = 1;
    this.setFocusedRoute(route.focusHref);

    if (shouldJump) {
      this.basePosition.copy(nextPosition);
      this.baseTarget.copy(nextTarget);
      this.baseFov = route.camera.fov;
      this.transition = null;
      this.onTransitionState(false);
      this.updateHotspots();
      return;
    }

    this.transition = {
      startedAt: performance.now(),
      duration: 1120,
      fromPosition: this.basePosition.clone(),
      fromTarget: this.baseTarget.clone(),
      fromFov: this.baseFov,
      toPosition: nextPosition,
      toTarget: nextTarget,
      toFov: route.camera.fov,
    };
    this.onTransitionState(true);
  }

  skipTransition() {
    if (!this.transition) return;
    this.basePosition.copy(this.transition.toPosition);
    this.baseTarget.copy(this.transition.toTarget);
    this.baseFov = this.transition.toFov;
    this.transition = null;
    this.onTransitionState(false);
    this.updateHotspots();
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const mobile = width < 720;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5));
    this.renderer.setSize(width, height, false);
  }

  bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => {
      this.pointerStart = { x: event.clientX, y: event.clientY, yaw: this.orbitYaw, pitch: this.orbitPitch };
      this.dragged = false;
      canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (this.pointerStart) {
        const deltaX = event.clientX - this.pointerStart.x;
        const deltaY = event.clientY - this.pointerStart.y;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 4) this.dragged = true;
        this.orbitYaw = clamp(this.pointerStart.yaw - deltaX * 0.0035, -0.28, 0.28);
        this.orbitPitch = clamp(this.pointerStart.pitch - deltaY * 0.0024, -0.15, 0.16);
      }
      this.updatePointer(event);
    });

    canvas.addEventListener('pointerup', (event) => {
      if (!this.dragged) this.pick(event);
      this.pointerStart = null;
      canvas.releasePointerCapture?.(event.pointerId);
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        this.zoom = clamp(this.zoom + event.deltaY * 0.00045, 0.88, 1.13);
        event.preventDefault();
      },
      { passive: false },
    );
  }

  updatePointer(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const target = this.findClickable(this.raycaster.intersectObjects(this.clickables, true));
    this.renderer.domElement.style.cursor = target ? 'pointer' : this.pointerStart ? 'grabbing' : 'grab';
  }

  pick(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const target = this.findClickable(this.raycaster.intersectObjects(this.clickables, true));
    if (target?.userData.href) this.onHotspot(target.userData.href);
  }

  findClickable(intersections) {
    for (const intersection of intersections) {
      let object = intersection.object;
      while (object) {
        if (object.userData?.href) return object;
        object = object.parent;
      }
    }
    return null;
  }

  registerClickable(group, href) {
    group.userData.href = href;
    this.clickables.push(group);
  }

  addFocusRing(href, position, scale = 1, rotation = [Math.PI / 2, 0, 0]) {
    const material = new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.52 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56 * scale, 0.026, 8, 40), material);
    ring.position.set(...position);
    ring.rotation.set(...rotation);
    ring.visible = false;
    this.scene.add(ring);
    const rings = this.focusRings.get(href) ?? [];
    rings.push(ring);
    this.focusRings.set(href, rings);
  }

  setFocusedRoute(href) {
    for (const [routeHref, rings] of this.focusRings.entries()) {
      rings.forEach((ring) => {
        ring.visible = routeHref === href;
      });
    }
  }

  buildStudy() {
    const room = new THREE.Group();
    room.name = 'quiet-study';
    this.scene.add(room);

    const plaster = standard(PALETTE.plaster, { roughness: 0.95 });
    const paper = standard(PALETTE.paper);
    const walnut = standard(PALETTE.walnut);
    const darkWalnut = standard(PALETTE.darkWalnut);
    const brass = standard(PALETTE.brass, { metalness: 0.58, roughness: 0.34 });
    const accent = standard(PALETTE.accent);
    const green = standard(PALETTE.green);

    const hemisphere = new THREE.HemisphereLight(0xf6dec4, 0x45372d, 1.7);
    this.scene.add(hemisphere);
    const keyLight = new THREE.DirectionalLight(0xffe8c9, 2.2);
    keyLight.position.set(-3, 7.5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    this.scene.add(keyLight);
    const lampLight = new THREE.PointLight(0xffc27d, 18, 10, 2);
    lampLight.position.set(-1.8, 3.65, 1.2);
    lampLight.castShadow = true;
    this.scene.add(lampLight);
    const windowLight = new THREE.PointLight(0xffa265, 12, 9, 2);
    windowLight.position.set(3.1, 3.3, -3.8);
    this.scene.add(windowLight);

    addBox(room, [17.2, 0.25, 14.2], [0, -0.12, 0], darkWalnut);
    addBox(room, [17.2, 0.05, 14.2], [0, 0.03, 0], walnut);
    addBox(room, [17.2, 7, 0.2], [0, 3.4, -5.8], plaster);
    addBox(room, [0.2, 7, 14.2], [-8.5, 3.4, 0], plaster);
    addBox(room, [0.2, 7, 14.2], [8.5, 3.4, 0], plaster);
    addBox(room, [6.5, 0.04, 4.1], [-0.5, 0.08, 1.45], standard(0x9a765c));

    this.buildResumeBoard(room, { paper, walnut, accent, brass });
    this.buildProjectBench(room, { paper, walnut, darkWalnut, accent, brass });
    this.buildTimeline(room, { paper, walnut, brass, accent });
    this.buildCourtyard(room, { walnut, darkWalnut, brass, accent, green });
    this.buildHobbyTable(room, { paper, walnut, darkWalnut, brass, accent, green });
    this.buildDeskAndAvatar(room, { paper, walnut, darkWalnut, brass, accent });
    this.buildShelf(room, { paper, walnut, accent, green });
  }

  buildResumeBoard(parent, materials) {
    const group = new THREE.Group();
    group.position.set(-4.2, 0, -5.56);
    parent.add(group);
    addBox(group, [3.1, 3.45, 0.12], [0, 2.52, 0.1], materials.walnut);
    addBox(group, [2.86, 3.18, 0.06], [0, 2.52, 0.02], standard(0x91795d));
    const pages = [
      [-0.62, 2.84, 0.08, 1.0, 1.3],
      [0.63, 2.82, 0.08, 0.95, 1.55],
      [-0.55, 1.55, 0.08, 1.18, 0.74],
      [0.58, 1.43, 0.08, 0.96, 0.56],
    ];
    pages.forEach(([x, y, z, width, height], index) => {
      addBox(group, [width, height, 0.04], [x, y, z], materials.paper, [0, 0, (index - 1.5) * 0.035]);
      addCylinder(group, 0.065, 0.065, 0.04, [x - width * 0.3, y + height * 0.32, z + 0.03], materials.accent, [Math.PI / 2, 0, 0]);
    });
    this.registerClickable(group, '/about/');
    this.addFocusRing('/about/', [-4.2, 0.19, -5.2], 1.35);
  }

  buildProjectBench(parent, materials) {
    const group = new THREE.Group();
    group.position.set(2.75, 0, -1.8);
    parent.add(group);
    addBox(group, [4.1, 0.2, 2.25], [0, 1.03, 0], materials.walnut);
    [[-1.72, -0.9], [1.72, -0.9], [-1.72, 0.9], [1.72, 0.9]].forEach(([x, z]) => {
      addBox(group, [0.16, 1.95, 0.16], [x, 0.08, z], materials.darkWalnut);
    });
    const prototypes = [
      { href: '/projects/project-01/', x: -1.15, z: -0.25, material: materials.accent, shape: 'cube' },
      { href: '/projects/project-02/', x: 0, z: 0.2, material: materials.brass, shape: 'cylinder' },
      { href: '/projects/project-03/', x: 1.12, z: -0.24, material: materials.paper, shape: 'arch' },
    ];
    prototypes.forEach((prototype) => {
      const object = new THREE.Group();
      object.position.set(prototype.x, 1.27, prototype.z);
      group.add(object);
      if (prototype.shape === 'cube') {
        addBox(object, [0.66, 0.48, 0.66], [0, 0, 0], prototype.material, [0.14, 0.28, 0.02]);
      } else if (prototype.shape === 'cylinder') {
        addCylinder(object, 0.32, 0.32, 0.54, [0, 0, 0], prototype.material);
      } else {
        addBox(object, [0.72, 0.42, 0.24], [0, 0, 0], prototype.material, [0, 0.42, 0]);
        addCylinder(object, 0.22, 0.22, 0.25, [-0.25, 0.01, 0], prototype.material, [0, 0, Math.PI / 2]);
        addCylinder(object, 0.22, 0.22, 0.25, [0.25, 0.01, 0], prototype.material, [0, 0, Math.PI / 2]);
      }
      this.registerClickable(object, prototype.href);
    });
    this.registerClickable(group, '/projects/');
    this.addFocusRing('/projects/', [2.75, 0.18, -1.8], 1.4);
  }

  buildTimeline(parent, materials) {
    const group = new THREE.Group();
    group.position.set(8.28, 0, -1.1);
    parent.add(group);
    addBox(group, [0.08, 3.6, 0.08], [0, 2.28, 0], materials.brass);
    const roles = [
      { y: 3.35, z: -0.12 },
      { y: 2.28, z: 0 },
      { y: 1.2, z: 0.14 },
    ];
    roles.forEach(({ y, z }, index) => {
      addSphere(group, 0.2, [0, y, z], index === 1 ? materials.accent : materials.paper);
      addBox(group, [0.08, 0.52, 1.3], [-0.06, y, z - 0.7], materials.paper, [0, Math.PI / 2, 0]);
    });
    this.registerClickable(group, '/experience/');
    this.addFocusRing('/experience/', [7.96, 0.18, -1.1], 1.14);
  }

  buildCourtyard(parent, materials) {
    const group = new THREE.Group();
    group.position.set(3.05, 0, -5.69);
    parent.add(group);
    const outside = new THREE.MeshBasicMaterial({ color: PALETTE.courtyard });
    addPlane(group, 3.45, 3.9, [0, 2.48, -0.02], outside);
    addBox(group, [0.16, 4.1, 0.2], [-1.85, 2.48, 0.03], materials.walnut);
    addBox(group, [0.16, 4.1, 0.2], [1.85, 2.48, 0.03], materials.walnut);
    addBox(group, [3.85, 0.16, 0.2], [0, 4.45, 0.03], materials.walnut);
    addBox(group, [3.85, 0.16, 0.2], [0, 0.5, 0.03], materials.walnut);
    addBox(group, [0.08, 3.86, 0.17], [0, 2.48, 0.04], materials.brass);
    addBox(group, [3.6, 0.08, 0.17], [0, 2.48, 0.04], materials.brass);

    const exterior = new THREE.Group();
    exterior.position.set(0, 0.3, -1.8);
    group.add(exterior);
    [-1.12, 0, 1.12].forEach((x, index) => {
      addBox(exterior, [0.74, 1.3 + index * 0.24, 0.42], [x, 1.05 + index * 0.12, 0], materials.darkWalnut);
      addBox(exterior, [0.48, 0.2, 0.47], [x, 1.82 + index * 0.24, 0], materials.paper);
    });
    ['school-01', 'school-02', 'school-03'].forEach((slug, index) => {
      const marker = new THREE.Group();
      marker.position.set(-1.12 + index * 1.12, 1.96 + index * 0.24, 0.25);
      exterior.add(marker);
      addBox(marker, [0.54, 0.12, 0.08], [0, 0, 0], index === 1 ? materials.accent : materials.paper);
      this.registerClickable(marker, `/education/${slug}/`);
    });
    addCylinder(exterior, 0.46, 0.54, 0.34, [-1.18, 0.42, 0], materials.green);
    addCylinder(exterior, 0.46, 0.54, 0.34, [1.18, 0.42, 0], materials.green);
    this.registerClickable(group, '/education/');
    this.addFocusRing('/education/', [3.05, 0.18, -5.25], 1.1);
  }

  buildHobbyTable(parent, materials) {
    const group = new THREE.Group();
    group.position.set(-1.5, 0, 2.3);
    parent.add(group);
    addBox(group, [3.45, 0.2, 2.25], [0, 1.04, 0], materials.walnut);
    [[-1.4, -0.88], [1.4, -0.88], [-1.4, 0.88], [1.4, 0.88]].forEach(([x, z]) => {
      addBox(group, [0.14, 1.95, 0.14], [x, 0.08, z], materials.darkWalnut);
    });
    const book = new THREE.Group();
    book.position.set(-0.95, 1.2, -0.2);
    group.add(book);
    addBox(book, [0.74, 0.13, 0.53], [0, 0, 0], materials.paper, [0, 0.2, 0]);
    addBox(book, [0.74, 0.05, 0.53], [0, 0.1, 0], materials.accent, [0, 0.2, 0]);
    const camera = new THREE.Group();
    camera.position.set(0.05, 1.24, 0.15);
    group.add(camera);
    addBox(camera, [0.7, 0.36, 0.28], [0, 0, 0], materials.darkWalnut);
    addCylinder(camera, 0.14, 0.14, 0.16, [0, 0, 0.19], materials.brass, [Math.PI / 2, 0, 0]);
    const planter = new THREE.Group();
    planter.position.set(1.02, 1.25, -0.2);
    group.add(planter);
    addCylinder(planter, 0.3, 0.22, 0.3, [0, 0, 0], materials.brass);
    addSphere(planter, 0.35, [0, 0.36, 0], materials.green);
    this.registerClickable(group, '/hobbies/');
    this.addFocusRing('/hobbies/', [-1.5, 0.18, 2.3], 1.2);
  }

  buildDeskAndAvatar(parent, materials) {
    const group = new THREE.Group();
    group.position.set(-2.25, 0, -0.7);
    parent.add(group);
    addBox(group, [2.9, 0.2, 1.6], [0, 0.98, 0], materials.walnut);
    [[-1.14, -0.55], [1.14, -0.55], [-1.14, 0.55], [1.14, 0.55]].forEach(([x, z]) => {
      addBox(group, [0.14, 1.9, 0.14], [x, 0.05, z], materials.darkWalnut);
    });
    const avatar = new THREE.Group();
    avatar.position.set(-0.54, 1.34, -0.08);
    group.add(avatar);
    addCylinder(avatar, 0.23, 0.3, 0.45, [0, 0, 0], materials.accent);
    addSphere(avatar, 0.24, [0, 0.37, 0], materials.paper);
    addCylinder(avatar, 0.21, 0.21, 0.09, [0, 0.65, 0], materials.darkWalnut);
    addBox(group, [0.9, 0.05, 0.58], [0.56, 1.17, -0.18], materials.paper, [0.07, -0.22, -0.03]);
    addCylinder(group, 0.07, 0.07, 0.45, [1.05, 1.47, -0.35], materials.brass, [0.2, 0, 0]);
    addSphere(group, 0.12, [1.05, 1.7, -0.26], materials.paper);
    this.registerClickable(group, '/');
    this.addFocusRing('/', [-2.25, 0.18, -0.7], 1.08);
  }

  buildShelf(parent, materials) {
    const shelf = new THREE.Group();
    shelf.position.set(-7.65, 0, -1.45);
    parent.add(shelf);
    addBox(shelf, [0.48, 4.85, 3.6], [0, 2.42, 0], materials.walnut);
    [-1.3, 0, 1.3].forEach((z) => addBox(shelf, [0.56, 0.12, 3.4], [0, 1.15 + z, 0], materials.darkWalnut));
    const bookColors = [materials.paper, materials.accent, materials.green, materials.paper, materials.accent];
    bookColors.forEach((material, index) => {
      addBox(shelf, [0.4, 0.75 + (index % 2) * 0.18, 0.27], [0.22, 1.58 + Math.floor(index / 2) * 1.28, -1.1 + (index % 2) * 0.48], material, [0, 0.08 * index, 0]);
    });
  }

  updateTransition() {
    if (!this.transition) return;
    const elapsed = performance.now() - this.transition.startedAt;
    const progress = clamp(elapsed / this.transition.duration, 0, 1);
    const eased = easeOutQuart(progress);
    this.basePosition.lerpVectors(this.transition.fromPosition, this.transition.toPosition, eased);
    this.baseTarget.lerpVectors(this.transition.fromTarget, this.transition.toTarget, eased);
    this.baseFov = THREE.MathUtils.lerp(this.transition.fromFov, this.transition.toFov, eased);
    if (progress === 1) {
      this.transition = null;
      this.onTransitionState(false);
    }
  }

  applyCamera() {
    const offset = this.basePosition.clone().sub(this.baseTarget);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.orbitPitch, this.orbitYaw, 0, 'YXZ'));
    offset.applyQuaternion(rotation).multiplyScalar(this.zoom);
    this.camera.position.copy(this.baseTarget).add(offset);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.baseTarget);
  }

  updateHotspots() {
    const displayHotspots = this.currentKey === 'home';
    this.hotspotElements.forEach(({ element, key }) => {
      if (!displayHotspots) {
        element.hidden = true;
        return;
      }
      const point = vec(hotspotPoints[key]).project(this.camera);
      const visible = point.z < 1 && point.x > -1.08 && point.x < 1.08 && point.y > -1.08 && point.y < 1.08;
      element.hidden = !visible;
      if (visible) {
        const x = (point.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-point.y * 0.5 + 0.5) * window.innerHeight;
        element.style.setProperty('--hotspot-x', `${x}px`);
        element.style.setProperty('--hotspot-y', `${y}px`);
      }
    });
  }

  renderFrame() {
    this.updateTransition();
    this.applyCamera();
    this.updateHotspots();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.renderFrame);
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}

export { supportsWebGL };
