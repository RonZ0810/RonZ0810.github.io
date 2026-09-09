import * as THREE from 'three';
import { getSceneRoute, hotspotPoints } from './scene-routes.js';
import { createOffice, disposeObject } from './office-room.js';
import { EYE_HEIGHT, WALK_SPEED, WalkMap, distance } from './walking.js';

const clamp = THREE.MathUtils.clamp;
const nearAngle = (angle, reference) => reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
function viewToward(position, target) {
  const dx = target[0] - position.x, dz = target[2] - position.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(target[1] - EYE_HEIGHT, Math.hypot(dx, dz)) };
}
export function supportsWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); return true;
  } catch { return false; }
}
export class StudyScene {
  constructor(container, options = {}) {
    if (!supportsWebGL()) throw new Error('WebGL 2 is unavailable.');
    this.container = container;
    this.onContact = options.onContact ?? (() => {});
    this.onHotspot = options.onHotspot ?? (() => {});
    this.onTransitionState = options.onTransitionState ?? (() => {});
    this.onState = options.onState ?? (() => {});
    this.onFailure = options.onFailure ?? (() => {});
    this.onNotice = options.onNotice ?? (() => {});
    this.reducedMotion = Boolean(options.reducedMotion);
    this.mobile = window.innerWidth < 861;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.035, 70);
    this.camera.rotation.order = 'YXZ'; this.scene.add(this.camera);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.softwareRenderer = Boolean(debug && /swiftshader|llvmpipe|software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
    this.container.dataset.renderer = this.softwareRenderer ? 'software' : 'hardware';
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false; this.renderer.shadowMap.needsUpdate = true;
    this.renderer.domElement.className = 'study-canvas'; this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.append(this.renderer.domElement);
    this.events = new AbortController(); this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.walkMap = new WalkMap(); this.position = { ...getSceneRoute('home').position };
    Object.assign(this, viewToward(this.position, getSceneRoute('home').target));
    this.clickables = []; this.hotspotElements = []; this.keys = new Set(); this.stick = { x: 0, y: 0 };
    this.velocity = { x: 0, z: 0 }; this.stepPhase = 0; this.bob = 0; this.fanOn = true; this.ceilingOn = true;
    this.currentKey = 'home'; this.lampOn = true; this.notebookOpen = false; this.inspecting = false;
    this.panelOpen = false; this.exploring = false; this.paused = false; this.frame = 0; this.framingPitch = 0;
    this.renderFrame = this.renderFrame.bind(this);
    try { this.room = createOffice(this); } catch (error) { this.destroy(); throw error; }
    this.sculptureHome = { parent: this.sculpture.parent, position: this.sculpture.position.clone(), quaternion: this.sculpture.quaternion.clone() };
    this.highlight = new THREE.Box3Helper(new THREE.Box3(), '#c18c54'); this.highlight.visible = false; this.scene.add(this.highlight);
    this.bindEvents(); this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container);
    this.resize(); this.syncState();
  }
  registerClickable(object, action) { object.userData.action = action; this.clickables.push(object); }
  setHotspotElements(elements) { this.hotspotView = null; this.hotspotElements = [...elements].map(element => ({ element, key: element.dataset.hotspot })).filter(({ key }) => hotspotPoints[key]); this.invalidate(); }
  setReducedMotion(value) {
    this.reducedMotion = value;
    if (value) { this.skipTransition(); this.notebookHinge.rotation.z = this.notebookOpen ? Math.PI * 0.84 : 0; }
    this.syncState(); this.invalidate(true);
  }
  setPanelOpen(value) { this.panelOpen = value; this.clearInputs(); this.setHighlight(null); this.syncState(); this.invalidate(); }
  transitionTo(key, { immediate = false } = {}) {
    this.exitInspection(); this.currentKey = key; this.exploring = key !== 'home';
    this.setHighlight(null); this.travelTo(key, { immediate });
  }
  enterOffice() { this.exploring = true; this.travelTo('entry'); this.container.focus({ preventScroll: true }); }
  travelTo(key, { immediate = false, onArrival = null } = {}) {
    this.clearInputs(); this.cancelTravel();
    const destination = getSceneRoute(key), goal = destination.position;
    const path = this.walkMap.path(this.position, goal);
    if (!path) { this.onNotice('That walking path is unavailable. The section is still available to read.'); return false; }
    this.exploring = true;
    this.travel = { key, path, destination, onArrival };
    this.onTransitionState(true);
    if (immediate || this.reducedMotion) this.skipTransition();
    else { this.syncState(); this.invalidate(); }
    return true;
  }
  cancelTravel() { this.travel = null; this.turnTarget = null; this.onTransitionState(false); this.syncState(); }
  finishTravel() {
    const travel = this.travel;
    if (!travel) return;
    this.travel = null; this.onTransitionState(false);
    this.exploring = travel.key !== 'home';
    const view = viewToward(this.position, travel.destination.target);
    if (this.reducedMotion) Object.assign(this, view); else this.turnTarget = view;
    this.syncState(); travel.onArrival?.(); this.invalidate();
  }
  skipTransition() {
    if (!this.travel) return;
    this.position = { ...this.travel.destination.position };
    Object.assign(this, viewToward(this.position, this.travel.destination.target));
    this.finishTravel(); this.turnTarget = null; this.invalidate();
  }
  clearInputs() {
    this.keys.clear(); this.velocity = { x: 0, z: 0 }; this.stick = { x: 0, y: 0 }; this.drag = null;
    const knob = document.querySelector('[data-walk-stick] span'); if (knob) knob.style.transform = '';
    this.lastTime = null;
  }
  look(dx, dy) {
    if (this.panelOpen || this.paused) return;
    if (this.inspecting) this.sculpture.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(dy, dx, 0, 'YXZ')));
    else { this.turnTarget = null; this.yaw += dx; this.pitch = clamp(this.pitch + dy, -Math.PI * 0.42, Math.PI * 0.42); }
    this.invalidate();
  }
  toggleLamp() { this.lampOn = !this.lampOn; this.lampLight.intensity = this.lampOn ? 7 : 0; this.lampMaterial.emissiveIntensity = this.lampOn ? 2.2 : 0; this.syncState(); this.invalidate(); }
  toggleNotebook() { this.notebookOpen = !this.notebookOpen; this.syncState(); this.invalidate(); }
  objectAction(type) {
    if (this.inspecting) this.exitInspection();
    const key = ['fan', 'ceiling'].includes(type) ? 'switches' : type === 'inspect' ? 'projects' : 'about';
    const execute = () => {
      if (type === 'lamp') this.toggleLamp();
      else if (type === 'notebook') this.toggleNotebook();
      else if (type === 'contact') this.onContact();
      else if (type === 'fan' || type === 'ceiling') {
        if (type === 'fan') this.fanOn = !this.fanOn;
        else { this.ceilingOn = !this.ceilingOn; this.ceilingLight.intensity = this.ceilingOn ? 16 : 0; this.ceilingMaterial.emissiveIntensity = this.ceilingOn ? 1.3 : 0; }
        this.wallSwitches[type].rotation.x = (type === 'fan' ? this.fanOn : this.ceilingOn) ? -.12 : .12;
        this.syncState(); this.invalidate();
      } else this.inspect();
    };
    if (distance(this.position, getSceneRoute(key).position) > 0.7) this.travelTo(key, { onArrival: execute });
    else execute();
  }
  inspect() {
    this.cancelTravel(); this.clearInputs(); this.inspecting = true; this.exploring = true;
    this.camera.add(this.sculpture); this.sculpture.position.set(0, -0.08, -0.62); this.sculpture.quaternion.identity();
    this.sculpture.castShadow = false; this.sculpture.renderOrder = 3;
    this.setHighlight(null); this.syncState(); this.invalidate(true);
  }
  exitInspection() {
    if (!this.inspecting) return;
    this.inspecting = false;
    this.sculptureHome.parent.add(this.sculpture); this.sculpture.position.copy(this.sculptureHome.position); this.sculpture.quaternion.copy(this.sculptureHome.quaternion);
    this.sculpture.castShadow = true; this.sculpture.renderOrder = 0; this.syncState(); this.invalidate(true);
  }
  act(action) {
    if (action.type === 'navigate') {
      if (action.href === '/about/' && !this.notebookOpen) this.toggleNotebook();
      this.onHotspot(action.href);
    } else this.objectAction(action.type);
  }
  syncState() {
    const state = { fanOn: this.fanOn, ceilingOn: this.ceilingOn, lampOn: this.lampOn, notebookOpen: this.notebookOpen, inspecting: this.inspecting, reducedMotion: this.reducedMotion, walking: Boolean(this.travel), exploring: this.exploring, panelOpen: this.panelOpen, zone: this.position.z > 2.5 ? 'hallway' : 'office' };
    this.container.dataset.lamp = this.lampOn ? 'on' : 'off'; this.container.dataset.notebook = this.notebookOpen ? 'open' : 'closed';
    this.container.dataset.inspection = this.inspecting ? 'sculpture' : 'none'; this.container.dataset.walking = String(state.walking);
    this.container.dataset.fan = this.fanOn ? 'on' : 'off'; this.container.dataset.ceilingLight = this.ceilingOn ? 'on' : 'off';
    this.onState(state);
  }
  bindEvents() {
    const canvas = this.renderer.domElement, signal = this.events.signal;
    canvas.addEventListener('pointerdown', event => {
      // A second finger may look while the first operates the thumbstick.
      if (event.button !== 0 || this.drag || this.panelOpen) return;
      this.container.focus({ preventScroll: true });
      this.drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      const drag = this.drag;
      if (drag && drag.id === event.pointerId) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
        if (drag.moved) this.look(-(event.clientX - drag.x) * 0.004, -(event.clientY - drag.y) * 0.004);
        drag.x = event.clientX; drag.y = event.clientY;
      } else this.setHighlight(this.inspecting || this.panelOpen ? null : this.pick(event));
    }, { signal });
    canvas.addEventListener('pointerup', event => {
      const drag = this.drag; if (!drag || drag.id !== event.pointerId) return;
      this.drag = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!drag.moved && !this.inspecting) { const target = this.pick(event); if (target) this.act(target.userData.action); }
    }, { signal });
    for (const name of ['pointercancel', 'lostpointercapture', 'pointerleave']) canvas.addEventListener(name, () => { this.drag = null; this.setHighlight(null); }, { signal });
    this.container.addEventListener('keydown', event => {
      if (event.target !== this.container || this.panelOpen || this.paused) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key) && !this.inspecting) {
        event.preventDefault(); this.cancelTravel(); this.keys.add(key); this.exploring = true; this.syncState(); this.invalidate();
      }
      const look = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] };
      if (look[event.key]) { event.preventDefault(); this.look(...look[event.key]); }
      if (key === 'e' && this.highlighted) { event.preventDefault(); this.act(this.highlighted.userData.action); }
    }, { signal });
    document.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()), { signal });
    this.container.addEventListener('blur', () => this.clearInputs(), { signal });
    const stick = document.querySelector('[data-walk-stick]');
    if (stick) {
      let pointerId = null;
      const update = event => {
        if (pointerId !== event.pointerId) return;
        const bounds = stick.getBoundingClientRect(), dx = event.clientX - bounds.left - bounds.width / 2, dy = event.clientY - bounds.top - bounds.height / 2;
        const length = Math.max(30, Math.hypot(dx, dy));
        this.stick = { x: dx / length, y: dy / length };
        stick.querySelector('span').style.transform = `translate(${this.stick.x * 25}px, ${this.stick.y * 25}px)`;
        this.invalidate();
      };
      stick.addEventListener('pointerdown', event => {
        if (this.panelOpen || this.inspecting) return;
        event.preventDefault(); this.container.focus({ preventScroll: true }); this.cancelTravel(); this.exploring = true;
        pointerId = event.pointerId; stick.setPointerCapture(pointerId); update(event); this.syncState();
      }, { signal });
      stick.addEventListener('pointermove', update, { signal });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(name, () => { pointerId = null; this.stick = { x: 0, y: 0 }; stick.querySelector('span').style.transform = ''; }, { signal });
    }
    document.addEventListener('focusin', event => {
      const link = event.target.closest('[data-hotspot]');
      this.setHighlight(link ? this.clickables.find(object => object.userData.action.href === link.getAttribute('href')) : null);
    }, { signal });
    window.addEventListener('blur', () => { this.paused = true; this.clearInputs(); this.stopFrame(); }, { signal });
    window.addEventListener('focus', () => { this.paused = false; this.invalidate(); }, { signal });
    document.addEventListener('visibilitychange', () => {
      this.clearInputs(); if (document.hidden) this.stopFrame(); else { this.paused = false; this.invalidate(); }
    }, { signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.contextLost = true; this.clearInputs(); this.stopFrame(); this.onFailure(); }, { signal });
    canvas.addEventListener('webglcontextrestored', () => this.onFailure(true), { signal });
  }
  pick(event) {
    const bounds = this.container.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const hit of this.raycaster.intersectObject(this.room, true)) {
      if (hit.object.material?.opacity < 0.2) continue;
      let object = hit.object;
      while (object && object !== this.room) { if (object.userData.action) return object; object = object.parent; }
      return null;
    }
    return null;
  }
  setHighlight(object) {
    if (this.highlighted === object) return;
    this.highlighted = object; if (this.highlight) this.highlight.visible = Boolean(object);
    const hint = document.querySelector('[data-object-hint]');
    if (hint) hint.textContent = object?.userData.action.label ?? (this.inspecting ? 'Drag to turn · Escape to return' : window.innerWidth <= 700 ? 'Joystick to walk · drag to look' : 'WASD to walk · drag to look');
    this.renderer.domElement.style.cursor = object ? 'pointer' : 'grab'; this.invalidate();
  }
  resize() {
    if (this.destroyed) return;
    this.camera.aspect = Math.max(1, this.container.clientWidth) / Math.max(1, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.softwareRenderer ? .65 : this.mobile ? 1.25 : 1.5));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight, false); this.camera.updateProjectionMatrix(); this.invalidate();
  }
  updateHotspots() {
    const bounds = this.container.getBoundingClientRect(), occupied = [];
    this.hotspotElements.forEach(({ element, key }) => {
      const world = new THREE.Vector3(...hotspotPoints[key]), point = world.clone().project(this.camera);
      const x = (point.x * 0.5 + 0.5) * bounds.width, y = (-point.y * 0.5 + 0.5) * bounds.height;
      let visible = !this.panelOpen && !this.inspecting && (key === 'home' || this.position.z < 2.5) && point.z > -1 && point.z < 1 && x > 55 && x < bounds.width - 55 && y > 55 && y < bounds.height - 130 && !occupied.some(p => Math.abs(p.x - x) < 112 && Math.abs(p.y - y) < 36);
      if (visible) {
        const length = world.distanceTo(this.camera.position);
        this.raycaster.set(this.camera.position, world.sub(this.camera.position).normalize());
        const occluder = this.raycaster.intersectObject(this.room, true).find(hit => hit.object.material?.opacity >= 0.2);
        if (occluder && occluder.distance < length - 0.14) {
          let object = occluder.object;
          while (object && !object.userData.action) object = object.parent;
          visible = object?.userData.action.href === (key === 'home' ? '/' : `/${key}/`) || object?.userData.action.type === key;
        }
      }
      element.hidden = !visible;
      if (visible) { occupied.push({ x, y }); element.style.setProperty('--hotspot-x', `${x + bounds.left}px`); element.style.setProperty('--hotspot-y', `${y + bounds.top}px`); }
    });
  }
  invalidate(shadows = false) {
    if (shadows) this.hotspotView = null;
    if (shadows && this.renderer) this.renderer.shadowMap.needsUpdate = true;
    if (this.destroyed || this.contextLost || this.paused || document.hidden || this.frame) return;
    this.frame = requestAnimationFrame(this.renderFrame);
  }
  stopFrame() { cancelAnimationFrame(this.frame); this.frame = 0; this.lastTime = null; }
  renderFrame(time) {
    this.frame = 0; if (this.destroyed || this.contextLost || this.paused) return;
    const elapsed = (time - (this.lastTime ?? time - 16)) / 1000;
    // Thirty fan-only frames per second suffice; input and camera travel remain responsive.
    const active = this.keys.size || this.travel || this.turnTarget || this.drag || Math.hypot(this.stick.x,this.stick.y) || Math.hypot(this.velocity.x,this.velocity.z) > .002;
    if (!active && this.lastTime && elapsed < (this.softwareRenderer ? 1/12 : 1/30) && !this.renderer.shadowMap.needsUpdate) { this.invalidate(); return; }
    const dt = Math.min(elapsed, 0.1); this.lastTime = time;
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 12);
    const forward = (Number(this.keys.has('w')) - Number(this.keys.has('s'))) - this.stick.y;
    const strafe = (Number(this.keys.has('d')) - Number(this.keys.has('a'))) + this.stick.x;
    const oldPosition = { ...this.position };
    const manual = !this.panelOpen && !this.inspecting && (forward || strafe);
    const divisor = Math.max(1, Math.hypot(forward, strafe));
    const targetX = manual ? (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / divisor * WALK_SPEED : 0;
    const targetZ = manual ? (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / divisor * WALK_SPEED : 0;
    const velocityBlend = 1 - Math.exp(-dt * (manual ? 9 : 15));
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetX, velocityBlend);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetZ, velocityBlend);
    const coasting = !this.panelOpen && !this.inspecting && Math.hypot(this.velocity.x,this.velocity.z) > .002;
    if (manual || coasting) {
      this.position = this.walkMap.slide(this.position, this.velocity.x * dt, this.velocity.z * dt);
    } else if (this.travel) {
      const point = this.travel.path[0], gap = distance(this.position, point), step = WALK_SPEED * Math.min(elapsed, 0.5);
      if (gap <= step) { this.position = { ...point }; this.travel.path.shift(); if (!this.travel.path.length) this.finishTravel(); }
      else {
        const heading = Math.atan2(-(point.x - this.position.x), -(point.z - this.position.z));
        this.yaw = THREE.MathUtils.lerp(this.yaw, nearAngle(heading, this.yaw), blend);
        this.pitch = THREE.MathUtils.lerp(this.pitch, 0, blend);
        this.position = this.walkMap.slide(this.position, (point.x - this.position.x) / gap * step, (point.z - this.position.z) / gap * step);
      }
    }
    let turning = false;
    if (this.turnTarget && !this.travel) {
      const yaw = nearAngle(this.turnTarget.yaw, this.yaw);
      this.yaw = THREE.MathUtils.lerp(this.yaw, yaw, blend); this.pitch = THREE.MathUtils.lerp(this.pitch, this.turnTarget.pitch, blend);
      turning = Math.abs(yaw - this.yaw) + Math.abs(this.pitch - this.turnTarget.pitch) > 0.001;
      if (!turning) this.turnTarget = null;
    }
    // Keep the selected object above the mobile reading sheet without moving the viewer.
    const framingTarget = this.panelOpen && window.innerWidth <= 700 ? -0.32 : 0;
    this.framingPitch = THREE.MathUtils.lerp(this.framingPitch, framingTarget, blend);
    const viewPitch = clamp(this.pitch + this.framingPitch, -Math.PI * 0.42, Math.PI * 0.42);
    const moved = distance(oldPosition, this.position);
    if (moved > .00001) this.stepPhase += moved * Math.PI * 2 / .78;
    const bobTarget = !this.reducedMotion && !this.panelOpen && !this.inspecting && moved > .00001 ? Math.sin(this.stepPhase) * .012 : 0;
    this.bob = this.reducedMotion ? 0 : THREE.MathUtils.lerp(this.bob, bobTarget, blend);
    if (Math.abs(this.bob) < .00001) this.bob = 0;
    this.camera.position.set(this.position.x, EYE_HEIGHT + this.bob, this.position.z); this.camera.rotation.set(viewPitch, this.yaw, 0, 'YXZ'); this.camera.updateMatrixWorld();
    const fanBounds = new THREE.Sphere(new THREE.Vector3(0,2.82,-.4),.75);
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse));
    const fanAnimating = this.fanOn && !this.reducedMotion && frustum.intersectsSphere(fanBounds);
    if (fanAnimating) this.fanRotor.rotation.y = (this.fanRotor.rotation.y + dt * 2.1) % (Math.PI * 2);
    const bookTarget = this.notebookOpen ? Math.PI * 0.84 : 0, bookWasMoving = Math.abs(this.notebookHinge.rotation.z - bookTarget) > 0.002;
    this.notebookHinge.rotation.z = THREE.MathUtils.lerp(this.notebookHinge.rotation.z, bookTarget, blend);
    const bookMoving = Math.abs(this.notebookHinge.rotation.z - bookTarget) > 0.002;
    if (bookWasMoving && !bookMoving) this.renderer.shadowMap.needsUpdate = true;
    this.scene.updateMatrixWorld(true); if (this.highlighted) this.highlight.box.setFromObject(this.highlighted).expandByScalar(0.012);
    for (const [selector,key] of [['[data-office-lamp]','about'],['[data-office-notebook]','about'],['[data-office-inspect]','projects']]) {
      const el=document.querySelector(selector); if(el) el.hidden=this.inspecting || distance(this.position,getSceneRoute(key).position) > 1;
    }
    const hotspotView = [this.position.x,this.position.z,this.yaw,viewPitch,this.bob,this.panelOpen,this.inspecting,this.camera.aspect].join(',');
    if (this.hotspotView !== hotspotView) { this.updateHotspots(); this.hotspotView = hotspotView; }
    const renderStart=performance.now(); this.renderer.render(this.scene, this.camera);
    this.container.dataset.renderMs=(performance.now()-renderStart).toFixed(2);
    this.container.dataset.renderIntervalMs=(elapsed*1000).toFixed(2);
    this.container.dataset.drawCalls=String(this.renderer.info.render.calls);
    Object.assign(this.container.dataset, { playerX: this.position.x.toFixed(3), playerZ: this.position.z.toFixed(3), eyeHeight: String(EYE_HEIGHT), cameraHeight: this.camera.position.y.toFixed(5), speed: Math.hypot(this.velocity.x,this.velocity.z).toFixed(4), fanAngle: this.fanRotor.rotation.y.toFixed(4), viewAngle: this.yaw.toFixed(3), viewPitch: viewPitch.toFixed(3), zone: this.position.z > 2.5 ? 'hallway' : 'office' });
    if (fanAnimating || coasting || Math.abs(this.bob) > .00001 || manual || this.travel || turning || bookMoving || Math.abs(this.framingPitch - framingTarget) > 0.001) this.invalidate(); else this.lastTime = null;
  }
  destroy() {
    this.destroyed = true; this.clearInputs(); this.stopFrame(); this.events?.abort(); this.resizeObserver?.disconnect();
    this.scene.traverse(object => object.shadow?.dispose()); disposeObject(this.scene); this.retiredProxies?.forEach(disposeObject);
    this.environmentTarget?.dispose(); this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}
