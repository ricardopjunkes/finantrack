import { describe, it, expect } from 'vitest';
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
describe('preparação do proxy Vercel', () => {
  async function execute(origin) {
    const prefix = join(tmpdir(), 'finantrack-vercel-');
    const work = await mkdtemp(prefix);
    if (!resolve(work).startsWith(resolve(prefix))) throw new Error('Diretório temporário inesperado.');
    try {
      await mkdir(join(work, 'scripts'));
      await copyFile(
        fileURLToPath(new URL('./configure-vercel.mjs', import.meta.url)),
        join(work, 'scripts', 'configure-vercel.mjs'),
      );
      await writeFile(
        join(work, 'vercel.json'),
        JSON.stringify({
          rewrites: [{ source: '/(.*)', destination: '/index.html' }],
        }),
      );
      const result = spawnSync(
        process.execPath,
        [join(work, 'scripts', 'configure-vercel.mjs'), origin],
        { encoding: 'utf8', windowsHide: true },
      );
      return {
        status: result.status,
        config: JSON.parse(await readFile(join(work, 'vercel.json'), 'utf8')),
      };
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  it('gera proxy HTTPS antes do fallback SPA sem acessar a rede', async () => {
    const result = await execute('https://api.example.invalid');
    expect(result.status).toBe(0);
    expect(result.config.rewrites).toEqual([
      {
        source: '/api/:path*',
        destination: 'https://api.example.invalid/api/:path*',
      },
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });
  it('recusa HTTP e URLs com credenciais sem modificar a configuração', async () => {
    for (const origin of [
      'http://api.example.invalid',
      'https://user:secret@api.example.invalid',
      'https://api.example.invalid/path',
    ]) {
      const result = await execute(origin);
      expect(result.status).not.toBe(0);
      expect(result.config.rewrites).toHaveLength(1);
    }
  });
});
