// Launcher for `npm start`: sets GIT_SHA for /version, then starts the built server.
import { setGitSha } from './git-sha.mjs';

setGitSha(process.env);

await import('../dist/app/main.js');
