import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
if (!process.env.TEST_DATABASE_URL) {
  console.error(
    'Configure TEST_DATABASE_URL em backend/.env antes de executar test:db.',
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/vitest/vitest.mjs', import.meta.url),
      ),
      'run',
      'tests/database.integration.test.ts',
    ],
    { stdio: 'inherit', windowsHide: true },
  );
  process.exitCode = result.status ?? 1;
}
