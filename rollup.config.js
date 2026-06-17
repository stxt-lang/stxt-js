import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/all.ts',
  output: {
    file: 'WebContent/js/stxt-parser.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json' })
  ]
};
