module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
  plugins: [
    ['module-resolver', {
      alias: {
        '@src': './src',
        '@controllers': './src/controllers',
        '@services': './src/services',
        '@models': './src/models',
        '@middlewares': './src/middlewares',
        '@utils': './src/utils',
      },
    }],
  ],
};