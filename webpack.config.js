const MiniCssExtractPlugin = require('mini-css-extract-plugin');
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
      extensions: ['.js', '.ts', '.sass', '.scss'],
      alias: yankAliasesFromTsconfig(),
    },
    module: {
      rules: [
        {
          test: /\.(js|ts)$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
        {
          test: /\.(sass|scss)$/,
          use: [
            MiniCssExtractPlugin.loader,
            "css-loader",
            "sass-loader",
          ],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: "[name].css",
        chunkFilename: "[id].css",
      }),
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

function yankAliasesFromTsconfig() {
  const fs = require('fs');
  const tsconfig = JSON.parse(fs.readFileSync('./tsconfig.json'));
  const paths = tsconfig.compilerOptions.paths;

  removeSuffix = (str, suffix) => {
    if (str.endsWith(suffix)) {
      return str.slice(0, -suffix.length);
    } else {
      return str;
    }
  };

  const result = {};
  for (const [tsAlias, tsPaths] of Object.entries(paths)) {
    const alias = removeSuffix(tsAlias, '/*');
    const path = removeSuffix(tsPaths[0], '/*');
    result[alias] = as_path(path);
  }

  return result;
}
