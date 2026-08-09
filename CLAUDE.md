# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) cuando trabaja con código en este repositorio.

## Proyecto

Un analizador TypeScript para **STXT**, un formato de texto estructurado basado en la indentación. Se compila (mediante `tsc`) a un paquete Node CommonJS normal (`out/`), publicado en npm como **`@stxt-lang/core`** y consumido como dependencia — en particular por la extensión `../stxt-vscode/stxt` — en lugar de empaquetarse como un artefacto para navegador.

Este repositorio contiene **todas las clases del analizador/esquema de STXT para el ecosistema JS/TS** — es la fuente de verdad única para esa lógica en este lenguaje, no solo uno más entre varios consumidores. El repositorio hermano `../stxt-vscode/stxt` (la extensión de VSCode) importa este proyecto como dependencia de Node y contiene **solo** código específico de la extensión (comandos, glue del servidor de lenguaje, interfaz); no debe tener sus propias copias de las clases del analizador/esquema. Cuando el trabajo en la extensión parezca necesitar cambios en el analizador/esquema, hazlos aquí y deja que la extensión consuma la dependencia actualizada.

`../stxt-java` es la implementación hermana del mismo lenguaje para el ecosistema Java — debería tener un comportamiento equivalente al de este repositorio (la misma semántica de análisis/validación), solo que en otro lenguaje. Cuando cambies comportamiento aquí, considera si el puerto Java necesita el mismo cambio.

La especificación normativa del lenguaje **no** está en este repositorio: vive en el repositorio hermano `../stxt-web` (español canónico en `es/`, espejo en inglés en `en/`), y sigue siendo la única especificación compartida para todas las implementaciones del lenguaje (este repositorio y `../stxt-java`):

- `../stxt-web/es/stxt-core-ref.stxt` — sintaxis base (STXT-SPEC): indentación, nodos inline, bloques de texto, espacios de nombres, comentarios, normalización, códigos de error.
- `../stxt-web/es/stxt-schema-ref.stxt` — `@stxt.schema` (STXT-SCHEMA-SPEC): `Node`/`Children`/`Child`, tipos, cardinalidades, además del metaesquema oficial.
- `../stxt-web/es/stxt-template-ref.stxt` — `@stxt.template` (STXT-TEMPLATE-SPEC): la forma simplificada de autoría que se puede compilar a un esquema.
- `../stxt-web/es/stxt-discovery-ref.stxt` — descubrimiento de esquemas (STXT-DISCOVERY-SPEC, añadido el 2026-08-02): directorios de resolución `.stxt/`, la cadena por documento, precedencia por espacio de nombres, `STXT_PATH`, errores de resolución.

Consulta esos archivos antes de cambiar la semántica del analizador o del esquema; los cambios de comportamiento aquí deben seguir la especificación, no redefinirla.

## Siguiente paso (a fecha de 2026-08-02)

**`@stxt-lang/core@0.6.0` se publicó el 2026-08-02 y se verificó en el registro.** Es la versión que añade el módulo `src/discovery/` — `DiscoveryResolver`, `DiscoveryResult`, `DiscoveryError` y las interfaces inyectadas `DiscoveryFileSystem`/`DiscoveryEnvironment` — la implementación de referencia de **STXT-DISCOVERY-SPEC** (`../stxt-web/es/stxt-discovery-ref.stxt`, la nueva cuarta especificación, también del 2026-08-02): cadena de resolución por documento (todos los `.stxt/` ascendientes, del más cercano al más lejano, luego nivel de usuario, luego nivel de sistema, o la sustitución `STXT_PATH`), precedencia nearest-wins por espacio de nombres, duplicados en el mismo nivel como errores, caché de nivel compartida entre documentos. El resolver es agnóstico al host a propósito — **sin acceso a `node:fs` ni a `process` en este paquete**; los consumidores inyectan adaptadores (`../stxt-cli` tiene el de Node, `../stxt-vscode/stxt` el de `vscode.workspace.fs`). `npm test` tiene 252 pruebas aprobadas (28 nuevas en `src/test/discovery.test.ts`, conformidad con la especificación sobre un sistema de archivos en memoria), y el README añadió una sección de discovery cuyos ejemplos se ejecutaron contra `out/all.js` y se verificaron en `strict` frente al `.d.ts` publicado.

