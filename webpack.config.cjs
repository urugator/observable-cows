/*import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export default {
  mode: 'development',
  entry: {
    index: './example/index.js',
  },
  devtool: 'inline-source-map',
  devServer: {
    port: 3000,
    static: './dist',
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Development',
    }),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
};
*/
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    index: './example.js',
  },
  devtool: 'inline-source-map',
  devServer: {
    port: 3000,
    static: './dist',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './example.html',
    }),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
};