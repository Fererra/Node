// Rules from docs/architecture.md#rules. $1 in `to` is the module name
// captured by the `from` path.

/** Allowed module → module dependencies (the module graph). */
const graph = {
  auth: ['users'],
  users: [],
  movies: [],
  seats: [],
  showtimes: ['movies', 'seats'],
  bookings: ['showtimes', 'seats', 'users'],
};

const otherModule = {
  path: '^src/modules/[^/]+/',
  pathNot: '^src/modules/$1/',
};

/** Every way dependency-cruiser can classify an npm package import. */
const npmDependencyTypes = [
  'npm',
  'npm-dev',
  'npm-optional',
  'npm-peer',
  'npm-bundled',
  'npm-no-pkg',
  'npm-unknown',
];

/** Framework and ORM packages, resolved or not (fastify, @fastify/*, drizzle-orm). */
const frameworkPackages =
  '^(node_modules/)?(fastify|@fastify/[^/]+|drizzle-orm)(/|$)';

/** Database packages, resolved or not (drizzle-orm, pg). */
const databasePackages = '^(node_modules/)?(drizzle-orm|pg)(/|$)';

/** Module infrastructure layers. */
const infrastructure = '^src/modules/[^/]+/infrastructure/';

/** A module's entry point (assembly point). */
const moduleIndex = '^src/modules/[^/]+/index\\.ts$';

/** Shared ports and helpers any layer except domain may use (ADR-0004). */
const sharedCore =
  '^src/shared/(context|unit-of-work|clock|retry|logger|errors)\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },

    // Between modules
    ...Object.entries(graph).map(([module, allowed]) => ({
      name: `module-graph-${module}`,
      comment: `${module} may depend only on: ${allowed.join(', ') || 'none'}`,
      severity: 'error',
      from: { path: `^src/modules/${module}/` },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: `^src/modules/(${[module, ...allowed].join('|')})/`,
      },
    })),
    {
      name: 'cross-module-only-from-application',
      comment: 'Only application may depend on another module',
      severity: 'error',
      from: {
        path: '^src/modules/([^/]+)/',
        pathNot: '^src/modules/[^/]+/application/',
      },
      to: otherModule,
    },
    {
      name: 'cross-module-only-via-index',
      comment: 'Another module is imported only through its index.ts',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        ...otherModule,
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'cross-module-only-type-imports',
      comment: 'Another module is imported only with `import type`',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: { ...otherModule, dependencyTypesNot: ['type-only'] },
    },

    // App and shared
    {
      name: 'app-imports-modules-via-index',
      severity: 'error',
      from: { path: '^src/app/' },
      to: {
        path: '^src/modules/',
        pathNot: '^src/modules/[^/]+/index\\.ts$',
      },
    },
    {
      name: 'modules-not-to-app',
      severity: 'error',
      from: { path: '^src/modules/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'shared-not-to-modules-or-app',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(modules|app)/' },
    },
    {
      name: 'shared-kernel-only-kernel',
      comment: 'shared/kernel → nothing else in src (not the rest of shared)',
      severity: 'error',
      from: { path: '^src/shared/kernel/' },
      to: { path: '^src/', pathNot: '^src/shared/kernel/' },
    },
    {
      name: 'shared-kernel-no-npm',
      comment: 'shared/kernel → no npm packages',
      severity: 'error',
      from: { path: '^src/shared/kernel/' },
      to: { dependencyTypes: npmDependencyTypes },
    },

    {
      name: 'shared-core-no-npm',
      comment:
        'Shared ports and helpers (context, unit-of-work, clock, retry, logger, errors) → no npm packages',
      severity: 'error',
      from: { path: sharedCore },
      to: { dependencyTypes: npmDependencyTypes },
    },
    {
      name: 'shared-core-only-shared-core',
      comment:
        'Shared ports and helpers import only each other and shared/kernel, so a port never pulls in an implementation',
      severity: 'error',
      from: { path: sharedCore },
      to: { path: '^src/', pathNot: [sharedCore, '^src/shared/kernel/'] },
    },

    // Database (NFR-2, AC-10)
    {
      name: 'db-packages-only-in-infrastructure-and-shared-db',
      comment:
        'drizzle-orm and pg only in module infrastructure and src/shared/db/',
      severity: 'error',
      from: { path: '^src/', pathNot: [infrastructure, '^src/shared/db/'] },
      to: { path: databasePackages },
    },
    {
      name: 'pg-only-in-shared-db',
      comment: 'The driver (pg) is used only by src/shared/db/',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/shared/db/' },
      to: { path: '^(node_modules/)?pg(/|$)' },
    },
    {
      name: 'shared-db-only-from-infrastructure-app-and-index',
      comment:
        "Only module infrastructure, src/app/ and a module's index.ts may import src/shared/db/",
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [infrastructure, moduleIndex, '^src/app/', '^src/shared/db/'],
      },
      to: { path: '^src/shared/db/' },
    },
    {
      name: 'index-only-type-imports-from-shared-db',
      comment:
        "A module's index.ts imports src/shared/db/ only with `import type` (to type the storage option)",
      severity: 'error',
      from: { path: moduleIndex },
      to: { path: '^src/shared/db/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'infrastructure-only-own-schema',
      comment:
        "A module's infrastructure imports only its own schema file (src/shared/db/schema/<module>.ts)",
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/infrastructure/' },
      to: {
        path: '^src/shared/db/schema/',
        pathNot: '^src/shared/db/schema/$1\\.ts$',
      },
    },

    // Layers inside a module (other modules are covered above)
    {
      name: 'layer-http',
      comment: 'http → application',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/http/' },
      to: {
        path: '^src/modules/$1/',
        pathNot: '^src/modules/$1/(http|application)/',
      },
    },
    {
      name: 'layer-infrastructure',
      comment: 'infrastructure → application, domain',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/infrastructure/' },
      to: {
        path: '^src/modules/$1/',
        pathNot: '^src/modules/$1/(infrastructure|application|domain)/',
      },
    },
    {
      name: 'layer-application',
      comment: 'application → domain',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/application/' },
      to: {
        path: '^src/modules/$1/',
        pathNot: '^src/modules/$1/(application|domain)/',
      },
    },
    {
      name: 'layer-domain',
      comment: 'domain → only shared/kernel (and its own domain)',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/domain/' },
      to: {
        path: '^src/',
        pathNot: ['^src/shared/kernel/', '^src/modules/$1/domain/'],
      },
    },

    // Packages inside a module's layers (node: built-ins are not npm packages)
    {
      name: 'layer-domain-no-npm',
      comment: 'domain → no npm packages',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { dependencyTypes: npmDependencyTypes },
    },
    {
      name: 'layer-application-no-framework',
      comment: 'application → no framework or ORM packages',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/application/' },
      to: { path: frameworkPackages },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.d.ts'],
    },
  },
};
