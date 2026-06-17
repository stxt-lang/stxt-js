// Runner de tests: empaqueta src/test/<nombre>.ts con Rollup y lo ejecuta con node.
// Uso:  npm run test            -> ejecuta el test por defecto (hello)
//       npm run test <nombre>   -> ejecuta src/test/<nombre>.ts
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const name = process.argv[2] || 'hello';

if (!/^[\w-]+$/.test(name)) {
  console.error(`Nombre de test no válido: "${name}" (usa solo letras, números, _ o -).`);
  process.exit(1);
}

const src = `src/test/${name}.ts`;
if (!existsSync(src)) {
  console.error(`No existe el test: ${src}`);
  process.exit(1);
}

const env = { ...process.env, STXT_TEST: name };
execSync('rollup -c rollup.config.test.js', { stdio: 'inherit', env });
execSync(`node dist/${name}.js`, { stdio: 'inherit' });
