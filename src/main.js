import { sceneKeyFromDocument } from './scene-routes.js';

document.body.classList.add('js-enhanced');

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const sceneContainer = document.querySelector('[data-study-scene]');
const statusElement = document.querySelector('[data-scene-status]');
const motionControl = document.querySelector('[data-skip-motion]');
const announcer = document.querySelector('[data-route-announcer]');

let studyScene = null;
let navigationController = null;
let motionPreference = reducedMotionQuery.matches;
try { motionPreference = sessionStorage.getItem('office-motion') === 'off' || reducedMotionQuery.matches; } catch { /* Storage is optional. */ }

function syncOfficeControls(state) {
  document.body.classList.toggle('is-inspecting', state.inspecting);
  document.querySelector('[data-office-lamp]')?.setAttribute('aria-pressed', String(state.lampOn));
  document.querySelector('[data-office-notebook]')?.setAttribute('aria-pressed', String(state.notebookOpen));
  document.querySelector('[data-office-inspect]')?.setAttribute('aria-pressed', String(state.inspecting));
  document.querySelector('[data-office-motion]')?.setAttribute('aria-pressed', String(!state.reducedMotion));
  const done = document.querySelector('[data-office-done]');
  if (done) done.hidden = !state.inspecting;
  const hint = document.querySelector('[data-object-hint]');
  if (hint) hint.textContent = state.inspecting ? 'Drag to turn the sculpture · Escape to return' : 'Drag to look around · select an object to explore';
}

function setSceneStatus(message, state = 'loading') {
  if (!statusElement) return;
  statusElement.dataset.state = state;
  statusElement.textContent = message;
}

function setMotionControlVisible(visible) {
  motionControl?.classList.toggle('is-visible', visible);
}

function refreshSceneBindings() {
  studyScene?.setHotspotElements(document.querySelectorAll('.scene-hotspot'));
}

function setDetails(button) {
  const target = document.getElementById(button.getAttribute('aria-controls'));
  if (!target) return;
  const isOpen = button.getAttribute('aria-expanded') === 'true';
  const list = button.closest('ul');
  list?.querySelectorAll('[data-toggle-detail]').forEach((item) => {
    const detail = document.getElementById(item.getAttribute('aria-controls'));
    item.setAttribute('aria-expanded', 'false');
    detail?.classList.remove('is-open');
  });
  button.setAttribute('aria-expanded', String(!isOpen));
  target.classList.toggle('is-open', !isOpen);
}

function openContactDialog() {
  const dialog = document.getElementById('contact-dialog');
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    dialog.querySelector('[data-contact-close]')?.focus();
  }
}

function closeContactDialog() {
  const dialog = document.getElementById('contact-dialog');
  if (dialog?.open) dialog.close();
}

function isInternalRouteLink(anchor, event) {
  if (!studyScene || studyScene.contextLost || event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!anchor.matches('[data-route]')) return false;
  if (anchor.target || anchor.hasAttribute('download')) return false;
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin && url.pathname !== window.location.pathname;
}

function copyRouteMetadata(nextDocument) {
  const currentMetadata = document.head.querySelectorAll('[data-route-meta]');
  currentMetadata.forEach((element) => element.remove());
  nextDocument.head.querySelectorAll('[data-route-meta]').forEach((element) => {
    document.head.append(element.cloneNode(true));
  });
  document.title = nextDocument.title;
  document.documentElement.lang = nextDocument.documentElement.lang;
}

function replaceRouteElement(id, nextDocument) {
  const current = document.getElementById(id);
  const next = nextDocument.getElementById(id);
  if (current && next) current.replaceWith(next.cloneNode(true));
}

async function navigate(destination, { historyMode = 'push', restoreFocus = true } = {}) {
  const targetUrl = new URL(destination, window.location.href);
  if (historyMode === 'push' && targetUrl.pathname === window.location.pathname) {
    navigationController?.abort();
    document.body.classList.remove('is-navigating');
    studyScene?.resetView();
    setSceneStatus('Office ready', 'ready');
    return;
  }
  if (!studyScene) {
    window.location.assign(targetUrl.href);
    return;
  }

  navigationController?.abort();
  const controller = new AbortController();
  navigationController = controller;
  document.body.classList.add('is-navigating');
  studyScene.skipTransition();
  setSceneStatus('Opening the room…', 'moving');

  try {
    const response = await fetch(targetUrl.href, {
      signal: controller.signal,
      headers: { 'X-Portfolio-Navigation': 'true' },
    });
    if (!response.ok) throw new Error(`Unable to load ${targetUrl.pathname}`);
    const html = await response.text();
    if (controller.signal.aborted || navigationController !== controller) return;
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = nextDocument.getElementById('page-content');
    const nextBody = nextDocument.body;
    if (!nextMain || !nextBody?.dataset.scene) throw new Error('Invalid static route document.');

    closeContactDialog();
    copyRouteMetadata(nextDocument);
    replaceRouteElement('site-header', nextDocument);
    replaceRouteElement('hotspot-layer', nextDocument);
    replaceRouteElement('page-content', nextDocument);
    replaceRouteElement('site-footer', nextDocument);
    replaceRouteElement('contact-dialog', nextDocument);
    document.body.dataset.scene = nextBody.dataset.scene;
    document.body.dataset.route = nextBody.dataset.route ?? '';

    if (historyMode === 'push') {
      window.history.pushState({ route: targetUrl.pathname }, '', targetUrl.href);
    }

    refreshSceneBindings();
    studyScene.transitionTo(sceneKeyFromDocument());
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.querySelector('#page-content h1');
    if (restoreFocus) {
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }
    if (announcer && heading) announcer.textContent = `${heading.textContent.trim()} loaded`;
  } catch (error) {
    if (error.name !== 'AbortError') window.location.assign(targetUrl.href);
    return;
  } finally {
    if (!controller.signal.aborted && navigationController === controller) {
      document.body.classList.remove('is-navigating');
      setSceneStatus('Office ready', 'ready');
    }
  }
}

