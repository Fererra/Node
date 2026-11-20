// `npm run test:all` (= `make test`): every test level with one command
// (spec 03 FR-4, NFR-3, NFR-5; standards/checks.md#test-levels). Stops at
// the first failing step with a non-zero exit code and always stops the
// E2E server. PostgreSQL stays up after the run. Works without `make`.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import pg from 'pg';
import {
  databaseOf,
  databaseUrls,
  maintenanceUrl,
  parseEnvText,
  sameDatabasePairs,
} from './test-env.mjs';

const E2E_PORT = 3100;
const HEALTH_URL = `http://localhost:${String(E2E_PORT)}/health`;
const SERVER_START_TIMEOUT_MS = 30_000;
const POSTGRES_READY_TIMEOUT_MS = 30_000;

/** @param {string} title */
function step(title) {
  console.log(`\n=== test:all: ${title}`);
}

/**
 * Runs a command with inherited output; rejects on a non-zero exit.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, shell?: boolean }} [options]
 */
function run(command, args, { env = process.env, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env, shell });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) resolve(undefined);
      else {
        const why = signal ?? `exit code ${String(code)}`;
        reject(new Error(`${[command, ...args].join(' ')} failed (${why})`));
      }
    });
  });
}

/**
 * `npm run <script>`. Under `npm run`, npm's own CLI is started with this
 * Node, so Windows needs no shell; otherwise `npm` goes through a shell
 * on Windows, where it is `npm.cmd`.
 *
 * @param {string} script
 * @param {NodeJS.ProcessEnv} env
 */
function npm(script, env) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && /\.[cm]?js$/.test(npmCli)) {
    return run(process.execPath, [npmCli, 'run', script], { env });
  }
  return run('npm', ['run', script], {
    env,
    shell: process.platform === 'win32',
  });
}

/** @param {string} path */
function readEnvFile(path) {
  return parseEnvText(
    existsSync(path) ? readFileSync(path, 'utf8') : undefined,
  );
}

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates the database of `url` if it doesn't exist. Retries the
 * connection while PostgreSQL finishes starting.
 *
 * @param {string} url
 */
async function ensureDatabase(url) {
  const { name } = databaseOf(url);
  const deadline = Date.now() + POSTGRES_READY_TIMEOUT_MS;
  for (;;) {
    const client = new pg.Client({ connectionString: maintenanceUrl(url) });
    try {
      await client.connect();
      const found = await client.query(
        'select 1 from pg_database where datname = $1',
        [name],
      );
      if (found.rowCount === 0) {
        await client.query(`create database "${name.replaceAll('"', '""')}"`);
        console.log(`created database ${name}`);
      } else {
        console.log(`database ${name} exists`);
      }
      return;
    } catch (error) {
      const code = /** @type {{ code?: string }} */ (error).code;
      const starting =
        code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === '57P03';
      if (!starting || Date.now() > deadline) throw error;
      await sleep(500);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}

/** Fails early when something already listens on the E2E port. */
function assertPortFree() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', () => {
      reject(
        new Error(
          `port ${String(E2E_PORT)} is in use: stop the process on it and rerun`,
        ),
      );
    });
    probe.listen(E2E_PORT, '127.0.0.1', () => {
      probe.close(() => {
        resolve(undefined);
      });
    });
  });
}

/**
 * The E2E server: built dist/ through scripts/start.mjs. Its output is
 * kept and printed only when a step fails.
 *
 * @param {NodeJS.ProcessEnv} env
 */
function startServer(env) {
  const child = spawn(process.execPath, ['scripts/start.mjs'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  /** @type {string[]} */
  const output = [];
  const keep = (/** @type {Buffer} */ chunk) => {
    output.push(chunk.toString());
    if (output.length > 500) output.shift();
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  /** @type {Promise<void>} */
  const exited = new Promise((resolve) => {
    child.once('exit', () => {
      resolve();
    });
  });
  return { child, output, exited };
}

/** @param {ReturnType<typeof startServer>} server */
async function waitForHealth(server) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `the E2E server exited with code ${String(server.child.exitCode)}`,
      );
    }
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await sleep(250);
  }
  throw new Error(`${HEALTH_URL} did not answer within 30 s`);
}

/** @param {ReturnType<typeof startServer>} server */
async function stopServer(server) {
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill('SIGTERM');
    const timeout = sleep(10_000).then(() => 'timeout');
    if ((await Promise.race([server.exited, timeout])) === 'timeout') {
      server.child.kill('SIGKILL');
      await server.exited;
    }
  }
  console.log('E2E server stopped');
}

/** @type {ReturnType<typeof startServer> | undefined} */
let server;

for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM'])) {
  process.once(signal, () => {
    server?.child.kill('SIGKILL');
    process.exit(130);
  });
}

async function main() {
  step('database URLs');
  const urls = databaseUrls(readEnvFile('.env'), readEnvFile('.env.example'));
  const same = sameDatabasePairs(urls);
  if (same.length > 0) {
    const list = same.map(([a, b]) => `${a} and ${b}`).join(', ');
    throw new Error(
      `${list} name the same database: tests empty it, so every URL needs its own database`,
    );
  }
  for (const [name, url] of Object.entries(urls)) {
    const { host, port, name: db } = databaseOf(url);
    console.log(`${name}: ${host}:${port}/${db}`);
  }
  // Only the database URLs come from .env / .env.example; everything else
  // is set per step below.
  const env = { ...process.env, ...urls };

  step('PostgreSQL (Docker Compose)');
  await run('docker', ['compose', 'up', '--detach', '--wait', 'postgres']);
  await ensureDatabase(urls.TEST_DATABASE_URL);
  await ensureDatabase(urls.E2E_DATABASE_URL);

  step('npm run check (STORAGE=memory)');
  await npm('check', { ...env, STORAGE: 'memory' });

  step('npm run test:func (PostgreSQL)');
  await npm('test:func', env);

  step('E2E: migrate and seed the E2E database with the built code');
  const e2eDb = { ...env, DATABASE_URL: urls.E2E_DATABASE_URL };
  await run(process.execPath, ['dist/app/cli/migrate.js'], { env: e2eDb });
  await run(process.execPath, ['dist/app/cli/seed.js'], { env: e2eDb });

  step(`E2E: start the server on port ${String(E2E_PORT)}`);
  await assertPortFree();
  server = startServer({
    ...e2eDb,
    PORT: String(E2E_PORT),
    STORAGE: 'postgres',
  });
  try {
    try {
      await waitForHealth(server);
    } catch (error) {
      console.error(server.output.join(''));
      throw error;
    }
    console.log(`${HEALTH_URL} is up`);

    step('npm run test:e2e');
    await npm('test:e2e', env);
  } finally {
    await stopServer(server);
  }
}

try {
  await main();
  console.log('\n=== test:all: passed');
} catch (error) {
  console.error(
    `\n=== test:all: failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
