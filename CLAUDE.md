# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A TypeScript parser for **STXT**, an indentation-based structured-text format. It compiles (via `tsc`) to a plain CommonJS Node package (`out/`), published to npm as **`@stxt-lang/core`** and consumed as a dependency — notably by the `../stxt-vscode/stxt` extension — rather than bundled into a browser artifact.

This repo holds **all the STXT parser/schema classes for the JS/TS ecosystem** — it is the single source of truth for that logic in this language, not just one consumer among several. The sibling repo `../stxt-vscode/stxt` (the VSCode extension) imports this project as a Node dependency and contains **only** extension-specific code (commands, language server glue, UI); it must not have its own copies of parser/schema classes. When extension work seems to need parser/schema changes, make them here and have the extension consume the updated dependency.

`../stxt-java` is the sibling implementation of the same language for the Java ecosystem — it should have equivalent behaviour to this repo (same parsing/validation semantics), just in a different language. When changing behaviour here, consider whether the Java port needs the same change.

The normative language spec is **not** in this repo: it lives in the sibling repo `../stxt-web` (canonical Spanish in `es/`, English mirror in `en/`), and that remains the single shared spec for all language implementations (this repo and `../stxt-java`):

- `../stxt-web/es/stxt-core-ref.stxt` — base syntax (STXT-SPEC): indentation, inline nodes, text blocks, namespaces, comments, normalization, error codes.
- `../stxt-web/es/stxt-schema-ref.stxt` — `@stxt.schema` (STXT-SCHEMA-SPEC): `Node`/`Children`/`Child`, types, cardinalities, plus the official meta-schema.
- `../stxt-web/es/stxt-template-ref.stxt` — `@stxt.template` (STXT-TEMPLATE-SPEC): the simplified authoring form compilable to a schema.

Consult those files before changing parser or schema semantics; behaviour changes here should follow the spec, not redefine it.

## Next up (as of 2026-07-28)

**Nothing is broken.** `@stxt-lang/core@0.5.1` was published on 2026-07-28 and verified end to end: the tarball straight from the registry loads all 25 schemas of `../stxt-web/.stxt` and parses+validates the 44 documents of its `docs/`, `es/` and `en/` with zero errors; `npm test` here is 224 passing; `../stxt-vscode/stxt` compiles, lints and packages a working `.vsix` against it.

What's left is **polishing the package's public face**, which was never done because 0.5.1 was the first release. Roughly in order of value:

