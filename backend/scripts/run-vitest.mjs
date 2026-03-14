import { spawnSync } from 'node:child_process';

const passthroughArgs = process.argv.slice(2).filter((arg) => arg !== '--runInBand');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const result = spawnSync(
  command,
  ['vitest', 'run', '--passWithNoTests', ...passthroughArgs],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
