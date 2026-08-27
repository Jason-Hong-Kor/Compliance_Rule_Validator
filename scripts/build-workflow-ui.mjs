import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'static', 'workflow-postfunction', 'src');
const outDir = join(root, 'static', 'workflow-postfunction', 'build');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: [join(src, 'index.js')],
  format: 'iife',
  outfile: join(outDir, 'index.js'),
  platform: 'browser',
  target: ['es2020'],
});

copyFileSync(join(src, 'index.html'), join(outDir, 'index.html'));
console.log('workflow post function UI 빌드 완료');
