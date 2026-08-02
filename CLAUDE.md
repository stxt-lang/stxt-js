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
- `../stxt-web/es/stxt-discovery-ref.stxt` — schema discovery (STXT-DISCOVERY-SPEC, added 2026-08-02): `.stxt/` resolution directories, the per-document chain, per-namespace precedence, `STXT_PATH`, resolution errors.

Consult those files before changing parser or schema semantics; behaviour changes here should follow the spec, not redefine it.

## Next up (as of 2026-08-02)

**0.6.0 is implemented but NOT published yet**: the new `src/discovery/` module — `DiscoveryResolver`, `DiscoveryResult`, `DiscoveryError` and the injected `DiscoveryFileSystem`/`DiscoveryEnvironment` interfaces — is the reference implementation of **STXT-DISCOVERY-SPEC** (`../stxt-web/es/stxt-discovery-ref.stxt`, new fourth spec, 2026-08-02): resolution chain per document (every ancestor `.stxt/`, then user level, then system level, or the `STXT_PATH` override), per-namespace nearest-wins precedence, same-level duplicates as errors, level cache shared across documents. The resolver is host-agnostic on purpose — **no `node:fs`/`process` access in this package**; consumers inject adapters (`../stxt-cli` has the Node one, `../stxt-vscode/stxt` the `vscode.workspace.fs` one). `package.json` is already bumped to 0.6.0 with `out/discovery` added to `files`, all exports are in `all.ts` with JSDoc, and `npm test` is 252 passing (28 new in `src/test/discovery.test.ts`, spec-conformance over an in-memory file system). It all landed in commit `09b9259`, already pushed to `origin/master`; the README got its discovery section on 2026-08-02 (the snippets were run against `out/all.js` and typechecked in `strict` against the published `.d.ts`). `npm pack --dry-run` gives 125 files / 51.8 kB packed / 209.8 kB unpacked.

**Pending for 0.6.0**, in order:

1. `npm publish` + verify from the registry + annotated tag `v0.6.0` (steps 3-5 of [RELEASING.md](RELEASING.md)).
2. **Re-install in both consumers, which are in a fragile state**: `../stxt-vscode/stxt` and `../stxt-cli` both already declare `"@stxt-lang/core": "^0.6.0"` and both have 0.6.0 in `node_modules` — but installed from *a tarball in a `/tmp` scratchpad* (`node_modules/.package-lock.json` records `"resolved": "file:.../tmp/claude-1000/.../stxt-lang-core-0.6.0.tgz"`), while their committed `package-lock.json` still says 0.5.3 from the registry. It works today on this machine and breaks as soon as `/tmp` is cleaned. After publishing, a clean `npm install` in each is what makes the lock files honest again. This is the same class of failure as the old `npm link` leftovers.
3. The Java port (`../stxt-java` has no discovery yet).

Previous release: **`@stxt-lang/core@0.5.3` was published on 2026-07-31 and verified from the registry** (115 files, 173.7 kB unpacked, README + LICENSE in, no `.js.map`, no `out/test`, JSDoc travelling in the `.d.ts`). Commit `eb98af7`, annotated tag `v0.5.3` pushed. `npm test` is 224 passing.

It is the documentation release that realigns this repo with `dev.stxt:stxt-core` 0.5.3 (published from `../stxt-java` the same day): every source comment translated to English and a JSDoc comment on every exported member, which `tsc` copies into `out/**/*.d.ts` — the TypeScript counterpart of the javadoc Java publishes to javadoc.io. The only user-visible change is the `NOT_STXT_SCHEMA` message, now `Expected schema(...) but got ...` like Java's; the code is unchanged and the exports of `all.ts` are untouched.

The extension side of 0.5.3 is long done: `../stxt-vscode/stxt` has since shipped 0.5.4 and 0.5.5 (editor-layer releases — where schemas come from and when a document gets analysed — with core pinned at 0.5.3).

The release procedure itself is now written down in [RELEASING.md](RELEASING.md), mirroring `../stxt-java/RELEASING.md`. It was drafted while doing 0.5.3, so its numbers (115 files, 41.9 kB packed) are the real ones of that release.