function bindGlobalInteractions() {
  document.addEventListener('click', (event) => {
    if (studyScene) {
      if (event.target.closest('[data-office-lamp]')) { studyScene.toggleLamp(); return; }
      if (event.target.closest('[data-office-notebook]')) { studyScene.toggleNotebook(); return; }
      if (event.target.closest('[data-office-inspect]')) {
        studyScene.inspect(); sceneContainer.focus({ preventScroll: true }); return;
      }
      if (event.target.closest('[data-office-done]')) {
        studyScene.exitInspection(); document.querySelector('[data-office-inspect]')?.focus({ preventScroll: true }); return;
      }
      if (event.target.closest('[data-office-reset]')) { studyScene.resetView(); return; }
      if (event.target.closest('[data-office-zoom-in]')) { studyScene.zoomBy(0.85); return; }
      if (event.target.closest('[data-office-zoom-out]')) { studyScene.zoomBy(1.18); return; }
      if (event.target.closest('[data-office-motion]')) {
        motionPreference = !motionPreference; studyScene.setReducedMotion(motionPreference);
        try { sessionStorage.setItem('office-motion', motionPreference ? 'off' : 'on'); } catch { /* Optional. */ }
        return;
      }
    }
    const detailsTrigger = event.target.closest('[data-toggle-detail]');
    if (detailsTrigger) {
      setDetails(detailsTrigger);
      return;
    }

    if (event.target.closest('[data-contact-open]')) {
      openContactDialog();
      return;
    }

    if (event.target.closest('[data-contact-close]')) {
      closeContactDialog();
      return;
    }

    const routeLink = event.target.closest('a');
    if (routeLink && isInternalRouteLink(routeLink, event)) {
      event.preventDefault();
      navigate(routeLink.href);
    }

    const dialog = event.target.closest('dialog');
    if (dialog && event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      const outsideDialog =
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom;
      if (outsideDialog) dialog.close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeContactDialog();
      if (studyScene?.inspecting) {
        studyScene.exitInspection(); document.querySelector('[data-office-inspect]')?.focus({ preventScroll: true });
      }
    }
  });

  window.addEventListener('popstate', () => {
    navigate(window.location.href, { historyMode: 'none', restoreFocus: true });
  });

  motionControl?.addEventListener('click', () => studyScene?.skipTransition());
  reducedMotionQuery.addEventListener('change', (event) => {
    motionPreference = event.matches;
    studyScene?.setReducedMotion(motionPreference);
  });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) studyScene?.destroy(); });
}

async function initialiseScene() {
  if (!sceneContainer) return;
  try {
    const { StudyScene } = await import('./scene.js');
    studyScene = new StudyScene(sceneContainer, {
      reducedMotion: motionPreference,
      onHotspot: (href) => navigate(href),
      onTransitionState: (isMoving) => setMotionControlVisible(isMoving),
      onState: syncOfficeControls,
      onFailure: (restored) => {
        if (restored) { studyScene?.destroy(); studyScene = null; initialiseScene(); return; }
        document.body.classList.remove('scene-ready');
        document.body.classList.add('scene-unavailable');
        setMotionControlVisible(false);
        setSceneStatus('Static reading view', 'unavailable');
        document.querySelectorAll('.office-controls button').forEach(button => { button.disabled = true; });
      },
    });
    studyScene.transitionTo(sceneKeyFromDocument(), { immediate: true });
    refreshSceneBindings();
    document.body.classList.add('scene-ready');
    document.body.classList.remove('scene-unavailable');
    document.querySelectorAll('.office-controls button').forEach(button => { button.disabled = false; });
    setSceneStatus('Office ready', 'ready');
  } catch {
    document.body.classList.add('scene-unavailable');
    setSceneStatus('Static reading view', 'unavailable');
  }
}

bindGlobalInteractions();
initialiseScene();
