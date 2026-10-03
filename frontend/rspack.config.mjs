import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { rspack } from '@rspack/core'
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const directory = path.dirname(fileURLToPath(import.meta.url))
export default (_env, argv) => {
  const development = argv.mode === 'development'
  return {
    context: directory,
    entry: './src/main.tsx',
    output: {
      path: path.join(directory, 'dist'),
      filename: 'assets/[name].[contenthash:8].js',
      chunkFilename: 'assets/[name].[contenthash:8].js',
      cssFilename: 'assets/[name].[contenthash:8].css',
      assetModuleFilename: 'assets/[name].[contenthash:8][ext]',
      publicPath: '/', clean: true,
    },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: { '@': path.join(directory, 'src') } },
    module: {
      rules: [
        {
          // Router probes optional React.use; it deliberately falls back on React 18.
          // https://github.com/TanStack/router/issues/7538
          test: /@tanstack[\\/]react-router[\\/]dist[\\/]esm[\\/]utils\.js$/,
          parser: { importExportsPresence: false },
        },
        {
          test: /\.[jt]sx?$/, exclude: /node_modules/, loader: 'builtin:swc-loader',
          options: { jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', development, refresh: development } },
          } },
        },
        { test: /\.css$/, type: 'css/auto', use: ['postcss-loader'] },
        { test: /\.(woff2?|ttf|otf|svg|png|jpe?g)$/, type: 'asset/resource' },
      ],
    },
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      new rspack.HtmlRspackPlugin({ template: './index.html' }),
      new rspack.CopyRspackPlugin({ patterns: [{ from: 'public', to: '.' }] }),
      development && new ReactRefreshRspackPlugin(),
    ].filter(Boolean),
    devtool: development ? 'cheap-module-source-map' : false,
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          react: { test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, name: 'react', priority: 30 },
          tanstack: { test: /[\\/]node_modules[\\/]@tanstack[\\/]/, name: 'tanstack', priority: 20 },
          motion: { test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, name: 'motion', priority: 10 },
        },
      },
    },
    devServer: {
      host: '127.0.0.1', port: 3000, hot: true, historyApiFallback: true,
      static: { directory: path.join(directory, 'public') },
      proxy: [{ context: ['/api'], target: 'http://127.0.0.1:8000' }],
    },
  }
}
