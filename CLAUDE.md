# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A TypeScript parser for **STXT**, an indentation-based structured-text format. The library is bundled (via Rollup) into a single browser-targeted ES module — there are no Node-only runtime APIs in `src/`, so keep it browser-safe.

This repo holds **only the implementation**. The normative language spec is **not** here: it lives in the sibling repo `../stxt-web` (canonical Spanish in `es/`, English mirror in `en/`):

- `../stxt-web/es/stxt-core-ref.stxt` — base syntax (STXT-SPEC): indentation, inline nodes, text blocks, namespaces, comments, normalization, error codes.
- `../stxt-web/es/stxt-schema-ref.stxt` — `@stxt.schema` (STXT-SCHEMA-SPEC): `Node`/`Children`/`Child`, types, cardinalities, plus the official meta-schema.
- `../stxt-web/es/stxt-template-ref.stxt` — `@stxt.template` (STXT-TEMPLATE-SPEC): the simplified authoring form compilable to a schema.

Consult those files before changing parser or schema semantics; behaviour changes here should follow the spec, not redefine it.

## Commands

```bash
npm run build              # Rollup bundles src/all.ts -> WebContent/js/stxt-parser.js (ES module + sourcemap)
npm run watch              # build in watch mode
npm run minify             # terser -> WebContent/js/stxt-parser.min.js (run after build)
npm run test               # runs src/test/hello.ts
npm run test <name>        # bundles src/test/<name>.ts and runs it with node (e.g. npm run test mytest)
```

There is no test framework. `run-test.js` bundles a single `src/test/<name>.ts` entry with `rollup.config.test.js` into `dist/<name>.js` and runs it with `node`; a "test" is a standalone script that exercises the public API (see [src/test/hello.ts](src/test/hello.ts)). To add one, drop a new `.ts` file in `src/test/` and run `npm run test <name>`.

TypeScript is compiled by `@rollup/plugin-typescript` during bundling; `tsconfig.json` has `strict` + `noEmitOnError`, so type errors fail the build. There is no separate `tsc` lint step.

## Architecture

The pipeline has two distinct stages: **parse** (text → `Node` tree) and **validate** (tree → schema conformance). They are decoupled — parsing never requires a schema.

### Parse stage

[src/core/Parser.ts](src/core/Parser.ts) is the entry point. `parse()` throws on the first error; `parseResult()` returns a `ParseResult` accumulating all errors + nodes. The algorithm:

- Split input into lines; each line → [LineParser.ts](src/core/LineParser.ts) `parseLine()` → a `Line` (level, content, isComment/isBlock flags). **Indentation = one level per tab or per 4 spaces** (`Constants.TAB_SPACES`); non-multiple-of-4 spacing or jumping more than one level deep is a `ParseException`.
- A **stack** tracks open nodes by level. Going to a shallower level closes (`freeze()`s) nodes via `closeToLevel()`, attaching them to their parent or to the root document list.
- Line syntax: `Name: value` (inline node), `Name >>` followed by deeper-indented lines (text/block node — lines collected with `addTextLine`), `# ...` (comment).
- Namespaces are written in parentheses after the name — `Name (a.b.c): value` — and parsed by [NameNamespaceParser.ts](src/core/NameNamespaceParser.ts), which lowercases them and **inherits the parent's namespace** when none is declared. [NamespaceValidator.ts](src/core/NamespaceValidator.ts) checks their shape.

`Node` ([src/core/Node.ts](src/core/Node.ts)) is the output tree. Nodes are **immutable once frozen** (`Object.freeze` on children/textLines) — `freeze()` happens when a node is closed, so never mutate a node after parsing. Names are normalized (`StringUtils.normalize`) for lookups; `getQualifiedName()` = `namespace:name` (an internal lookup key, not the source syntax).

[NodeWriter.ts](src/runtime/NodeWriter.ts) does the reverse trip — serializes a `Node` (or a document list) back to STXT text, with `IndentStyle.TABS` or `SPACES_4`.

### Observers & Validators

`Parser` exposes `registerObserver()` and `registerValidator()`. [Observer](src/processors/Observer.ts) gets streaming callbacks (`onCreate`, `onTextLine`, `onComment`, `onFinish`) during parsing. [Validator](src/processors/Validator.ts) runs on each node when it's closed and returns `ValidationException[]` (collected into the `ParseResult`). This is the extension mechanism — schema validation is just a built-in `Validator`.

### Schema stage

[Schema](src/schema/Schema.ts) holds `NodeDefinition`s, each with `ChildDefinition`s (min/max cardinality) and a type. [SchemaValidator.ts](src/schema/SchemaValidator.ts) (a `Validator`) checks a node against its schema: value type validation + child cardinality, optionally recursive. [ConditionalValidator.ts](src/runtime/ConditionalValidator.ts) wraps it so only namespaced nodes get validated.

Value **types** live in [src/schema/type/](src/schema/type/) (INLINE, BLOCK, TEXT, BOOLEAN, INTEGER, NATURAL, NUMBER, DATE, TIMESTAMP, EMAIL, URL, HEXADECIMAL, BASE64, GROUP, ENUM), each implementing the [Type](src/schema/Type.ts) interface (`validate` + `getName`). They self-register in [TypeRegistry.ts](src/schema/TypeRegistry.ts) via a static initializer — **add a new type by importing+registering it there** and exporting it from `all.ts`.

### Schemas vs. Templates (meta-namespaces)

Schemas themselves are written in STXT. Two reserved namespaces drive this:

- `@stxt.schema` — a schema definition document.
- `@stxt.template` — a template document (a friendlier authoring form) that gets transformed into a schema.

[UnifiedSchemaProvider](src/runtime/UnifiedSchemaProvider.ts) is the runtime hub: `addFile(text)` parses a document, detects the root namespace, validates it against the corresponding **meta-schema** (`SchemaProviderMeta` / `MetaTemplateSchemaProvider`), then transforms it to a `Schema` (`transformNodeToSchema` in [SchemaParser.ts](src/schema/SchemaParser.ts) / `transformTemplateNodeToSchema` in [TemplateParser.ts](src/template/TemplateParser.ts)) and registers it by namespace. `SchemaProvider` is the lookup interface (`getSchema(namespace)`); `SchemaProviderMemory` is the plain in-memory implementation.

### Public API

[src/all.ts](src/all.ts) is the Rollup entry barrel and the canonical list of exported API. Anything new that should be usable from the bundle must be re-exported here.

## Conventions

- Errors are thrown as typed exceptions carrying an error **code** string: `ParseException`, `ValidationException`, `RuntimeException` (in [src/exceptions/](src/exceptions/)). Prefer these over raw `Error` and pass a stable code.
- Source comments and many messages are in Spanish; match the surrounding language when editing a file.
