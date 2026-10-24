// GIT_SHA for /version, used by the `npm start` launcher.
import { execFileSync } from 'node:child_process';

/** @returns {string} the short SHA of HEAD; throws if git fails. */
export function gitRevParse() {
  return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * Keeps a non-empty GIT_SHA; otherwise sets it from git.
 * If git fails, GIT_SHA is left as it was and /version reports "unknown".
 * @param {NodeJS.ProcessEnv} env
 * @param {() => string} revParse
 */
export function setGitSha(env, revParse = gitRevParse) {
  if (env.GIT_SHA === undefined) {
    try {
      env.GIT_SHA = revParse();
    } catch {
      // Not a git checkout or no git.
    }
  }
}
