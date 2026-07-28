# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A TypeScript parser for **STXT**, an indentation-based structured-text format. It compiles (via `tsc`) to a plain CommonJS Node package (`out/`) meant to be consumed as a dependency — notably by the `../stxt-vscode/stxt` extension — rather than bundled into a browser artifact.

This repo holds **all the STXT parser/schema classes for the JS/TS ecosystem** — it is the single source of truth for that logic in this language, not just one consumer among several. The sibling repo `../stxt-vscode/stxt` (the VSCode extension) imports this project as a Node dependency and contains **only** extension-specific code (commands, language server glue, UI); it must not have its own copies of parser/schema classes. When extension work seems to need parser/schema changes, make them here and have the extension consume the updated dependency.

`../stxt-java` is the sibling implementation of the same language for the Java ecosystem — it should have equivalent behaviour to this repo (same parsing/validation semantics), just in a different language. When changing behaviour here, consider whether the Java port needs the same change.

The normative language spec is **not** in this repo: it lives in the sibling repo `../stxt-web` (canonical Spanish in `es/`, English mirror in `en/`), and that remains the single shared spec for all language implementations (this repo and `../stxt-java`):

- `../stxt-web/es/stxt-core-ref.stxt` — base syntax (STXT-SPEC): indentation, inline nodes, text blocks, namespaces, comments, normalization, error codes.
- `../stxt-web/es/stxt-schema-ref.stxt` — `@stxt.schema` (STXT-SCHEMA-SPEC): `Node`/`Children`/`Child`, types, cardinalities, plus the official meta-schema.
- `../stxt-web/es/stxt-template-ref.stxt` — `@stxt.template` (STXT-TEMPLATE-SPEC): the simplified authoring form compilable to a schema.

Consult those files before changing parser or schema semantics; behaviour changes here should follow the spec, not redefine it.

## Roadmap: stxt-vscode consuming this as an npm dependency (not started — decide in a future session)

The stated goal (see Project) is for `../stxt-vscode/stxt` to stop keeping its own copy of the parser/schema classes and instead `npm`-depend on this repo. As of this writing that hasn't happened yet — `../stxt-vscode/stxt/src` still has a full duplicate of `core/`, `schema/`, `runtime/`, `processors/`, `exceptions/`, `template/`, `test/` (54 files). A full diff confirmed every one of those files is byte-identical to this repo except one cosmetic line in `test/corpus.ts` (a path-depth constant) — so the two copies have **not diverged**, and consolidating later carries no risk of silently dropping a fix that only landed on one side.

Three gaps block extraction, all on this repo's side:

1. **`src/all.ts` does not exist**, despite `package.json` already pointing `main`/`types` at `out/all.js`/`out/all.d.ts` (see "Public API" below) — those fields currently reference a file `tsc` never produces. Needs to be created, exporting at least: `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`, `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `UnifiedSchemaProvider`, `ConditionalValidator`, `Observer`, `NodeWriter`, `IndentStyle`, `ParseException`, `transformNodeToSchema`, `transformTemplateNodeToSchema` — this list was derived from what `../stxt-vscode/stxt`'s extension-only files (`AnalysisDoc.ts`, `AnalysisResult.ts`, `CompletionProvider.ts`, `CompletionProviderSearch.ts`, `FormattingProvider.ts`, `SchemaLoader.ts`, `TokenGeneratorObserver.ts`) actually import today from their local copy.
2. **No `"prepare"` script.** `out/` is git-ignored and not committed, so installing this package as a `file:`/git dependency needs `"prepare": "npm run build"` to regenerate it on install.
3. **No `"files"` field / `.npmignore`**, so a packaged/`file:`-installed copy would ship more than `out/`.

Planned sequence once this is picked up: (1) add `src/all.ts`; (2) add `prepare` + `files` to `package.json`; (3) confirm build+tests still pass; (4) in `stxt-vscode/stxt/package.json` add `"stxt-parser-js": "file:../stxt-js"`; (5) rewrite the 7 extension files above to import from `"stxt-parser-js"` instead of relative paths; (6) delete the duplicated folders under `stxt-vscode/stxt/src`.

Open decisions, still to make:

- **Distribution mechanism.** `file:../stxt-js` is enough while both repos live as sibling folders on one machine. It won't work once this needs to build outside that machine (CI, another developer) — at that point this should move to a real package registry instead.
- **Public repo / package naming.** The intent is to eventually open-source this (and `stxt-vscode`) under a public GitHub org — first choice `stxt-lang` (already the placeholder in `package.json`'s `repository.url`), falling back to the shorter `stxt` if that name/org is available. That decision also determines the eventual published npm package name — `stxt-parser-js` is just a placeholder from before publishing was on the table.

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

`src/all.ts` is meant to be the package's entry barrel — `package.json`'s `main`/`types` already point at its compiled `out/all.js`/`out/all.d.ts` — but **the file doesn't exist yet** (see Roadmap above). Once created, anything new that should be usable by consumers (e.g. the VSCode extension) must be re-exported from it.

## Conventions

- Errors are thrown as typed exceptions carrying an error **code** string: `ParseException`, `ValidationException`, `RuntimeException` (in [src/exceptions/](src/exceptions/)). Prefer these over raw `Error` and pass a stable code.
- Source comments and many messages are in Spanish; match the surrounding language when editing a file.
