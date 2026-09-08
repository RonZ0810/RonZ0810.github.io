import * as THREE from 'three';
import { getSceneRoute, hotspotPoints } from './scene-routes.js';
import { createOffice, disposeObject } from './office-room.js';

const clamp = THREE.MathUtils.clamp;
const ease = t => 1 - Math.pow(1 - t, 3);
const copyPose = p => ({ ...p, target: p.target.clone() });
const angleNear = (angle, reference) => reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}

export class StudyScene {
  constructor(container, options = {}) {
    if (!supportsWebGL()) throw new Error('WebGL 2 is unavailable.');
    this.container = container;
    this.onHotspot = options.onHotspot ?? (() => {});
    this.onTransitionState = options.onTransitionState ?? (() => {});
    this.onState = options.onState ?? (() => {});
    this.onFailure = options.onFailure ?? (() => {});
    this.reducedMotion = Boolean(options.reducedMotion);
    this.mobile = window.innerWidth < 861;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.domElement.className = 'study-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);
    this.events = new AbortController();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clickables = [];
    this.hotspotElements = [];
    this.currentKey = 'home';
    this.lampOn = true; this.notebookOpen = false; this.inspecting = false;
    this.frame = 0; this.destroyed = false; this.contextLost = false;
    this.pose = this.routePose('home'); this.desired = copyPose(this.pose);
    this.renderFrame = this.renderFrame.bind(this);
    try { this.room = createOffice(this); } catch (error) { this.destroy(); throw error; }
    this.highlight = new THREE.Box3Helper(new THREE.Box3(), '#b45d39');
    this.highlight.material.depthTest = false;
    this.highlight.material.transparent = true;
    this.highlight.material.opacity = 0.7;
    this.highlight.visible = false; this.scene.add(this.highlight);
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.inViewport = entries[0].isIntersecting;
      if (this.inViewport) this.invalidate();
      else {
        this.skipTransition();
        this.stopFrame();
      }
    });
    this.inViewport = true; this.visibilityObserver.observe(container);
    window.addEventListener('scroll', () => this.invalidate(), { passive: true, signal: this.events.signal });
    this.resize(); this.syncState();
  }

  routePose(key) {
    const route = getSceneRoute(key).camera;
    const target = new THREE.Vector3(...route.target);
    const spherical = new THREE.Spherical().setFromVector3(new THREE.Vector3(...route.position).sub(target));
    return { target, theta: spherical.theta, phi: spherical.phi, radius: spherical.radius, fov: route.fov };
  }
  registerClickable(object, action) { object.userData.action = action; this.clickables.push(object); }
  setHotspotElements(elements) {
    this.hotspotElements = [...elements].map(element => ({ element, key: element.dataset.hotspot })).filter(({ key }) => hotspotPoints[key]);
    this.invalidate();
  }
  setReducedMotion(value) {
    this.reducedMotion = value;
    if (value) { this.skipTransition(); this.pose = copyPose(this.desired); }
    this.syncState(); this.invalidate();
  }
  transitionTo(key, { immediate = false } = {}) {
    this.exitInspection(false);
    this.currentKey = key;
    this.setHighlight(null);
    this.moveTo(this.routePose(key), immediate);
    this.resize();
  }
  moveTo(pose, immediate = false) {
    pose.theta = angleNear(pose.theta, this.pose.theta);
    this.desired = copyPose(pose);
    if (immediate || this.reducedMotion) {
      this.pose = copyPose(pose); this.transition = null; this.onTransitionState(false);
    } else {
      this.transition = { from: copyPose(this.pose), to: copyPose(pose), start: performance.now(), duration: 1050 };
      this.onTransitionState(true);
    }
    this.invalidate();
  }
  skipTransition() {
    if (this.transition) this.pose = copyPose(this.transition.to);
    this.transition = null; this.onTransitionState(false); this.invalidate();
  }
  rotate(dx, dy) {
    if (this.inspecting) {
      this.sculpture.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(dy, dx, 0, 'YXZ')));
    } else {
      if (this.transition) { this.transition = null; this.desired = copyPose(this.pose); this.onTransitionState(false); }
      this.desired.theta += dx;
      this.desired.phi = clamp(this.desired.phi + dy, Math.PI / 9, Math.PI * 0.4);
      if (this.reducedMotion) this.pose = copyPose(this.desired);
    }
    this.invalidate();
  }
  zoomBy(factor) {
    this.skipTransition();
    const base = this.inspecting ? 0.9 : this.routePose(this.currentKey).radius;
    this.desired.radius = clamp(this.desired.radius * factor, base * 0.55, base * 1.45);
    if (this.reducedMotion) this.pose = copyPose(this.desired);
    this.invalidate();
  }
  resetView() { this.exitInspection(false); this.moveTo(this.routePose(this.currentKey)); }
  toggleLamp() {
    this.lampOn = !this.lampOn;
    this.lampLight.intensity = this.lampOn ? 7 : 0;
    this.lampMaterial.emissiveIntensity = this.lampOn ? 2.2 : 0;
    this.syncState(); this.invalidate();
  }
  toggleNotebook() { this.notebookOpen = !this.notebookOpen; this.syncState(); this.invalidate(); }
  inspect() {
    if (this.inspecting) return;
    this.inspectionReturnPose = copyPose(this.desired); this.inspecting = true;
    const target = this.sculpture.getWorldPosition(new THREE.Vector3());
    this.moveTo({ target, theta: 0.35, phi: Math.PI / 2.8, radius: 0.9, fov: 35 });
    this.setHighlight(null); this.syncState();
  }
  exitInspection(restore = true) {
    if (!this.inspecting) return;
    this.inspecting = false;
    if (restore) this.moveTo(copyPose(this.inspectionReturnPose));
    this.renderer.shadowMap.needsUpdate = true;
    this.syncState();
  }
  act(action) {
    if (action.type === 'navigate') {
      if (action.href === '/about/' && !this.notebookOpen) this.toggleNotebook();
      this.onHotspot(action.href);
    } else if (action.type === 'lamp') this.toggleLamp();
    else if (action.type === 'inspect') this.inspect();
  }
  syncState() {
    const state = { lampOn: this.lampOn, notebookOpen: this.notebookOpen, inspecting: this.inspecting, reducedMotion: this.reducedMotion };
    this.container.dataset.lamp = this.lampOn ? 'on' : 'off';
    this.container.dataset.notebook = this.notebookOpen ? 'open' : 'closed';
    this.container.dataset.inspection = this.inspecting ? 'sculpture' : 'none';
    this.onState(state);
  }
  bindEvents() {
    const canvas = this.renderer.domElement, signal = this.events.signal;
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary) return;
      this.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, touch: event.pointerType === 'touch' };
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      const drag = this.drag;
      if (drag && drag.id === event.pointerId) {
        const totalX = event.clientX - drag.startX, totalY = event.clientY - drag.startY;
        if (Math.hypot(totalX, totalY) > 6) drag.moved = true;
        if (drag.touch && !drag.locked && Math.abs(totalY) > Math.abs(totalX) && Math.abs(totalY) > 6) {
          this.cancelDrag(); return;
        }
        if (drag.moved) {
          drag.locked = true;
          this.rotate(-(event.clientX - drag.x) * 0.007, drag.touch ? 0 : -(event.clientY - drag.y) * 0.006);
          this.setHighlight(null);
        }
        drag.x = event.clientX; drag.y = event.clientY;
      } else {
        this.setHighlight(this.inspecting ? null : this.pick(event));
      }
    }, { signal });
    canvas.addEventListener('pointerup', event => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      const clicked = !drag.moved;
      this.cancelDrag();
      if (clicked && !this.inspecting) {
        const target = this.pick(event); if (target) this.act(target.userData.action);
      }
    }, { signal });
    canvas.addEventListener('pointercancel', () => this.cancelDrag(), { signal });
    canvas.addEventListener('lostpointercapture', () => { this.drag = null; canvas.style.cursor = 'grab'; }, { signal });
    canvas.addEventListener('pointerleave', () => { if (!this.drag) this.setHighlight(null); }, { signal });
    this.container.addEventListener('keydown', event => {
      const movements = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
      if (movements[event.key]) { event.preventDefault(); this.rotate(...movements[event.key]); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomBy(0.85); }
      if (event.key === '-') { event.preventDefault(); this.zoomBy(1.18); }
      if (event.key === 'Home') { event.preventDefault(); this.resetView(); }
    }, { signal });
    document.addEventListener('focusin', event => {
      const hotspot = event.target.closest('[data-hotspot]');
      this.setHighlight(hotspot ? this.clickables.find(object => object.userData.action.href === hotspot.getAttribute('href')) : null);
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopFrame(); else this.invalidate();
    }, { signal });
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.contextLost = true; this.stopFrame(); this.onFailure();
    }, { signal });
    canvas.addEventListener('webglcontextrestored', () => {
      // A fresh scene gives textures and shadow targets a clean lifecycle after recovery.
      this.onFailure(true);
    }, { signal });
  }
  cancelDrag() {
    const id = this.drag?.id; this.drag = null;
    if (id !== undefined && this.renderer.domElement.hasPointerCapture(id)) this.renderer.domElement.releasePointerCapture(id);
    this.renderer.domElement.style.cursor = 'grab';
  }
  pick(event) {
    const bounds = this.container.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.room, true);
    for (const hit of hits) {
      if (hit.object.material?.opacity < 0.2) continue;
      let object = hit.object;
      while (object && object !== this.room) {
        if (object.userData.action) return object;
        object = object.parent;
      }
      // Opaque furnishings block objects behind them.
      if (!hit.object.material?.transparent || hit.object.material.opacity > 0.85) return null;
    }
    return null;
  }
  setHighlight(object) {
    if (this.highlighted === object) return;
    this.highlighted = object;
    if (this.highlight) this.highlight.visible = Boolean(object);
    const hint = document.querySelector('[data-object-hint]');
    if (hint) hint.textContent = object?.userData.action.label ?? (this.inspecting ? 'Drag to turn the sculpture' : 'Drag to look around · select an object to explore');
    this.renderer.domElement.style.cursor = object ? 'pointer' : 'grab';
    this.hotspotElements.forEach(({ element }) => element.classList.toggle('is-highlighted', Boolean(object?.userData.action.href === element.getAttribute('href'))));
    this.invalidate();
  }
  resize() {
    if (this.destroyed) return;
    const width = this.container.clientWidth || 1, height = this.container.clientHeight || 1;
    this.width = width; this.height = height;
    this.camera.aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.25 : 1.6));
    this.renderer.setSize(width, height, false); this.camera.updateProjectionMatrix(); this.invalidate();
  }
  updateHotspots() {
    const bounds = this.container.getBoundingClientRect(), occupied = [];
    this.hotspotElements.forEach(({ element, key }) => {
      const point = new THREE.Vector3(...hotspotPoints[key]).project(this.camera);
      const x = (point.x * 0.5 + 0.5) * bounds.width, y = (-point.y * 0.5 + 0.5) * bounds.height;
      const visible = !this.inspecting && this.currentKey === 'home' && point.z > -1 && point.z < 1 && x > 65 && x < bounds.width - 65 && y > 50 && y < bounds.height - 65 && !occupied.some(p => Math.abs(p.x - x) < 112 && Math.abs(p.y - y) < 36);
      element.hidden = !visible;
      if (visible) { occupied.push({ x, y }); element.style.setProperty('--hotspot-x', `${x + bounds.left}px`); element.style.setProperty('--hotspot-y', `${y + bounds.top}px`); }
    });
  }
  invalidate(shadows = false) {
    if (shadows && this.renderer) this.renderer.shadowMap.needsUpdate = true;
    if (this.destroyed || this.contextLost || document.hidden || this.inViewport === false || this.frame) return;
    this.frame = requestAnimationFrame(this.renderFrame);
  }
  stopFrame() { cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = null; }
  renderFrame(time) {
    this.frame = 0;
    if (this.destroyed || this.contextLost) return;
    const dt = Math.min((time - (this.lastTime ?? time - 16)) / 1000, 0.06); this.lastTime = time;
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 13);
    if (this.transition) {
      const t = clamp((time - this.transition.start) / this.transition.duration, 0, 1), eased = ease(t);
      this.pose.target.lerpVectors(this.transition.from.target, this.transition.to.target, eased);
      for (const key of ['theta', 'phi', 'radius', 'fov']) this.pose[key] = THREE.MathUtils.lerp(this.transition.from[key], this.transition.to[key], eased);
      if (t === 1) { this.transition = null; this.onTransitionState(false); }
    } else {
      this.pose.target.lerp(this.desired.target, blend);
      for (const key of ['theta', 'phi', 'radius', 'fov']) this.pose[key] = THREE.MathUtils.lerp(this.pose[key], this.desired[key], blend);
    }
    // Portrait overview backs away enough to keep the architecture in frame.
    const fit = this.currentKey === 'home' && !this.inspecting ? Math.max(1, 1.05 / this.camera.aspect) : Math.max(1, 0.7 / this.camera.aspect);
    const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(this.pose.radius * fit, this.pose.phi, this.pose.theta));
    this.camera.position.copy(this.pose.target).add(offset); this.camera.fov = this.pose.fov;
    this.camera.updateProjectionMatrix(); this.camera.lookAt(this.pose.target); this.camera.updateMatrixWorld();
    let wallMoving = false;
    this.walls.forEach(wall => {
      const visibility = this.camera.position[wall.axis] < wall.threshold + 0.8 ? 0.06 : 1;
      wall.group.traverse(object => {
        if (!object.isMesh || object.userData.originalOpacity === undefined) return;
        const target = object.userData.originalOpacity * visibility;
        object.material.opacity = THREE.MathUtils.lerp(object.material.opacity, target, blend);
        object.material.depthWrite = object.material.opacity > 0.85;
        if (Math.abs(object.material.opacity - target) > 0.002) wallMoving = true;
      });
    });
    const bookTarget = this.notebookOpen ? Math.PI * 0.84 : 0;
    const wasBookMoving = Math.abs(this.notebookHinge.rotation.z - bookTarget) > 0.002;
    this.notebookHinge.rotation.z = THREE.MathUtils.lerp(this.notebookHinge.rotation.z, bookTarget, blend);
    if (wasBookMoving && Math.abs(this.notebookHinge.rotation.z - bookTarget) <= 0.002) this.renderer.shadowMap.needsUpdate = true;
    if (this.highlighted) this.highlight.box.setFromObject(this.highlighted).expandByScalar(0.012);
    this.scene.updateMatrixWorld(true); this.updateHotspots(); this.renderer.render(this.scene, this.camera);
    this.container.dataset.viewAngle = this.pose.theta.toFixed(3);
    const moving = this.transition || wallMoving || Math.abs(this.notebookHinge.rotation.z - bookTarget) > 0.002 || this.pose.target.distanceToSquared(this.desired.target) > 0.000001 || ['theta', 'phi', 'radius', 'fov'].some(k => Math.abs(this.pose[k] - this.desired[k]) > 0.0001);
    if (moving) this.invalidate(); else this.lastTime = null;
  }
  destroy() {
    this.destroyed = true; this.stopFrame(); this.events?.abort(); this.resizeObserver?.disconnect(); this.visibilityObserver?.disconnect();
    this.scene.traverse(object => object.shadow?.dispose());
    disposeObject(this.scene); this.retiredProxies?.forEach(disposeObject); this.environmentTarget?.dispose(); this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}
