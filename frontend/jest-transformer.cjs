const babelJest = require('babel-jest').default;

module.exports = babelJest.createTransformer({
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'commonjs'
    }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript'
  ],
  plugins: [
    'babel-plugin-transform-import-meta',
    // Custom plugin to handle import.meta.env
    function() {
      return {
        visitor: {
          MemberExpression(path) {
            // Transform import.meta.env.VARIABLE to process.env.VARIABLE
            if (
              path.node.object &&
              path.node.object.type === 'MemberExpression' &&
              path.node.object.object &&
              path.node.object.object.type === 'MetaProperty' &&
              path.node.object.object.meta &&
              path.node.object.object.meta.name === 'import' &&
              path.node.object.object.property &&
              path.node.object.object.property.name === 'meta' &&
              path.node.object.property &&
              path.node.object.property.name === 'env'
            ) {
              path.node.object.object = {
                type: 'Identifier',
                name: 'process'
              };
            }
          }
        }
      };
    }
  ]
});