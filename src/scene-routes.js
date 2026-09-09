import { EYE_HEIGHT } from './walking.js';
const destination = (x, z, target, focusHref, id) => ({ position: { x, z }, target, focusHref, id });
export const sceneRoutes = {
  home: destination(1.4, 3.7, [1.4, EYE_HEIGHT, -1], '/', 'entrance'),
  entry: destination(1.4, 1.8, [0.05, 1.35, -0.66], '/', 'landing'),
  switches: destination(2.36, 1.77, [2.36, 1.3, 2.29], '/', 'switches'),
  about: destination(-1.5, 1.25, [-0.94, 0.87, 0.05], '/about/', 'notebook'),
  projects: destination(0.65, 0.85, [0.08, 1.31, -0.66], '/projects/', 'monitor'),
  'project-detail': destination(0.65, 0.70, [0.08, 1.31, -0.66], '/projects/', 'monitor'),
  experience: destination(1.55, -1.1, [1.55, 1.88, -2.30], '/experience/', 'timeline'),
  education: destination(-2.25, -0.72, [-2.18, 1.65, -1.84], '/education/', 'books'),
  'education-detail': destination(-2.25, -1.03, [-2.18, 1.65, -1.84], '/education/', 'books'),
  hobbies: destination(2.62, 1.18, [2.63, 1.03, 0.36], '/hobbies/', 'camera'),
};
export const hotspotPoints = { home: [2.075, 1.65, 2.8], contact: [-.48,.83,.095], fan: [2.324,1.30,2.285], ceiling: [2.396,1.30,2.285], about: [-0.94, 0.91, 0.08], projects: [0.08, 1.51, -0.65], experience: [1.55, 1.88, -2.27], education: [-2.18, 1.68, -1.84], hobbies: [2.63, 1.03, 0.38] };
export const sceneHref = { home: '/', about: '/about/', projects: '/projects/', experience: '/experience/', education: '/education/', hobbies: '/hobbies/' };
export function getSceneRoute(key) { return sceneRoutes[key] ?? sceneRoutes.home; }
export function normalisePathname(pathname) { const path = pathname.replace(/\/+/g, '/'); return path === '/' || path === '' ? '/' : path.endsWith('/') ? path : `${path}/`; }
export function isProjectPath(pathname) { return /^\/projects\/[^/]+\/$/.test(normalisePathname(pathname)); }
export function isSchoolPath(pathname) { return /^\/education\/[^/]+\/$/.test(normalisePathname(pathname)); }
export function sceneKeyFromDocument(documentNode = document) { return documentNode.body?.dataset.scene ?? 'home'; }