La implementación quedó en `09b9259` y el paso de README/CLAUDE.md en `c7fe605`, que lleva la etiqueta anotada `v0.6.0`; ambos ya están enviados. El tarball del registro tiene 125 archivos / 51.8 kB empaquetados / 209.8 kB descomprimidos, con `out/discovery` completo (`.js` + `.d.ts`), README + LICENSE incluidos, sin `.js.map`, sin `out/test`, y el JSDoc viajando en el `.d.ts`; instalarlo limpio desde npm resuelve `DiscoveryResolver`/`DiscoveryResult`/`DiscoveryError` en tiempo de ejecución.

Ambos consumidores se reinstalaron contra él ese mismo día y sus ficheros de bloqueo ahora resuelven `0.6.0` desde `registry.npmjs.org` (integridad `sha512-cwD9/jq…`), sin restos de `/tmp` ni de `"link": true`. **Esos dos cambios de `package-lock.json` siguen sin commit, a propósito** — se confirman desde sus propios repositorios. Merece la pena recordar por qué importaba: ambos estaban funcionando contra un tarball en un espacio de trabajo temporal `/tmp` mientras su lock committeado seguía diciendo 0.5.3 desde el registro, lo cual funciona hasta que `/tmp` se limpia — la misma clase de fallo que los antiguos restos de `npm link`, así que es lo primero que hay que comprobar cuando la instalación de un consumidor falla. Después de reinstalar, `../stxt-vscode/stxt` compila y pasa sus 410 pruebas y `../stxt-cli` pasa sus 16.

**Sigue pendiente**: el puerto Java — `../stxt-java` todavía no tiene discovery.

**Corrección sin publicar (2026-08-03, commit `5847d99`)**: `SchemaProviderMemory.addSchema` y `TemplateSchemaProviderMemory.addTemplate` solían llamar a `schemaValidator.validate(node)` y **descartar** el `ValidationException[]` devuelto — un resto del cambio de contrato de `Validator` de lanzar a acumular — de modo que las definiciones inválidas (por ejemplo, un esquema con `Type: FOO`) se registraban sin avisar. Ahora ambas lanzan el primer error, la misma política que `UnifiedSchemaProvider.throwIfInvalid` y `DiscoveryResolver.compile`, y `addSchema` valida *antes* de transformar. Pruebas de regresión en `src/test/providers.test.ts` (4 pruebas; la suite está ahora en **256 aprobadas**). Se detectó mientras se construía el blueprint pseudocódigo de `../stxt-impl`. El registro 0.6.0 **no** incluye esta corrección — hay que publicarla en la siguiente versión.

Versión anterior: **`@stxt-lang/core@0.5.3` se publicó el 2026-07-31 y se verificó en el registro** (115 archivos, 173.7 kB descomprimidos, README + LICENSE incluidos, sin `.js.map`, sin `out/test`, JSDoc viajando en el `.d.ts`). Commit `eb98af7`, etiqueta anotada `v0.5.3` enviada. `npm test` da 224 aprobadas.

Es la versión de documentación que realinea este repositorio con `dev.stxt:stxt-core` 0.5.3 (publicada desde `../stxt-java` el mismo día): todos los comentarios fuente traducidos al inglés y un comentario JSDoc en cada miembro exportado, que `tsc` copia a `out/**/*.d.ts` — el equivalente en TypeScript del javadoc que Java publica en javadoc.io. El único cambio visible para el usuario es el mensaje `NOT_STXT_SCHEMA`, ahora `Expected schema(...) but got ...` como en Java; el código no cambia y las exportaciones de `all.ts` permanecen intactas.

La parte de la extensión de 0.5.3 ya quedó atrás: `../stxt-vscode/stxt` ha publicado desde entonces 0.5.4 y 0.5.5 (versiones de capa de editor — de dónde salen los esquemas y cuándo se analiza un documento — con core fijado en 0.5.3).

El procedimiento de publicación está ahora documentado en [RELEASING.md](RELEASING.md), en paralelo con `../stxt-java/RELEASING.md`. Se redactó mientras se hacía 0.5.3, así que sus cifras (115 archivos, 41.9 kB empaquetados) son las reales de esa versión.