1. **Write a `README.md`.** The npm page for `@stxt-lang/core` is currently blank (`readmeFilename: ""` in the registry metadata) — this is the most visible gap. It should cover: what STXT is (link to https://stxt.dev), install, and a minimal `Parser` + `UnifiedSchemaProvider`/`ConditionalValidator` example. Note `README.md` also has to be reachable by `files` (npm always includes it, so no change needed there).
2. **Add a `LICENSE` file and settle the license.** `package.json` says `ISC`, `../stxt-vscode/stxt` says `MIT`, and neither repo has a licence file. Pick one for the whole `stxt-lang` org and make them agree.
3. **Fill in `author` and `keywords`** in `package.json` (both empty today), so the package is findable on npm.
4. **Tag the release.** There is no `v0.5.1` tag; the publish recorded `gitHead` `a25e88e`. Worth tagging retroactively and making tagging part of the release routine.
5. **Decide what to do about the source maps.** `out/**/*.js.map` ships but `src/` doesn't, so every map dangles. Either add `src` to `files` or stop emitting maps for the published build.
6. **Regenerate `package-lock.json`.** It's a fossil from before the rename: `name: "stxt-parser-js"`, `version: "1.0.0"`, `lockfileVersion: 1`. Harmless for publishing, but misleading.
7. **Consider exporting `ValidationException` from `src/all.ts`.** `../stxt-vscode/stxt`'s `AnalysisDoc.ts` has to distinguish schema warnings from parse errors with `error.name === 'ValidationException'` (a string comparison) because the class isn't exported. It works today, but exporting the class would let it use `instanceof`. Doing this means a new release and a bump on the extension side.

Items 1–6 are packaging-only and can go out together as **0.5.2** without touching a line of `src/`. Item 7 is an API change and needs the extension updated in the same pass.

## The npm package: `@stxt-lang/core`

This repo is published to npm as **`@stxt-lang/core`** — first release **0.5.1 on 2026-07-28**. The name was chosen over `@stxt-lang/parser` / `@stxt-lang/js` because "core" leaves room for future sibling JS packages (a CLI, a language server) without competing for the "main" name. The GitHub org `stxt-lang` and the npm scope `@stxt-lang` are both reserved by the user (the org also hosts `stxt-vscode`, `stxt-java`, `stxt-web`, `stxt-python`, `stxt-cms`, `stxt-impl`).

Packaging facts worth knowing before touching `package.json`:

- `name` is `@stxt-lang/core` with `publishConfig.access: "public"` — required, since scoped packages default to private.
- `main`/`types` point at `out/all.js` / `out/all.d.ts`. **`src/all.ts` is the only public surface**: anything a consumer should be able to import has to be re-exported from there. It currently exports `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`, `ParseException`, `Observer`, `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `transformNodeToSchema`, `UnifiedSchemaProvider`, `ConditionalValidator`, `NodeWriter`, `IndentStyle`, `transformTemplateNodeToSchema`. Notably **not** exported: `ValidationException`, `TypeRegistry`, `RuntimeException`, `SchemaProviderMemory`.
- `"prepare": "npm run build"` regenerates `out/` on install, and `"files"` is scoped to `out/all.js`, `out/all.js.map`, `out/all.d.ts` plus the `core`/`exceptions`/`processors`/`runtime`/`schema`/`template` subfolders — deliberately excluding `out/test` (build output of this repo's own regression tests).

The published tarball is 169 files / 38 KB: `.js`, `.d.ts` and `.js.map` for the barrel plus the six subfolders. For the gaps it still has (no README, no LICENSE, empty `author`/`keywords`, dangling maps), see [Next up](#next-up-as-of-2026-07-28) above.

## How `../stxt-vscode/stxt` consumes this

The VSCode extension keeps **only** extension-specific code (10 files under `src/extension/` plus `src/extension.ts`) and depends on this package normally: `"dependencies": { "@stxt-lang/core": "^0.5.1" }`, resolved from the npm registry. It used to carry a duplicated copy of `core/`, `schema/`, `runtime/`, `processors/`, `exceptions/`, `template/` and `test/` (61 files) under its own `src/`; those were deleted with `git rm` when the split landed.

Consequences to keep in mind:

- The extension has **no `test` script** any more. This repo's `npm test` (224 tests against the `../stxt-web` corpus) is the only regression suite for the language, in either repo.
- A parser/schema fix therefore means: change it here → `npm test` → `npm publish` → bump the range in `stxt-vscode/stxt/package.json` → `npm install` there so the lock file records the new registry version.
- Watch out for `file:`/`npm link` leftovers: after the rename, the extension's committed `package-lock.json` still had `"resolved": "../../stxt-js", "link": true`, which made a clean `npm install` there fail (it tried to build this repo instead of downloading the tarball). Fixed on 2026-07-28, but it's the failure mode to check first if the extension won't install.
- `stxt-vscode/stxt/CHANGELOG.md` remains the changelog for the *language* as well as the extension, even though language changes now happen here.

## Commands

```bash
npm run build   # tsc: src/**/*.ts -> out/**/*.js (+ .d.ts + sourcemaps)
npm run watch   # build in watch mode
npm run lint    # eslint src --ext .ts
npm test        # pretest (build + lint), then mocha over out/test/**/*.test.js
```

See [help.txt](help.txt) for details on running tests. Tests are mocha `describe`/`it` suites under `src/test/*.test.ts` (compiled alongside the library, not a separate bundle) that run as regression checks against the real corpus in the sibling repo `../stxt-web` — they're skipped as "pending" rather than failing if that sibling isn't present, and `STXT_WEB=/path` overrides the lookup.

`tsconfig.json` has `strict` + `noEmitOnError`, so type errors fail the build.

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

[src/all.ts](src/all.ts) is the package's entry barrel; `package.json`'s `main`/`types` point at its compiled `out/all.js`/`out/all.d.ts`. Anything new that should be usable by consumers (e.g. the VSCode extension) must be re-exported from it — see [The npm package](#the-npm-package-stxt-langcore) above for the current export list and what's deliberately left out.

## Conventions

- Errors are thrown as typed exceptions carrying an error **code** string: `ParseException`, `ValidationException`, `RuntimeException` (in [src/exceptions/](src/exceptions/)). Prefer these over raw `Error` and pass a stable code.
- Source comments and many messages are in Spanish; match the surrounding language when editing a file.
