import babel from '@rollup/plugin-babel'
import resolve from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'

const extensions = ['.js']

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'umd',
      name: 'McpLoggerBrowser',
      sourcemap: true
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    resolve({ extensions }),
    replace({ 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'), preventAssignment: true }),
    babel({
      babelHelpers: 'bundled',
      extensions,
      presets: [
        [
          '@babel/preset-env',
          {
            targets: {
              ie: '11'
            },
            modules: false,
            loose: true
          }
        ]
      ]
    })
  ]
}
