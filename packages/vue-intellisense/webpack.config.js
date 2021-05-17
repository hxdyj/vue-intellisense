const path = require('path');

module.exports = {
  entry: './cli.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cli.js',
  },
  mode:'production'
};
