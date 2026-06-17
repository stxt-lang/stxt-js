import typescript from '@rollup/plugin-typescript';

// Nombre del test a empaquetar (lo fija run-test.js vía variable de entorno).
const name = process.env.STXT_TEST || 'hello';

// Empaqueta src/test/<name>.ts a un único JS ejecutable con node.
// Rollup resuelve los imports sin extensión que usa el código fuente.
export default {
  input: `src/test/${name}.ts`,
  output: {
    file: `dist/${name}.js`,
    format: 'es'
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.json', outDir: 'dist', sourceMap: false })
  ]
};
