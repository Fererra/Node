// Database URLs of `npm run test:all` (standards/checks.md#test-levels).
// Pure helpers, so scripts/test-env.test.mjs can test them without I/O.
import { parseEnv } from 'node:util';

export const DATABASE_URL_NAMES = /** @type {const} */ ([
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'E2E_DATABASE_URL',
]);

/** Variables of a `.env`-style file; `undefined` text means no file. */
export function parseEnvText(/** @type {string | undefined} */ text) {
  return text === undefined ? {} : parseEnv(text);
}

/**
 * Each database URL from `.env`, or from `.env.example` when `.env` or
 * that variable is missing (an empty value counts as missing).
 *
 * @param {Record<string, string | undefined>} dotEnv
 * @param {Record<string, string | undefined>} example
 * @returns {Record<(typeof DATABASE_URL_NAMES)[number], string>}
 */
export function databaseUrls(dotEnv, example) {
  /** @type {Record<string, string>} */
  const urls = {};
  for (const name of DATABASE_URL_NAMES) {
    const value = dotEnv[name] || example[name];
    if (!value) {
      throw new Error(`${name} is set neither in .env nor in .env.example`);
    }
    urls[name] = value;
  }
  return /** @type {Record<(typeof DATABASE_URL_NAMES)[number], string>} */ (
    urls
  );
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The database a URL names: host (loopback names are one host), port
 * (default 5432) and database name (default: the user name, like libpq).
 */
export function databaseOf(/** @type {string} */ url) {
  const u = new URL(url);
  const hostname = u.hostname.toLowerCase();
  const host = LOOPBACK.has(hostname) ? 'localhost' : hostname;
  const port = u.port || '5432';
  const name =
    decodeURIComponent(u.pathname.replace(/^\//, '')) ||
    decodeURIComponent(u.username);
  return { host, port, name };
}

/**
 * Pairs of variable names whose URLs name the same database (spec 03
 * NFR-3); the run refuses to start when there is any.
 *
 * @param {Record<string, string>} urls
 * @returns {[string, string][]}
 */
export function sameDatabasePairs(urls) {
  const key = (/** @type {string} */ url) => {
    const { host, port, name } = databaseOf(url);
    return `${host}:${port}/${name}`;
  };
  const entries = Object.entries(urls);
  /** @type {[string, string][]} */
  const pairs = [];
  entries.forEach(([a, urlA], i) => {
    for (const [b, urlB] of entries.slice(i + 1)) {
      if (key(urlA) === key(urlB)) pairs.push([a, b]);
    }
  });
  return pairs;
}

/** The URL of the `postgres` maintenance database on the same server. */
export function maintenanceUrl(/** @type {string} */ url) {
  const u = new URL(url);
  u.pathname = '/postgres';
  return u.toString();
}
