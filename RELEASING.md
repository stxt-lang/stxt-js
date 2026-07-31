# Publicar una versión en npm

Guía rápida del proceso completo desde terminal. Todo lo que hay aquí está contrastado con
[package.json](package.json); el porqué de cada decisión está en la sección "The npm package"
de [CLAUDE.md](CLAUDE.md).

Paquete: **`@stxt-lang/core`**, licencia MIT, CommonJS (`out/`), sin dependencias en runtime.
La versión va **alineada con `dev.stxt:stxt-core`** (Maven Central): el mismo número debe
significar el mismo comportamiento en las dos implementaciones.

Equivalente de este fichero en el otro proyecto: [`../stxt-java/RELEASING.md`](../stxt-java/RELEASING.md).

---

## 0. Requisitos (comprobar una vez)

```bash
node -v                       # 22.x (los tipos son @types/node 22.x)
npm -v                        # 11.x
npm config get registry       # https://registry.npmjs.org/
npm whoami                    # tu usuario; si da 401, npm login
ls ../stxt-web/.stxt          # necesario para que corran las suites de corpus
```

- **`npm whoami` con `401 Unauthorized` significa que no hay sesión**, no que el paquete esté mal.
  Se arregla con `npm login` (el scope `@stxt-lang` es tuyo, no hace falta nada más).
- `publishConfig.access: "public"` ya está en `package.json` y es **obligatorio**: los paquetes con
  scope se publican como privados por defecto y npm contesta `402 Payment Required`.
- No hay firma GPG ni paso manual en ninguna web: `npm publish` publica al instante.

---

## 1. Preparar la versión

| Qué | Dónde |
|---|---|
| `version` | [package.json](package.json) **y** [package-lock.json](package-lock.json) (dos sitios dentro del lock) |
| Entrada nueva | `../stxt-vscode/stxt/CHANGELOG.md`, formato Keep a Changelog: pasar lo de `[Unreleased]` al número nuevo |
| Exports nuevos | [src/all.ts](src/all.ts), **con JSDoc** (ver más abajo) |

La forma segura de tocar la versión es dejar que lo haga npm, que actualiza el lock a la vez:

```bash
npm version 0.5.4 --no-git-tag-version    # sin --no-git-tag-version haría commit + tag él solo
```

Editar `package.json` a mano deja el lock con el número anterior — pasó en la 0.5.3 y se arregló
con `npm install --package-lock-only --offline`.

Dos cosas más antes de seguir:

- **El CHANGELOG del lenguaje vive en el repo de la extensión**, `../stxt-vscode/stxt/CHANGELOG.md`,
  aunque los cambios del parser se hagan aquí. Aquí no hay CHANGELOG propio.
- El **README es la portada del paquete en npmjs.com**: el snippet de instalación no lleva número
  de versión (no hay que tocarlo), pero sus ejemplos están ejecutados contra `out/all.js` real y
  deben seguir estándolo.

---

## 2. Build y comprobaciones

```bash
npm test                     # pretest = build + lint, y luego mocha sobre out/test
```

Qué mirar en la salida:

- **`224 passing` y ningún `pending`.** Un test pendiente significa que no se ha encontrado
  `../stxt-web` y que las suites de corpus —justo la red de seguridad que valida la conformidad
  con la spec— no se han ejecutado. Se fuerza la ruta con `STXT_WEB=/ruta npm test`.
- Las tres suites de corpus deben aparecer: documentos, schemas/templates y writer.
- `tsc` tiene `strict` + `noEmitOnError`, así que un error de tipos ya tumba el `pretest`.

Desde la **0.5.3** hay una vara de medir más, equivalente a los "cero avisos de javadoc" del lado
Java: **todo lo exportado desde `all.ts` lleva JSDoc**, y `tsc` lo copia a `out/**/*.d.ts`, que es
lo que ve un consumidor al pasar el ratón por encima en el editor. Un export nuevo sin JSDoc es
una API indocumentada:

```bash
for f in $(find src -name '*.ts'); do grep -q '/\*\*' $f || echo "sin JSDoc: $f"; done
# solo debe salir src/all.ts (es únicamente re-exports)
```

Y comprobar qué se va a subir **antes** de subirlo:

```bash
npm pack --dry-run
```

Qué mirar en esa lista:

- **115 ficheros**: `.js` + `.d.ts` del barrel y de las seis subcarpetas, más `README.md` y
  `LICENSE` (npm los mete siempre, no hacen falta en `files`).
