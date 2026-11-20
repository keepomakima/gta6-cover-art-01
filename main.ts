// main.ts — Key Art Studio's entry program (Node 22, stdlib only).
// Copies app/ and screenshots/ from this repository to the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-app.ts, the kit's copy, unchanged.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; the
// dossier is capped at 1.5 MiB by the bounty's gate (see buildDossier's
// caps below), so a run that prints a size above the cap has failed.
//
// NOTE: never rmSync the output directory: the grader runs main.ts with
// /output as a bind mount, and removing it fails the run. mkdirSync +
// cpSync is all the program needs (the grader hands it an empty output).
import { buildDossier } from './vendor/makefun-app.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = new URL('.', import.meta.url).pathname;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });

for (const name of ['app', 'screenshots']) {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${name}/ in the repository`);
  cpSync(src, join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`main.ts: wrote ${outDir} — dossier.json ${dossier.length} bytes`);
