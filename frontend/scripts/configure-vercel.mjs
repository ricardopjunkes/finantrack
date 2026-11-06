import { readFile, writeFile } from 'node:fs/promises';
const value = process.argv[2];
if (!value)
  throw new Error(
    'Informe a origem HTTPS real do backend: node scripts/configure-vercel.mjs https://backend.example.invalid',
  );
const url = new URL(value);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
)
  throw new Error(
    'Use somente uma origem HTTPS sem credenciais, caminhos ou parâmetros.',
  );
const path = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(await readFile(path, 'utf8'));
config.rewrites = [
  { source: '/api/:path*', destination: `${url.origin}/api/:path*` },
  { source: '/(.*)', destination: '/index.html' },
];
await writeFile(path, JSON.stringify(config, null, 2) + '\n');
console.log(
  'Proxy /api e fallback SPA configurados. Revise vercel.json antes de publicar.',
);