- **Ni `out/test/`** (los tests de este repo) **ni `.js.map`** (colgarían, porque `src/` no se
  publica). Los excluye el `files` de `package.json`, incluida la negación `"!out/**/*.js.map"`.
- Tamaño de referencia: 0.5.3 son 41,9 kB empaquetados / 173,7 kB desempaquetados. La 0.5.2 eran
  27 kB con los mismos 115 ficheros: la diferencia es el JSDoc de la 0.5.3.

`out/` está en `.gitignore` y `"prepare": "npm run build"` lo regenera al publicar, así que da
igual cómo esté al empezar; lo que manda es que `npm test` haya pasado.

---

## 3. Publicar

```bash
npm publish
```

- **No hay estado "pendiente" ni punto de confirmación**: cuando el comando termina, la versión ya
  está pública y es inmutable.
- `npm unpublish` solo es posible en las primeras 72 h y está desaconsejado; además **el número no
  se puede reutilizar** después. Si algo sale mal, se sube el siguiente número.

---

## 4. Verificar desde el registro

No fiarse del `npm pack` local: mirar lo que ha quedado publicado.

```bash
npm view @stxt-lang/core version
npm view @stxt-lang/core dist.fileCount dist.unpackedSize
npm view @stxt-lang/core license

cd /tmp && npm pack @stxt-lang/core@X.Y.Z && tar tzf stxt-lang-core-X.Y.Z.tgz | sort
```

En el listado del tarball: `README.md` y `LICENSE` presentes, ningún `.js.map`, ninguna carpeta
`out/test`, y `package/out/all.d.ts` con todos los exports esperados.

---

## 5. Etiquetar en git

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Los tags aquí son **anotados** desde la 0.5.2 (`v0.5.1` se puso a posteriori sobre el `gitHead`
que registró la publicación). Hay que pasar `-m`: sin él, git abre el editor.

Idealmente el commit está hecho **antes** de publicar, para que el tarball inmutable corresponda a
un estado que está en git.

---

## 6. Actualizar la extensión

La extensión consume este paquete desde el registro, no por `file:`:

```bash
cd ../stxt-vscode/stxt
# subir "@stxt-lang/core": "^X.Y.Z" en package.json
npm install                  # el lock registra la versión del registro
npm run compile && npm run lint
```

- Extensión y paquete han ido **en paralelo** hasta ahora (extensión 0.5.2 ↔ core 0.5.2).
- La entrada del CHANGELOG de allí ya se escribió en el paso 1: es la misma para el lenguaje y para
  la extensión.
- Si `npm install` allí intenta **compilar este repo** en vez de bajarse el tarball, es que el
  `package-lock.json` de la extensión tiene restos de `npm link` (`"resolved": "../../stxt-js"`,
  `"link": true`). Es el primer sitio donde mirar.

---

## Referencia rápida

```bash
npm version X.Y.Z --no-git-tag-version     # 1. package.json + package-lock.json
#   + entrada en ../stxt-vscode/stxt/CHANGELOG.md
npm test                                    # 2. build + lint + 224 passing, 0 pending
npm pack --dry-run                          # 3. 115 ficheros, sin out/test ni .js.map
npm publish                                 # 4. inmediato e inmutable
npm view @stxt-lang/core version            # 5. verificar desde el registro
git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z      # 6.
#   7. subir el rango en ../stxt-vscode/stxt/package.json + npm install allí
```

---

## Si algo va mal

| Síntoma | Causa y arreglo |
|---|---|
| `401 Unauthorized` en `whoami` o `publish` | No hay sesión. `npm login`. |
| `402 Payment Required` | Falta `publishConfig.access: "public"`; los paquetes con scope son privados por defecto. |
| `403 You cannot publish over the previously published versions` | Ese número ya existe. Sube la versión (y acuérdate de alinearla con `dev.stxt:stxt-core`). |
| Tests en `pending` | No encuentra `../stxt-web`. `STXT_WEB=/ruta npm test`. |
| El tarball trae `.js.map` o `out/test` | Se ha tocado `files` en `package.json`; falta la negación `"!out/**/*.js.map"` o sobra una subcarpeta. |
| El lock quedó en la versión anterior | Se editó `package.json` a mano. `npm install --package-lock-only --offline`. |
| En la extensión, `npm install` intenta compilar este repo | Resto de `npm link` en su `package-lock.json`. |
