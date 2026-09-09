import { sceneKeyFromDocument } from './scene-routes.js';

document.body.classList.add('js-enhanced');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const sceneContainer = document.querySelector('[data-study-scene]');
const statusElement = document.querySelector('[data-scene-status]');
const motionControl = document.querySelector('[data-skip-motion]');
const announcer = document.querySelector('[data-route-announcer]');
let studyScene = null, navigationController = null, readingOpen = false;
let motionPreference = reducedMotionQuery.matches;
try { motionPreference = sessionStorage.getItem('office-motion') === 'off' || reducedMotionQuery.matches; } catch { /* Storage is optional. */ }

function setSceneStatus(message, state = 'loading') { if (statusElement) { statusElement.dataset.state = state; statusElement.textContent = message; } }
function syncOfficeControls(state) {
  document.body.classList.toggle('is-inspecting', state.inspecting);
  document.body.classList.toggle('has-entered', state.exploring);
  document.querySelector('[data-office-lamp]')?.setAttribute('aria-pressed', String(state.lampOn));
  document.querySelector('[data-office-notebook]')?.setAttribute('aria-pressed', String(state.notebookOpen));
  document.querySelector('[data-office-inspect]')?.setAttribute('aria-pressed', String(state.inspecting));
  document.querySelector('[data-office-motion]')?.setAttribute('aria-pressed', String(!state.reducedMotion));
  const done = document.querySelector('[data-office-done]'); if (done) done.hidden = !state.inspecting;
  const hint = document.querySelector('[data-object-hint]');
  if (hint) hint.textContent = state.inspecting ? 'Drag to turn · Escape to put down' : state.walking ? 'Walking to your destination…' : window.innerWidth <= 700 ? 'Joystick to walk · drag to look' : 'WASD to walk · drag to look';
  if (document.body.dataset.route === 'home' && document.body.classList.contains('scene-ready')) document.getElementById('page-content').hidden = state.exploring;
}
function setReading(open, focus = true) {
  const enter = document.querySelector('[data-office-enter]');
  if (enter && studyScene && !studyScene.contextLost) enter.disabled = false;
  readingOpen = Boolean(open && document.body.dataset.route !== 'home');
  document.body.classList.toggle('panel-open', readingOpen);
  const main = document.getElementById('page-content');
  if (document.body.classList.contains('scene-ready')) main.hidden = document.body.dataset.route === 'home' ? Boolean(studyScene?.exploring) : !readingOpen;
  const read = document.querySelector('[data-office-read]'); if (read) read.hidden = document.body.dataset.route === 'home' || readingOpen;
  studyScene?.setPanelOpen(readingOpen);
  if (focus && studyScene) {
    if (readingOpen) { const heading = main.querySelector('h1'); heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true }); }
    else sceneContainer.focus({ preventScroll: true });
  }
}
function setDetails(button) {
  const target = document.getElementById(button.getAttribute('aria-controls')); if (!target) return;
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  button.closest('ul')?.querySelectorAll('[data-toggle-detail]').forEach(item => {
    item.setAttribute('aria-expanded', 'false'); document.getElementById(item.getAttribute('aria-controls'))?.classList.remove('is-open');
  });
  button.setAttribute('aria-expanded', String(!wasOpen)); target.classList.toggle('is-open', !wasOpen);
}
function openContactDialog() {
  studyScene?.setPanelOpen(true);
  const dialog = document.getElementById('contact-dialog'); dialog?.showModal(); dialog?.querySelector('[data-contact-close]')?.focus();
}
function closeContactDialog() { document.getElementById('contact-dialog')?.close(); studyScene?.setPanelOpen(readingOpen); }
function isInternalRouteLink(anchor, event) {
  if (!studyScene || studyScene.contextLost || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return anchor.matches('[data-route]') && !anchor.target && !anchor.hasAttribute('download') && new URL(anchor.href, location.href).origin === location.origin;
}
function copyRouteMetadata(nextDocument) {
  document.head.querySelectorAll('[data-route-meta]').forEach(element => element.remove());
  nextDocument.head.querySelectorAll('[data-route-meta]').forEach(element => document.head.append(element.cloneNode(true)));
  document.title = nextDocument.title; document.documentElement.lang = nextDocument.documentElement.lang;
}
function replaceRouteElement(id, nextDocument) {
  const current = document.getElementById(id), next = nextDocument.getElementById(id);
  if (current && next) current.replaceWith(next.cloneNode(true));
}
async function navigate(destination, { historyMode = 'push' } = {}) {
  const targetUrl = new URL(destination, location.href);
  if (!studyScene || studyScene.contextLost) { location.assign(targetUrl.href); return; }
  navigationController?.abort(); studyScene.cancelTravel();
  document.body.classList.remove('is-navigating');
  if (historyMode === 'push' && targetUrl.pathname === location.pathname) {
    studyScene.transitionTo(sceneKeyFromDocument()); setReading(document.body.dataset.route !== 'home'); return;
  }
  const controller = new AbortController(); navigationController = controller;
  document.body.classList.add('is-navigating'); setSceneStatus('Opening section…');
  try {
    const response = await fetch(targetUrl.href, { signal: controller.signal, headers: { 'X-Portfolio-Navigation': 'true' } });
    if (!response.ok) throw new Error(`Unable to load ${targetUrl.pathname}`);
    const html = await response.text(); if (controller.signal.aborted || navigationController !== controller) return;
    const next = new DOMParser().parseFromString(html, 'text/html');
    if (!next.getElementById('page-content') || !next.body.dataset.scene) throw new Error('Invalid portfolio page.');
    closeContactDialog(); copyRouteMetadata(next);
    for (const id of ['site-header', 'hotspot-layer', 'page-content', 'site-footer', 'contact-dialog']) replaceRouteElement(id, next);
    document.body.dataset.route = next.body.dataset.route ?? ''; document.body.dataset.scene = next.body.dataset.scene;
    if (historyMode === 'push') history.pushState({ route: targetUrl.pathname }, '', targetUrl.href);
    studyScene.setHotspotElements(document.querySelectorAll('.scene-hotspot'));
    studyScene.transitionTo(sceneKeyFromDocument()); setReading(document.body.dataset.route !== 'home');
    if (announcer) announcer.textContent = `${document.querySelector('main h1')?.textContent.trim()} loaded`;
  } catch (error) { if (error.name !== 'AbortError') location.assign(targetUrl.href); }
  finally { if (!controller.signal.aborted && navigationController === controller) { document.body.classList.remove('is-navigating'); setSceneStatus('Office ready', 'ready'); } }
}
function showFallback() {
  document.body.classList.remove('scene-ready', 'panel-open', 'has-entered', 'is-inspecting');
  document.body.classList.add('scene-unavailable'); document.getElementById('page-content').hidden = false;
  sceneContainer.querySelector('canvas')?.setAttribute('hidden', '');
  motionControl?.classList.remove('is-visible'); setSceneStatus('Static reading view', 'unavailable');
  document.querySelectorAll('.office-controls button, [data-office-enter]').forEach(button => { button.disabled = true; });
}
document.addEventListener('click', event => {
  const target = event.target;
  if (studyScene && !studyScene.contextLost) {
    if (target.closest('[data-office-enter]')) { setReading(false); studyScene.enterOffice(); return; }
    if (target.closest('[data-panel-close], [data-office-walk]')) { setReading(false); return; }
    if (target.closest('[data-office-read]')) { setReading(true); return; }
    const action = target.closest('[data-office-lamp], [data-office-notebook], [data-office-inspect]');
    if (action) { setReading(false); studyScene.objectAction(action.hasAttribute('data-office-lamp') ? 'lamp' : action.hasAttribute('data-office-notebook') ? 'notebook' : 'inspect'); return; }
    if (target.closest('[data-office-done]')) { studyScene.exitInspection(); sceneContainer.focus({ preventScroll: true }); return; }
    if (target.closest('[data-office-motion]')) {
      motionPreference = !motionPreference; studyScene.setReducedMotion(motionPreference);
      try { sessionStorage.setItem('office-motion', motionPreference ? 'off' : 'on'); } catch { /* Optional. */ }
      return;
    }
  }
  const details = target.closest('[data-toggle-detail]'); if (details) { setDetails(details); return; }
  if (target.closest('[data-contact-open]')) { openContactDialog(); return; }
  if (target.closest('[data-contact-close]')) { closeContactDialog(); return; }
  const link = target.closest('a'); if (link && isInternalRouteLink(link, event)) { event.preventDefault(); navigate(link.href); }
  const dialog = target.closest('dialog');
  if (dialog && target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) closeContactDialog(); }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (document.getElementById('contact-dialog')?.open) closeContactDialog();
  else if (studyScene?.inspecting) studyScene.exitInspection();
  else if (readingOpen) setReading(false);
});
window.addEventListener('popstate', () => navigate(location.href, { historyMode: 'none' }));
motionControl?.addEventListener('click', () => studyScene?.skipTransition());
reducedMotionQuery.addEventListener('change', event => { motionPreference = event.matches; studyScene?.setReducedMotion(motionPreference); });
window.addEventListener('pagehide', event => { if (!event.persisted) studyScene?.destroy(); });
async function initialiseScene() {
  if (!sceneContainer) return;
  try {
    const { StudyScene } = await import('./scene.js');
    studyScene = new StudyScene(sceneContainer, {
      reducedMotion: motionPreference, onHotspot: href => navigate(href), onState: syncOfficeControls,
      onTransitionState: moving => motionControl?.classList.toggle('is-visible', moving),
      onNotice: message => { if (announcer) announcer.textContent = message; },
      onFailure: restored => { if (restored) { studyScene?.destroy(); studyScene = null; initialiseScene(); } else showFallback(); },
    });
    studyScene.transitionTo(sceneKeyFromDocument(), { immediate: true }); studyScene.setHotspotElements(document.querySelectorAll('.scene-hotspot'));
    document.body.classList.add('scene-ready'); document.body.classList.remove('scene-unavailable');
    document.querySelectorAll('.office-controls button, [data-office-enter]').forEach(button => { button.disabled = false; });
    setReading(document.body.dataset.route !== 'home', false); setSceneStatus('Office ready', 'ready');
  } catch { showFallback(); }
}
initialiseScene();
