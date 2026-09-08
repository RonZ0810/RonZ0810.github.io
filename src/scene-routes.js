const camera = (position, target, fov = 38) => ({ position, target, fov });
export const sceneRoutes = {
  home: { camera: camera([8.8, 7.1, 10.2], [0, 0.9, 0]), focusHref: '/' },
  about: { camera: camera([2.4, 3.8, 4.2], [-0.95, 0.85, 0.05], 35), focusHref: '/about/' },
  projects: { camera: camera([3.3, 2.9, 4.2], [0, 1.25, -0.6], 35), focusHref: '/projects/' },
  'project-detail': { camera: camera([2, 2.3, 3.1], [0, 1.25, -0.6], 32), focusHref: '/projects/' },
  experience: { camera: camera([4.4, 3, 3.4], [1.5, 1.65, -2.25], 35), focusHref: '/experience/' },
  education: { camera: camera([1.5, 3.4, 3.8], [-2.2, 1.35, -1.8], 36), focusHref: '/education/' },
  'education-detail': { camera: camera([0, 2.7, 2.7], [-2.2, 1.4, -1.8], 33), focusHref: '/education/' },
  hobbies: { camera: camera([5.2, 3.2, 4.2], [2.35, 0.95, 0.35], 36), focusHref: '/hobbies/' },
};
export const hotspotPoints = {
  about: [-0.94, 0.91, 0.08], projects: [0.08, 1.51, -0.65], experience: [1.5, 1.88, -2.27],
  education: [-2.18, 1.68, -1.84], hobbies: [2.38, 1.03, 0.38],
};
export const sceneHref = { home: '/', about: '/about/', projects: '/projects/', experience: '/experience/', education: '/education/', hobbies: '/hobbies/' };
export function getSceneRoute(key) { return sceneRoutes[key] ?? sceneRoutes.home; }
export function normalisePathname(pathname) {
  const path = pathname.replace(/\/+/g, '/');
  return path === '/' || path === '' ? '/' : path.endsWith('/') ? path : `${path}/`;
}
export function isProjectPath(pathname) { return /^\/projects\/[^/]+\/$/.test(normalisePathname(pathname)); }
export function isSchoolPath(pathname) { return /^\/education\/[^/]+\/$/.test(normalisePathname(pathname)); }
export function sceneKeyFromDocument(documentNode = document) { return documentNode.body?.dataset.scene ?? 'home'; }