0.5.2 (2026-07-28) closed the "polish the package's public face" list — README, LICENSE, npm metadata, tags, source maps, lock file — plus the `ValidationException` export. Both tags are in place and pushed: `v0.5.2` at `604477c` and `v0.5.1` retroactively at `a25e88e` (the `gitHead` the publish recorded). **Tagging is now part of the release routine**, and the tags here are annotated (`git tag -a -m "..."` — pass `-m` or git opens an editor).

Ideas for whenever there is a next release, none urgent:

- The npm README is the only doc that shows the API in use; keep its examples honest (they were all executed against `out/all.js` before shipping — the first draft had invented schema syntax and wrong `Observer`/`NodeWriter` signatures).
- `TypeRegistry`, `RuntimeException` and `SchemaProviderMemory` are still unexported. Export them only if a consumer actually needs them.
- `SchemaParser.transformNodeToSchema` still carries a defensive `(schChild as any).getNormalizedName?.()` with a `CHILD_DEFINITION_API_MISMATCH` branch, left over from the Java port: `ChildDefinition` does expose the method, so the branch is dead. Removing it is a behaviour-preserving cleanup, kept out of 0.5.3 because that release was documentation only.

## The npm package: `@stxt-lang/core`

The step-by-step release procedure lives in [RELEASING.md](RELEASING.md) (mirroring `../stxt-java/RELEASING.md`); this section is the *why* behind it.

This repo is published to npm as **`@stxt-lang/core`** — first release **0.5.1 on 2026-07-28**, **0.5.2 the same day**, **0.5.3 on 2026-07-31**; **0.6.0 is built and committed but not yet published**. The name was chosen over `@stxt-lang/parser` / `@stxt-lang/js` because "core" leaves room for future sibling JS packages without competing for the "main" name — a bet that paid off, since `../stxt-cli` now exists alongside it. The GitHub org `stxt-lang` and the npm scope `@stxt-lang` are both reserved by the user (the org also hosts `stxt-vscode`, `stxt-java`, `stxt-web`, `stxt-python`, `stxt-cms`, `stxt-impl`).

Packaging facts worth knowing before touching `package.json`:

