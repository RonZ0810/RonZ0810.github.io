// Reproducible, CC0 assets. Run from the project root with Node 22+.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = 'public/office';
const rawRoot = '.cache/office';
const manifest = { license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license', assets: [] };
async function json(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'RonaldPortfolio/1.0' } });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
async function download(file, relative, outputRoot = root) {
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`${response.status}: ${file.url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (file.md5 && createHash('md5').update(bytes).digest('hex') !== file.md5) throw new Error(`Checksum: ${relative}`);
  const destination = path.join(outputRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  return { path: relative, source: file.url, bytes: bytes.length, md5: file.md5 };
}
for (const id of ['modern_arm_chair_01', 'Camera_01', 'potted_plant_01']) {
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  const model = files.gltf['1k'].gltf;
  const entries = await Promise.all([
    download(model, `${id}/model.gltf`, rawRoot),
    ...Object.entries(model.include).map(([name, file]) => download(file, `${id}/${name}`, rawRoot)),
  ]);
  manifest.assets.push({ id, source: `https://polyhaven.com/a/${id}`, resolution: '1K', runtimeFile: `${id}.glb`, processing: 'glTF Transform 4.4.0, meshopt, simplify error 0.001; original JPEG textures retained', sourceFiles: entries });
  console.log(`Downloaded ${id}`);
}
const floor = await json('https://api.polyhaven.com/files/wood_floor');
const entries = [];
for (const resolution of ['1k', '2k']) {
  for (const [type, name] of [['Diffuse', 'color'], ['nor_gl', 'normal'], ['Rough', 'roughness']]) {
    if (resolution === '2k' && name !== 'color') continue;
    entries.push(await download(floor[type][resolution].jpg, `wood/${name}-${resolution}.jpg`));
  }
}
manifest.assets.push({ id: 'wood_floor', source: 'https://polyhaven.com/a/wood_floor', files: entries });
await writeFile(`${root}/sources.json`, JSON.stringify(manifest, null, 2) + '\n');
console.log('Office assets and source manifest complete.');
