#!/usr/bin/env node
// Typecheck this app only.
//
// `tsc` also checks every file reached through an import, which drags in the
// whole @openreplay/player source and its pre-existing type debt (~60 errors we
// don't own). Those are reported against ../player/** paths, so drop them and
// fail on anything anchored in mcp_app's own files — which still covers what we
// care about: broken imports into the player API and misuse of its types.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsc', '--noEmit', '--pretty', 'false'],
  { cwd: root, encoding: 'utf-8' },
);

if (tsc.error) {
  console.error(tsc.error.message);
  process.exit(1);
}

const lines = `${tsc.stdout ?? ''}${tsc.stderr ?? ''}`.split('\n');
const own = [];
let keeping = false;

for (const line of lines) {
  const start = /^(\S.*?)\(\d+,\d+\): (error|warning) /.exec(line);
  if (start) {
    // A file path starting a new diagnostic decides whether the whole block
    // (message plus its indented continuation lines) is ours.
    keeping = !start[1].startsWith('..');
  } else if (line.trim() === '') {
    continue;
  }
  if (keeping) own.push(line);
}

const skipped = lines.filter((l) => /^\.\..*\(\d+,\d+\): error /.test(l)).length;
if (skipped > 0) {
  console.error(`typecheck: ignored ${skipped} pre-existing error(s) in ../player`);
}

if (own.length > 0) {
  console.error(own.join('\n'));
  process.exit(1);
}

console.error('typecheck: no errors in mcp_app sources');
