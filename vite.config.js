import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (path) => resolve(import.meta.dirname, path);

export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      input: {
        home: page('index.html'),
        about: page('about/index.html'),
        projects: page('projects/index.html'),
        projectOne: page('projects/project-01/index.html'),
        projectTwo: page('projects/project-02/index.html'),
        projectThree: page('projects/project-03/index.html'),
        experience: page('experience/index.html'),
        education: page('education/index.html'),
        schoolOne: page('education/school-01/index.html'),
        schoolTwo: page('education/school-02/index.html'),
        schoolThree: page('education/school-03/index.html'),
        hobbies: page('hobbies/index.html'),
      },
    },
  },
});
