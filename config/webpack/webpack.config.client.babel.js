import webpack from 'webpack';
import webpackMerge from 'webpack-merge';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import * as path from 'path';
import reactEnv from '../env';
import paths from '../paths';
import commonConfig from './webpack.config.common.babel';
import loaders from './loaders';

export default entry =>
  webpackMerge(
    commonConfig({
      outputPath: paths.client.output.path,
      outputPublicPath: paths.client.output.publicPath,
    }),
    {
      name: 'client',
      target: 'web',

      context: paths.client.sources,

      entry: entry,

      resolve: {
        modules: [paths.nodeModules.path, paths.client.sources, paths.context],
      },

      // recordsOutputPath: path.join(paths.output.path, 'webpack.client.stats.json'),

      module: {
        rules: [
          {
            test: /\.jsx?$/,
            include: [paths.client.sources, paths.shared.root],
            use: loaders.babel(),
          },
          {
            test: /\.css$/,
            include: [paths.client.sources],
            use: ExtractTextPlugin.extract({
              fallback: 'style-loader',
              use: loaders.css(),
            }),
          },
          {
            test: /\.css$/,
            include: [paths.nodeModules.path],
            use: loaders.cssNodeModules(),
          },
          {
            test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2|otf)$/,
            include: [paths.client.assets],
            use: loaders.assets(),
          },
          {
            test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2|otf)$/,
            include: [paths.nodeModules.path],
            use: loaders.assetsNodeModules(),
          },
        ],
      },

      plugins: [
        // To extract a common code to single separate file.
        new webpack.optimize.CommonsChunkPlugin({
          name: 'vendor', // Add link to this file in html before other JS files, it has a common code.
          minChunks: module => {
            return module.context && module.context.indexOf(paths.nodeModules.dirname) !== -1;
          },
        }),
        // Saves received text to the file, for example css from style-loader and css-loader.
        new ExtractTextPlugin({
          filename: `${paths.client.output.styles}/[name].css`,
          disable: reactEnv.ifDevMode(true, false),
          allChunks: true,
        }),
        new CopyWebpackPlugin([
          {
            from: path.join(paths.devServer.contentBase, 'images'),
            to: path.join(paths.client.output.path, paths.client.output.assets),
          },
        ]),
        //
        new webpack.HotModuleReplacementPlugin(),
      ],

      devServer: {
        // Static content which not processed by webpack and loadable from disk.
        contentBase: paths.devServer.contentBase,
        publicPath: paths.client.output.publicPath,
        historyApiFallback: true, // For react subpages handling with webpack-dev-server
        port: 9000,
        hotOnly: true,
        noInfo: false,
        stats: 'minimal',
        // stats: {
        //   colors: true,
        //   errors: true,
        //   warnings: true,
        //   modules: false,
        //   assets: false,
        //   cached: false,
        //   cachedAssets: false,
        // },
      },
    }
  );