0.5.2 (2026-07-28) cerró la lista de "pulir la cara pública del paquete" — README, LICENSE, metadatos de npm, etiquetas, mapas de origen, archivo de bloqueo — además de la exportación `ValidationException`. Ambas etiquetas están creadas y enviadas: `v0.5.2` en `604477c` y `v0.5.1` retroactivamente en `a25e88e` (el `gitHead` que registró la publicación). **Etiquetar forma ahora parte de la rutina de publicación**, y las etiquetas aquí son anotadas (`git tag -a -m "..."` — pasa `-m` o git abre un editor).

Ideas para cuando haya una próxima versión, ninguna urgente:

- El README de npm es el único documento que muestra la API en uso; mantén honestos sus ejemplos (todos se ejecutaron contra `out/all.js` antes de publicar — el primer borrador había inventado sintaxis de esquema y firmas incorrectas de `Observer`/`NodeWriter`).
- `TypeRegistry`, `RuntimeException` y `SchemaProviderMemory` siguen sin exportarse. Expórtalos solo si algún consumidor los necesita de verdad.
- `SchemaParser.transformNodeToSchema` sigue arrastrando un defensivo `(schChild as any).getNormalizedName?.()` con una rama `CHILD_DEFINITION_API_MISMATCH`, heredado del puerto Java: `ChildDefinition` sí expone el método, así que la rama está muerta. Eliminarla es una limpieza que preserva el comportamiento, y se dejó fuera de 0.5.3 porque esa versión era solo de documentación.

## El paquete npm: `@stxt-lang/core`

El procedimiento paso a paso de publicación vive en [RELEASING.md](RELEASING.md) (en paralelo con `../stxt-java/RELEASING.md`); esta sección explica el *por qué*.

Este repositorio se publica en npm como **`@stxt-lang/core`** — primera versión **0.5.1 el 2026-07-28**, **0.5.2 el mismo día**, **0.5.3 el 2026-07-31**, **0.6.0 el 2026-08-02**. Se eligió ese nombre en lugar de `@stxt-lang/parser` / `@stxt-lang/js` porque "core" deja espacio para futuros paquetes JS hermanos sin competir por el nombre "principal" — una apuesta que salió bien, porque `../stxt-cli` ya existe junto a él. La organización de GitHub `stxt-lang` y el scope npm `@stxt-lang` están reservados por el usuario (la organización también aloja `stxt-vscode`, `stxt-java`, `stxt-web`, `stxt-python`, `stxt-cms`, `stxt-impl`).

Datos de empaquetado que conviene conocer antes de tocar `package.json`:

