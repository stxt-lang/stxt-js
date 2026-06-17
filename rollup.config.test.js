import typescript from '@rollup/plugin-typescript';

// Empaqueta un test (TS) a un único JS ejecutable con node.
// Rollup resuelve los imports sin extensión que usa el código fuente.
export default {
  input: 'src/test/hello.ts',
  output: {
    file: 'dist/hello.js',
    format: 'es'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json', outDir: 'dist', sourceMap: false })
  ]
};