- `name` is `@stxt-lang/core` with `publishConfig.access: "public"` — required, since scoped packages default to private.
- `main`/`types` point at `out/all.js` / `out/all.d.ts`. **`src/all.ts` is the only public surface**: anything a consumer should be able to import has to be re-exported from there. It currently exports `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`, `ParseException`, `ValidationException`, `Observer`, `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `transformNodeToSchema`, `UnifiedSchemaProvider`, `ConditionalValidator`, `NodeWriter`, `IndentStyle`, `transformTemplateNodeToSchema` and, since 0.6.0, `DiscoveryResolver`, `DiscoveryOptions`, `DiscoveryResult`, `DiscoveryDefinition`, `DiscoveryLevel`, `DiscoveryError`, `DiscoveryFileSystem`, `DiscoveryEntry`, `DiscoveryEnvironment`. Notably **not** exported: `TypeRegistry`, `RuntimeException`, `SchemaProviderMemory`.
- `"prepare": "npm run build"` regenerates `out/` on install, and `"files"` is scoped to `out/all.js`, `out/all.d.ts` plus the `core`/`discovery`/`exceptions`/`processors`/`runtime`/`schema`/`template` subfolders — deliberately excluding `out/test` (build output of this repo's own regression tests) and, via the `"!out/**/*.js.map"` negation, the source maps (they dangled, because `src/` isn't published). **A new subfolder under `src/` needs its `out/` counterpart added here**, or it silently ships missing — that is why `out/discovery` went in with 0.6.0.
- The licence is **MIT** across the `stxt-lang` org, copyright `stxt-lang`: `LICENSE` here, `LICENSE.txt` in `../stxt-vscode/stxt`. `package.json` said `ISC` until 0.5.2.

Tarball sizes, release by release: 0.5.1 was 169 files / 38 kB packed; 0.5.2 and 0.5.3 both 115 files, 27 kB and 41.9 kB packed (the difference is the JSDoc); 0.6.0 measures 125 files / 51.8 kB packed / 209.8 kB unpacked. The content is `.js` and `.d.ts` for the barrel plus the seven subfolders, plus `README.md` and `LICENSE`.

## How `../stxt-vscode/stxt` consumes this

The VSCode extension keeps **only** extension-specific code (10 files under `src/extension/` plus `src/extension.ts`) and depends on this package normally: `"dependencies": { "@stxt-lang/core": "^0.6.0" }`, resolved from the npm registry. It used to carry a duplicated copy of `core/`, `schema/`, `runtime/`, `processors/`, `exceptions/`, `template/` and `test/` (61 files) under its own `src/`; those were deleted with `git rm` when the split landed.

Versions moved in lockstep up to 0.5.3; they no longer do. The extension is on **0.5.5** — 0.5.4 and 0.5.5 were editor-layer releases with core unchanged at 0.5.3 — so read the two version numbers as independent from now on.

There is now a **second consumer**: `../stxt-cli` (version 0.1.0), which depends on `^0.6.0` too. It follows the same rule as the extension — no parser/schema classes of its own; its `src/discovery/NodeDiscovery.ts` is just the `node:fs` + `process.env` adapters for `DiscoveryResolver` plus a `createDiscoveryResolver()` factory. The whole point of discovery living here is that CLI and editor resolve schemas identically.

Consequences to keep in mind:

- The extension has **no `test` script** any more. This repo's `npm test` (252 tests against the `../stxt-web` corpus) is the only regression suite for the language, in either repo.
- A parser/schema fix therefore means: change it here → `npm test` → `npm publish` → bump the range in `stxt-vscode/stxt/package.json` **and `stxt-cli/package.json`** → `npm install` in each so the lock files record the new registry version.
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

### Discovery stage (0.6.0)

A third stage sits *before* validation and answers "which schemas apply to this document?": [src/discovery/](src/discovery/), the reference implementation of STXT-DISCOVERY-SPEC.

[DiscoveryResolver](src/discovery/DiscoveryResolver.ts) builds a document's resolution chain — every ancestor `.stxt/` nearest-first (the ascent does *not* stop at the first hit), then the user level, then the system level, unless `STXT_PATH` replaces the lot — loads every definition in every level, and applies **per-namespace** precedence: the nearest level defining a namespace wins, and further levels still contribute the namespaces it does not define. Two definitions of one namespace at the same level are a `DiscoveryError`, and that namespace ends up with *no* active definition (never a silent pick).

Two design rules matter when touching this:

- **No `node:fs` or `process` in this package.** All host access goes through the injected [DiscoveryFileSystem](src/discovery/DiscoveryFileSystem.ts) and [DiscoveryEnvironment](src/discovery/DiscoveryEnvironment.ts); paths are opaque strings the resolver never parses itself. That is what lets `../stxt-cli` back it with `node:fs`, the extension with `vscode.workspace.fs`, and the tests with an in-memory tree.
- Errors are **collected, not thrown** ([DiscoveryError](src/discovery/DiscoveryError.ts) is a plain class, not an exception): the spec wants a bad definition reported without stopping the rest from loading.

[DiscoveryResult](src/discovery/DiscoveryResult.ts) implements `SchemaProvider`, so it drops straight into a `SchemaValidator`/`ConditionalValidator`, and additionally reports provenance (`getDefinition()` → file + level) and the chain itself. Levels are cached by directory across documents; call `clearCache()` when files may have changed.

### Public API

[src/all.ts](src/all.ts) is the package's entry barrel; `package.json`'s `main`/`types` point at its compiled `out/all.js`/`out/all.d.ts`. Anything new that should be usable by consumers (e.g. the VSCode extension) must be re-exported from it — see [The npm package](#the-npm-package-stxt-langcore) above for the current export list and what's deliberately left out.

## Conventions

- Errors are thrown as typed exceptions carrying an error **code** string: `ParseException`, `ValidationException`, `RuntimeException` (in [src/exceptions/](src/exceptions/)). Prefer these over raw `Error` and pass a stable code.
- **Source comments, JSDoc and messages are in English** across the whole repo since 0.5.3 (they used to be in Spanish); keep new code that way. Every exported member carries a JSDoc comment with a summary sentence plus `@param`/`@returns`/`@throws` — `tsc` copies it into `out/**/*.d.ts`, which is what consumers see on hover, so a new export without JSDoc is an undocumented API. The wording is kept deliberately close to the javadoc of `../stxt-java`, so that the same class reads the same in both implementations.
