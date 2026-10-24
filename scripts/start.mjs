// Launcher for `npm start`: sets GIT_SHA for /version, then starts the built server.
import { execFileSync } from 'node:child_process';

if (process.env.GIT_SHA === undefined) {
  try {
    process.env.GIT_SHA = execFileSync(
      'git',
      ['rev-parse', '--short=7', 'HEAD'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    // Not a git checkout or no git: leave GIT_SHA unset, /version reports "unknown".
  }
}

await import('../dist/app/main.js');
