const path = require('path');

const as_path = (subpath) => path.resolve(__dirname, subpath);

module.exports = {
  entry: {
    submissions: './submissions/webpack_src/submissions.js',
  },
  output: {
    filename: '[name].bundle.js',
    path: as_path('static/bundles'),
  },
  resolve: {
    alias: {
      hello_world: as_path('viewmodule/webpack_src/hello_world.js'),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: { presets: ['@babel/preset-env'] }
      },
    ],
  },
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
