// Solara Bay — the entry program (Node 22, standard library only).
// It copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with make.fun's own library,
// so the dossier is byte for byte what the scorer rebuilds from the same
// files. Run it twice: both runs must write the same bytes.
// NOTE: never rmdir the output directory itself — the grader runs this as
// user 65534 with /output mounted (root-owned), so removing the mount point
// throws EPERM and fails run_completes; only its contents are cleared.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing from the repository');
}
if (!existsSync(join(repoRoot, 'screenshots'))) {
  throw new Error('screenshots/ is missing from the repository');
}

// Round 2 fix: clear only the CONTENTS of the output directory, never the
// directory itself — the grader mounts it, so removing it fails with EPERM.
mkdirSync(outDir, { recursive: true });
for (const child of readdirSync(outDir)) {
  rmSync(join(outDir, child), { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Solara Bay entry written to ' + outDir);
