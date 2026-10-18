#!/usr/bin/env node
// Publish dist/ to here.now (https://here.now/docs).
//
// Flow: create (POST) or update (PUT) a Site version with a file manifest ->
// PUT each file to its presigned upload target -> finalize. Files whose
// sha256 already exists on here.now come back as "skipped" and aren't re-sent.
//
// The Site's slug is recorded in herenow.json (committed, not secret) so every
// publish updates the same URL. The API key comes from HERENOW_API_KEY in the
// environment or .env (gitignored) and is never printed.
//
// Usage: npm run publish:site   (builds first)

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const STATE_FILE = join(ROOT, 'herenow.json');
const API = 'https://here.now/api/v1';
const CLIENT = 'groove-o-matic/publish-script';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

const fail = (msg) => {
  console.error(`publish: ${msg}`);
  process.exit(1);
};

const apiKey = () => {
  if (process.env.HERENOW_API_KEY) return process.env.HERENOW_API_KEY.trim();
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = /^\s*HERENOW_API_KEY\s*=\s*(.*)\s*$/.exec(line);
      if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
    }
  }
  return fail('HERENOW_API_KEY not set (environment or .env)');
};

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const call = async (method, path, key, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'X-HereNow-Client': CLIENT,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
};

const main = async () => {
  if (!existsSync(join(DIST, 'index.html'))) fail('dist/index.html missing; run `npm run build` first');
  const key = apiKey();
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};

  const files = walk(DIST).map((full) => {
    const data = readFileSync(full);
    return {
      full,
      path: relative(DIST, full).split(sep).join('/'),
      size: data.length,
      contentType: TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream',
      hash: createHash('sha256').update(data).digest('hex'),
    };
  });

  const manifest = {
    files: files.map(({ path, size, contentType, hash }) => ({ path, size, contentType, hash })),
    displayName: 'groove-o-matic',
    displayDescription: 'Browser groove box: acid synth, drum machine, pattern sequencer.',
    viewer: {
      title: 'groove-o-matic',
      description: 'An acid synth and a drum machine in your browser. Pick a groove and start twisting knobs.',
    },
  };

  const created = state.slug
    ? await call('PUT', `/publish/${state.slug}`, key, manifest)
    : await call('POST', '/publish', key, manifest);
  const { slug, upload } = created;
  if (!state.slug) writeFileSync(STATE_FILE, `${JSON.stringify({ slug }, null, 2)}\n`);

  const byPath = new Map(files.map((f) => [f.path, f]));
  for (const target of upload.uploads) {
    const file = byPath.get(target.path);
    if (!file) fail(`server asked for unknown file ${target.path}`);
    const res = await fetch(target.url, { method: target.method, headers: target.headers, body: readFileSync(file.full) });
    if (!res.ok) fail(`upload ${target.path} -> ${res.status}`);
    console.log(`  uploaded ${target.path} (${file.size} B)`);
  }
  for (const path of upload.skipped ?? []) console.log(`  unchanged ${path}`);

  const done = await call('POST', `/publish/${slug}/finalize`, key, { versionId: upload.versionId });
  for (const w of done.warnings ?? []) console.warn(`  warning: ${w}`);
  console.log(done.unchanged ? 'No changes; live version kept.' : `Published version ${done.currentVersionId}.`);
  console.log(`Live at: ${done.primaryUrl ?? done.siteUrl}`);
  if (done.publishStatus) console.log(`Status: ${done.publishStatus.ownership}, ${done.publishStatus.persistence}`);
};

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
