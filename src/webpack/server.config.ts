import type { Configuration } from 'webpack';
import webpackNodeExternals from 'webpack-node-externals';
import appEnv from '../appEnv';
import paths from '../paths';
import buildConfig from '../buildConfig';
import commonConfig from './common.config';
import { clientDefaultRules, type ClientConfigOptions, prepareRules } from './client.config';
import { TsLoaderType, assets, css, cssNodeModules, getTsLoader } from './loaders';

export const serverDefaultRules: Pick<typeof clientDefaultRules, 'jsRule' | 'tsBaseRule'> = {
  jsRule: {
    ...clientDefaultRules.jsRule,
    include: [paths.server.sources, paths.shared.sources].filter((v) => !!v),
  },
  tsBaseRule: {
    ...clientDefaultRules.tsBaseRule,
    include: [paths.server.sources, paths.shared.sources].filter((v) => !!v),
  },
};

export const universalDefaultRules: typeof clientDefaultRules = {
  jsRule: {
    ...clientDefaultRules.jsRule,
    include: [...(clientDefaultRules.jsRule.include as string[]), paths.server.sources],
  },
  tsBaseRule: {
    ...serverDefaultRules.tsBaseRule,
    include: [...(clientDefaultRules.jsRule.include as string[]), paths.server.sources],
  },
  cssRule: {
    ...clientDefaultRules.cssRule,
    // process css in server side always in ssr mode
    use: css({ ssr: true }),
  },
  cssNodeModulesRule: {
    ...clientDefaultRules.cssNodeModulesRule,
    // process css in server side always in ssr mode
    use: cssNodeModules({ ssr: true }),
  },
  svgRule: {
    ...clientDefaultRules.svgRule,
    use: assets({ limit: undefined, ssr: true }),
  },
  fontRule: {
    ...clientDefaultRules.fontRule,
    use: assets({ ssr: true }),
  },
  assetsRule: {
    ...clientDefaultRules.assetsRule,
    use: assets({ ssr: true }),
  },
};

export interface ServerConfigOptions extends ClientConfigOptions {
  nodeExternalsOptions?: webpackNodeExternals.Options | undefined;
  isUniversal?: boolean | undefined;
}

const serverBuildConfig = buildConfig.server || buildConfig.default.server;

export default ({
  outputPath = paths.server.output.path,
  outputPublicPath = serverBuildConfig.output.publicPath,
  outputJsDir = '',
  hash = false,
  chunkSuffix = '.chunk',
  typescript,
  rules: { tsBaseRule, ...rules } = {},
  nodeExternalsOptions,
  isUniversal,
  ...restOptions
}: ServerConfigOptions): Configuration => {
  const tsConfig: RequiredStrict<Extract<ServerConfigOptions['typescript'], object>> = {
    configFile: paths.server.tsconfig,
    loader: TsLoaderType.Default,
    loaderOptions: {},
    forkedChecks: false,
    checkerOptions: {},
    threadLoader: false,
    threadLoaderOptions: {},
    ...(typeof typescript === 'object'
      ? (typescript as RequiredStrict<typeof typescript>)
      : undefined),
  };

  const { tsBaseRule: defaultTsBaseRule, ...restDefaultRules } = isUniversal
    ? universalDefaultRules
    : serverDefaultRules;

  const defaultRules = {
    tsRule: {
      ...defaultTsBaseRule,
      ...tsBaseRule,
      use: getTsLoader({
        tsconfig: tsConfig.configFile,
        forkedChecks: tsConfig.forkedChecks,
        useThreadLoader: tsConfig.threadLoader,
        threadLoaderOptions: tsConfig.threadLoaderOptions,
        ...tsConfig.loaderOptions,
        loaderType: tsConfig.loader,
      }),
    },
    ...restDefaultRules,
  };

  const preparedRules = prepareRules(rules, defaultRules);

  const moduleRules = { ...defaultRules, ...preparedRules };

  return commonConfig({
    outputPath,
    outputPublicPath,
    outputJsDir,
    hash,
    chunkSuffix,
    typescript: typescript
      ? {
          ...tsConfig,
          checkerOptions: {
            ...tsConfig.checkerOptions,
            typescript: {
              ...tsConfig.checkerOptions.typescript,
              diagnosticsOptions: {
                syntactic: tsConfig.threadLoader, // ts-loader in happyPackMode will not check SyntacticErrors so let check it in this plugin
                ...tsConfig.checkerOptions.typescript?.diagnosticsOptions,
              },
            },
          },
        }
      : undefined,

    name: serverBuildConfig.root,
    target: 'node',

    context: isUniversal ? paths.root : paths.server.sources,

    ...restOptions,

    stats:
      restOptions.stats === false || (restOptions.stats && typeof restOptions.stats !== 'object')
        ? restOptions.stats
        : {
            all: false,
            errors: true,
            errorDetails: true,
            warnings: true,
            version: true,
            timings: true,
            builtAt: true,
            entrypoints: true,
            ...restOptions.stats,
          },

    // http://jlongster.com/Backend-Apps-with-Webpack--Part-I
    externals: [
      webpackNodeExternals(nodeExternalsOptions),
      ...((restOptions.externals &&
        (Array.isArray(restOptions.externals) ? restOptions.externals : [restOptions.externals])) ||
        []),
    ],

    resolve: {
      ...restOptions.resolve,
      modules: [
        isUniversal ? paths.client.sources : paths.server.sources,
        ...((restOptions.resolve && restOptions.resolve.modules) || []),
      ],
      alias: {
        ...(isUniversal
          ? {
              server: paths.server.sources,
              client: paths.client.sources,
            }
          : undefined),
        ...(paths.shared.sources ? { shared: paths.shared.sources } : undefined),
        ...((restOptions.resolve && restOptions.resolve.alias) || undefined),
      },
    },

    module: {
      ...restOptions.module,
      rules: [
        ...Object.getOwnPropertyNames(moduleRules).map(
          (name) => moduleRules[name as keyof typeof moduleRules] || {}
        ),
        ...((restOptions.module && restOptions.module.rules) || []),
      ],
    },

    watchOptions: {
      // Don't watch on client files when isUniversal is true and ssr is turned off
      // because client by self make hot update and server not needs in updated files
      // because server not render react components.
      ignored: [paths.nodeModules.root, ...(isUniversal && !appEnv.ssr ? [paths.client.root] : [])],
      ...restOptions.watchOptions,
    },
  });
};
