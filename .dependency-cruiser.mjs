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
      comment: 'domain → only shared',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/domain/' },
      to: {
        path: '^src/',
        pathNot: ['^src/shared/', '^src/modules/$1/domain/'],
      },
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
