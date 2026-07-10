const camera = (position, target, fov = 42) => ({ position, target, fov });

export const sceneRoutes = {
  home: {
    camera: camera([10.4, 6.9, 11.8], [0, 1.55, -1.25]),
    focusHref: '/',
  },
  about: {
    camera: camera([-3.25, 3.35, 1.6], [-4.15, 2.45, -5.05], 37),
    focusHref: '/about/',
  },
  projects: {
    camera: camera([4.4, 2.7, 3.05], [2.75, 1.05, -1.8], 39),
    focusHref: '/projects/',
  },
  'project-detail': {
    camera: camera([3.2, 1.95, 0.75], [2.75, 1.15, -1.85], 34),
    focusHref: '/projects/',
  },
  experience: {
    camera: camera([3.05, 2.95, 3.6], [6.72, 2.4, -1.1], 38),
    focusHref: '/experience/',
  },
  education: {
    camera: camera([1.4, 2.75, 1.2], [3.0, 2.48, -5.6], 38),
    focusHref: '/education/',
  },
  'education-detail': {
    camera: camera([3.05, 2.12, -1.15], [3.05, 2.35, -7.65], 33),
    focusHref: '/education/',
  },
  hobbies: {
    camera: camera([-1.55, 2.55, 6.55], [-1.5, 1.03, 2.2], 38),
    focusHref: '/hobbies/',
  },
};

export const hotspotPoints = {
  home: [-2.3, 1.55, -0.75],
  about: [-4.15, 2.55, -4.72],
  projects: [2.75, 1.25, -1.45],
  experience: [6.45, 2.3, -0.95],
  education: [3.0, 2.2, -5.05],
  hobbies: [-1.5, 1.2, 2.35],
};

export const sceneHref = {
  home: '/',
  about: '/about/',
  projects: '/projects/',
  experience: '/experience/',
  education: '/education/',
  hobbies: '/hobbies/',
};

export function getSceneRoute(key) {
  return sceneRoutes[key] ?? sceneRoutes.home;
}

export function normalisePathname(pathname) {
  const path = pathname.replace(/\/+/g, '/');
  if (path === '/' || path === '') return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function isProjectPath(pathname) {
  return /^\/projects\/[^/]+\/$/.test(normalisePathname(pathname));
}

export function isSchoolPath(pathname) {
  return /^\/education\/[^/]+\/$/.test(normalisePathname(pathname));
}

export function sceneKeyFromDocument(documentNode = document) {
  return documentNode.body?.dataset.scene ?? 'home';
}
