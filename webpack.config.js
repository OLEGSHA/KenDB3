const path = require('path');
const webpack = require('webpack');

const as_path = (subpath) => path.resolve(__dirname, subpath);

module.exports = (env, argv) => {
  return {
    entry: {
      submissions: './submissions/webpack_src/submissions.ts',
    },
    output: {
      filename: '[name].bundle.js',
      path: as_path('static/bundles'),
    },
    resolve: {
      extensions: ['.js', '.ts'],
      alias: {
        common: as_path('javascript_pipeline/webpack_src/common.ts'),
        viewmodule: as_path('viewmodule/webpack_src/viewmodule.ts'),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|ts)$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
      ],
    },
    plugins: [
      /*
       * TODO: add '"globals": { "PRODUCTION": true }' to .eslintrc when eslint
       * is installed
       */
      new webpack.DefinePlugin({
        PRODUCTION: JSON.stringify(argv.mode === 'production'),
      }),
    ],
    cache: {
      /*
       * Using filesystem cache can cause CI problems, e.g.
       *   https://github.com/webpack/webpack/issues/13291
       *
       * Source: https://stackoverflow.com/a/71599521/4463352
       */
      type: 'filesystem',
    },
  };
};