- `name` es `@stxt-lang/core` con `publishConfig.access: "public"` — obligatorio, porque los paquetes con scope son privados por defecto.
- `main`/`types` apuntan a `out/all.js` / `out/all.d.ts`. **`src/all.ts` es la única superficie pública**: todo lo que un consumidor deba poder importar tiene que reexportarse desde ahí. Actualmente exporta `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`, `ParseException`, `ValidationException`, `Observer`, `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `transformNodeToSchema`, `UnifiedSchemaProvider`, `ConditionalValidator`, `NodeWriter`, `IndentStyle`, `transformTemplateNodeToSchema` y, desde 0.6.0, `DiscoveryResolver`, `DiscoveryOptions`, `DiscoveryResult`, `DiscoveryDefinition`, `DiscoveryLevel`, `DiscoveryError`, `DiscoveryFileSystem`, `DiscoveryEntry`, `DiscoveryEnvironment`. Notablemente **no** exporta: `TypeRegistry`, `RuntimeException`, `SchemaProviderMemory`.
- `"prepare": "npm run build"` regenera `out/` al instalar, y `"files"` está acotado a `out/all.js`, `out/all.d.ts` más los subdirectorios `core`/`discovery`/`exceptions`/`processors`/`runtime`/`schema`/`template` — excluyendo deliberadamente `out/test` (salida de compilación de las propias pruebas de regresión de este repo) y, mediante la negación `"!out/**/*.js.map"`, los mapas de origen (quedaban colgando, porque `src/` no se publica). **Hace falta añadir aquí el equivalente en `out/` de cualquier nuevo subdirectorio bajo `src/`**, o se publicará en silencio sin él — por eso entró `out/discovery` con 0.6.0.
- La licencia es **MIT** en toda la organización `stxt-lang`, copyright `stxt-lang`: `LICENSE` aquí, `LICENSE.txt` en `../stxt-vscode/stxt`. `package.json` decía `ISC` hasta 0.5.2.

Tamaños del tarball, versión a versión: 0.5.1 fueron 169 archivos / 38 kB empaquetados; 0.5.2 y 0.5.3 ambos 115 archivos, 27 kB y 41.9 kB empaquetados (la diferencia es el JSDoc); 0.6.0 mide 125 archivos / 51.8 kB empaquetados / 209.8 kB descomprimidos. El contenido es `.js` y `.d.ts` para el barrel, más los siete subdirectorios, más `README.md` y `LICENSE`.

## Cómo consume esto `../stxt-vscode/stxt`

La extensión de VSCode mantiene **solo** código específico de la extensión (11 archivos bajo `src/extension/` más `src/extension.ts`, y su propio `src/test/`) y depende de este paquete de forma normal: `"dependencies": { "@stxt-lang/core": "^0.6.0" }`, resuelto desde el registro npm. Antes llevaba una copia duplicada de `core/`, `schema/`, `runtime/`, `processors/`, `exceptions/`, `template/` y `test/` (61 archivos) dentro de su propio `src/`; se borraron con `git rm` cuando se hizo la separación.

Las versiones iban en bloque hasta 0.5.3; ya no. La extensión está en **0.5.5** — 0.5.4 y 0.5.5 fueron versiones de capa de editor con core sin cambios en 0.5.3 — así que interpreta los dos números de versión como independientes a partir de ahora.

Ahora hay un **segundo consumidor**: `../stxt-cli` (versión 0.1.0), que también depende de `^0.6.0`. Sigue la misma regla que la extensión — sin clases propias del analizador/esquema; su `src/discovery/NodeDiscovery.ts` son solo los adaptadores `node:fs` + `process.env` para `DiscoveryResolver` más una fábrica `createDiscoveryResolver()`. El objetivo de que discovery viva aquí es precisamente que la CLI y el editor resuelvan los esquemas de forma idéntica.

Consecuencias a tener en cuenta:

- El `npm test` de este repositorio (256 pruebas contra el corpus de `../stxt-web`) es la única suite de regresión para **el lenguaje**. La extensión sí vuelve a tener su propio `npm test` (410 pruebas), pero por diseño comprueba invariantes de *capa de editor* sobre ese mismo corpus — que colorea dentro de la línea, formatea sin cambiar lo que dice el documento y no se cuelga en ninguna posición del cursor — dejando explícitamente la conformidad del lenguaje a este repositorio. Así que un cambio en el analizador/esquema sigue cubriéndose solo aquí; lo que detecta la suite de la extensión es que el editor regrese en documentos ya conocidos como válidos.
- Una corrección del analizador/esquema implica por tanto: cambiarlo aquí → `npm test` → `npm publish` → subir el rango en `stxt-vscode/stxt/package.json` **y `stxt-cli/package.json`** → `npm install` en cada uno para que los lock files registren la nueva versión del registro.
- Ojo con restos de `file:`/`npm link`: después del renombrado, el `package-lock.json` committeado de la extensión seguía teniendo `"resolved": "../../stxt-js", "link": true`, lo que hacía fallar un `npm install` limpio allí (intentaba construir este repositorio en lugar de descargar el tarball). Se arregló el 2026-07-28, pero es el modo de fallo que conviene comprobar primero si la extensión no instala.
- `stxt-vscode/stxt/CHANGELOG.md` sigue siendo el changelog del *lenguaje* además del de la extensión, aunque ahora los cambios del lenguaje ocurren aquí.

## Comandos

```bash
npm run build   # tsc: src/**/*.ts -> out/**/*.js (+ .d.ts + sourcemaps)
npm run watch   # build in watch mode
npm run lint    # eslint src --ext .ts
npm test        # pretest (build + lint), then mocha over out/test/**/*.test.js
```

Consulta [help.txt](help.txt) para más detalles sobre cómo ejecutar las pruebas. Las pruebas son suites mocha `describe`/`it` bajo `src/test/*.test.ts` (compiladas junto con la biblioteca, no como un bundle aparte) que actúan como pruebas de regresión contra el corpus real del repositorio hermano `../stxt-web` — se saltan como "pending" en vez de fallar si ese hermano no está presente, y `STXT_WEB=/path` sobrescribe la búsqueda.

`tsconfig.json` tiene `strict` + `noEmitOnError`, así que los errores de tipos hacen fallar la compilación.

## Arquitectura

La tubería tiene dos etapas distintas: **parseo** (texto → árbol `Node`) y **validación** (árbol → conformidad con el esquema). Están desacopladas — el parseo nunca requiere un esquema.

### Etapa de parseo

[src/core/Parser.ts](src/core/Parser.ts) es el punto de entrada. `parse()` lanza en el primer error; `parseResult()` devuelve un `ParseResult` que acumula todos los errores + nodos. El algoritmo:

- Divide la entrada en líneas; cada línea → [LineParser.ts](src/core/LineParser.ts) `parseLine()` → un `Line` (nivel, contenido, banderas isComment/isBlock). **Indentación = un nivel por tabulación o por 4 espacios** (`Constants.TAB_SPACES`); un espaciado que no sea múltiplo de 4 o saltar más de un nivel de profundidad es un `ParseException`.
- Una **pila** sigue los nodos abiertos por nivel. Bajar a un nivel menos profundo cierra nodos mediante `closeToLevel()`, adjuntándolos a su padre o a la lista raíz del documento.
- Sintaxis de línea: `Name: value` (nodo inline), `Name >>` seguido de líneas con más indentación (nodo de texto/bloque — líneas recogidas con `addTextLine`), `# ...` (comentario).
- Los espacios de nombres se escriben entre paréntesis después del nombre — `Name (a.b.c): value` — y los analiza [NameNamespaceParser.ts](src/core/NameNamespaceParser.ts), que los pasa a minúsculas y **hereda el espacio de nombres del padre** cuando no se declara ninguno. [NamespaceValidator.ts](src/core/NamespaceValidator.ts) comprueba su forma.

`Node` ([src/core/Node.ts](src/core/Node.ts)) es el árbol de salida. Los nodos son mutables mientras se analiza (`addChild`/`addTextLine`) y **deben tratarse como solo lectura una vez cerrado el documento** — la inmutabilidad es por convención, no hay `Object.freeze` (el documento solía afirmar lo contrario). Los nombres se normalizan (`StringUtils.normalize`) para las búsquedas; `getQualifiedName()` = `namespace:name` (una clave interna de búsqueda, no la sintaxis fuente).

[NodeWriter.ts](src/runtime/NodeWriter.ts) hace el viaje inverso — serializa un `Node` (o una lista de documentos) de vuelta a texto STXT, con `IndentStyle.TABS` o `SPACES_4`.

### Observadores y validadores

`Parser` expone `registerObserver()` y `registerValidator()`. [Observer](src/processors/Observer.ts) recibe callbacks en streaming (`onCreate`, `onTextLine`, `onComment`, `onFinish`) durante el parseo. [Validator](src/processors/Validator.ts) se ejecuta en cada nodo cuando se cierra y devuelve `ValidationException[]` (acumuladas en el `ParseResult`). Este es el mecanismo de extensión — la validación del esquema no es más que un `Validator` integrado.

### Etapa de esquema

[Schema](src/schema/Schema.ts) contiene `NodeDefinition`s, cada una con `ChildDefinition`s (cardinalidad mínima/máxima) y un tipo. [SchemaValidator.ts](src/schema/SchemaValidator.ts) (un `Validator`) comprueba un nodo frente a su esquema: validación del tipo de valor + cardinalidad de hijos, opcionalmente de forma recursiva. [ConditionalValidator.ts](src/runtime/ConditionalValidator.ts) lo envuelve para que solo se validen los nodos con espacio de nombres.

Los **tipos** de valor viven en [src/schema/type/](src/schema/type/) (INLINE, BLOCK, TEXT, BOOLEAN, INTEGER, NATURAL, NUMBER, DATE, TIMESTAMP, EMAIL, URL, HEXADECIMAL, BASE64, GROUP, ENUM), y cada uno implementa la interfaz [Type](src/schema/Type.ts) (`validate` + `getName`). Se autorregistran en [TypeRegistry.ts](src/schema/TypeRegistry.ts) mediante un inicializador estático — **añade un tipo nuevo importándolo y registrándolo ahí** y exportándolo desde `all.ts`.

### Esquemas frente a plantillas (metaespacios de nombres)

Los propios esquemas se escriben en STXT. Dos espacios de nombres reservados controlan esto:

- `@stxt.schema` — un documento de definición de esquema.
- `@stxt.template` — un documento plantilla (una forma de autoría más amable) que se transforma en un esquema.

[UnifiedSchemaProvider](src/runtime/UnifiedSchemaProvider.ts) es el centro en tiempo de ejecución: `addFile(text)` analiza un documento, detecta el espacio de nombres raíz, lo valida contra el **metaesquema** correspondiente (`SchemaProviderMeta` / `MetaTemplateSchemaProvider`), luego lo transforma a un `Schema` (`transformNodeToSchema` en [SchemaParser.ts](src/schema/SchemaParser.ts) / `transformTemplateNodeToSchema` en [TemplateParser.ts](src/template/TemplateParser.ts)) y lo registra por espacio de nombres. `SchemaProvider` es la interfaz de consulta (`getSchema(namespace)`); `SchemaProviderMemory` es la implementación simple en memoria.

### Etapa de discovery (0.6.0)

Una tercera etapa se sitúa *antes* de la validación y responde a "qué esquemas se aplican a este documento": [src/discovery/](src/discovery/), la implementación de referencia de STXT-DISCOVERY-SPEC.

[DiscoveryResolver](src/discovery/DiscoveryResolver.ts) construye la cadena de resolución de un documento — cada `.stxt/` ascendiente, del más cercano al más lejano (el ascenso *no* se detiene en la primera coincidencia), luego el nivel de usuario, luego el nivel de sistema, salvo que `STXT_PATH` lo sustituya todo — carga cada definición de cada nivel y aplica precedencia **por espacio de nombres**: gana el nivel más cercano que defina un espacio de nombres, y los niveles posteriores siguen aportando los espacios que no define. Dos definiciones de un mismo espacio de nombres en el mismo nivel son un `DiscoveryError`, y ese espacio de nombres acaba sin *ninguna* definición activa (nunca una elección silenciosa).

Dos reglas de diseño importan al tocar esto:

- **No `node:fs` ni `process` en este paquete.** Todo acceso al host pasa por [DiscoveryFileSystem](src/discovery/DiscoveryFileSystem.ts) y [DiscoveryEnvironment](src/discovery/DiscoveryEnvironment.ts) inyectados; las rutas son cadenas opacas que el resolver nunca interpreta por su cuenta. Eso es lo que permite que `../stxt-cli` lo apoye con `node:fs`, la extensión con `vscode.workspace.fs` y las pruebas con un árbol en memoria.
- Los errores se **acumulan, no se lanzan** ([DiscoveryError](src/discovery/DiscoveryError.ts) es una clase simple, no una excepción): la especificación quiere que se informe de una definición mala sin detener la carga del resto.

[DiscoveryResult](src/discovery/DiscoveryResult.ts) implementa `SchemaProvider`, así que encaja directamente en un `SchemaValidator`/`ConditionalValidator`, y además informa del origen (`getDefinition()` → archivo + nivel) y de la cadena en sí. Los niveles se cachean por directorio entre documentos; llama a `clearCache()` cuando los archivos puedan haber cambiado.

### API pública

[src/all.ts](src/all.ts) es el barrel de entrada del paquete; `package.json` apunta con `main`/`types` a su `out/all.js`/`out/all.d.ts` compilado. Todo lo nuevo que deba ser utilizable por consumidores (por ejemplo, la extensión de VSCode) debe reexportarse desde ahí — consulta [El paquete npm](#el-paquete-npm-stxt-langcore) más arriba para ver la lista actual de exportaciones y lo que se deja deliberadamente fuera.

## Convenciones

- Los errores se lanzan como excepciones tipadas con una cadena de **código** de error: `ParseException`, `ValidationException`, `RuntimeException` (en [src/exceptions/](src/exceptions/)). Prefiere estos a `Error` en bruto y pasa un código estable.
- **Los comentarios fuente, el JSDoc y los mensajes están en inglés** en todo el repositorio desde 0.5.3 (antes estaban en español); mantén así el código nuevo. Cada miembro exportado lleva un comentario JSDoc con una frase resumen más `@param`/`@returns`/`@throws` — `tsc` lo copia a `out/**/*.d.ts`, que es lo que ven los consumidores al pasar el ratón, así que una exportación nueva sin JSDoc es una API sin documentar. La redacción se mantiene deliberadamente cerca del javadoc de `../stxt-java`, para que la misma clase se lea igual en ambas implementaciones.
