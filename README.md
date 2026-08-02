# @stxt-lang/core

Parser and schema validator for **STXT**, an indentation-based structured-text format.

STXT is a plain-text format for writing structured, semantic documents: no braces, no closing tags, just indentation. It is designed to be equally readable by humans and by machines, and it comes with an optional schema layer so documents can be validated.

- Website and language reference: <https://stxt.dev>
- VSCode extension: [STXT - Semantic Text](https://marketplace.visualstudio.com/items?itemName=stxt-lang.stxt)
- Java implementation: [`dev.stxt:stxt-core`](https://central.sonatype.com/artifact/dev.stxt/stxt-core) on Maven Central

## What STXT looks like

```stxt
# A line starting with '#' is a comment

Article (blog.post):
    Title: Getting started with STXT
    Author: Joan
    Published: 2026-07-28
    Tags:
        Tag: parser
        Tag: text-format
    Body >>
        Everything indented under a '>>' node is kept verbatim
        as a block of text lines.
```

- `Name: value` declares an **inline node**.
- `Name >>` opens a **text block**; every deeper-indented line belongs to it.
- Indentation is **one level per tab or per 4 spaces**.
- `Name (a.b.c):` attaches a **namespace** to a node; children inherit it unless they declare their own.

## Install

```bash
npm install @stxt-lang/core
```

The package ships CommonJS plus type declarations, so it works from both TypeScript and plain Node.

## Parsing

```ts
import { Parser, ParseResult, Node } from '@stxt-lang/core';

const text = [
    'Article (blog.post):',
    '\tTitle: Getting started with STXT',
    '\tAuthor: Joan',
].join('\n');

const parser = new Parser();

// parseResult() collects every error instead of stopping at the first one
const result: ParseResult = parser.parseResult(text);

if (result.hasErrors()) {
    for (const error of result.getErrors()) {
        console.error(`line ${error.line} [${error.code}]: ${error.message}`);
    }
}

const article: Node = result.getNodes()[0];

console.log(article.getName());                     // "Article"
console.log(article.getNamespace());                // "blog.post"
console.log(article.getChild('Title')?.getValue()); // "Getting started with STXT"
```

Use `parser.parse(text)` instead if you prefer an exception (`ParseException`) on the first error.

Nodes are **frozen once parsed** — treat the tree as immutable.

## Validating against a schema

Schemas are themselves STXT documents, written in the reserved `@stxt.schema` namespace (or in the friendlier `@stxt.template` form, which compiles to a schema). `UnifiedSchemaProvider` loads either kind, validates it against the corresponding meta-schema, and registers it by namespace.

```ts
import {
    Parser,
    UnifiedSchemaProvider,
    SchemaValidator,
    ConditionalValidator,
    ValidationException,
} from '@stxt-lang/core';

const schemaText = `
Schema (@stxt.schema): blog.post
\tNode: Article
\t\tChildren:
\t\t\tChild: Title
\t\t\t\tMin: 1
\t\t\t\tMax: 1
\t\t\tChild: Author
\t\t\t\tMin: 1
\tNode: Title
\tNode: Author
`;

const provider = new UnifiedSchemaProvider();
provider.addFile(schemaText);

const parser = new Parser();
// ConditionalValidator only validates nodes that carry a namespace
parser.registerValidator(new ConditionalValidator(new SchemaValidator(provider)));

const result = parser.parseResult(documentText);

for (const error of result.getErrors()) {
    // Schema problems are ValidationException; syntax problems are plain ParseException
    const severity = error instanceof ValidationException ? 'warning' : 'error';
    console.log(`${severity} at line ${error.line} [${error.code}]: ${error.message}`);
}
```

Available value types: `INLINE`, `BLOCK`, `TEXT`, `BOOLEAN`, `INTEGER`, `NATURAL`, `NUMBER`, `DATE`, `TIMESTAMP`, `EMAIL`, `URL`, `HEXADECIMAL`, `BASE64`, `GROUP`, `ENUM`.

## Finding the schemas: discovery

`UnifiedSchemaProvider` expects you to hand it the schema text. **Discovery** answers the previous question: *given this document, which schema definitions apply to it?* `DiscoveryResolver` is the reference implementation of the STXT discovery specification, so a command line, an editor and a build step all agree on the answer by construction.

Definitions live in `.stxt/` directories. For a given document the resolution chain is, highest precedence first:

1. every ancestor `.stxt/` directory, nearest first — the ascent does **not** stop at the first one, so in a monorepo both the subproject's and the repo root's participate;
2. the user level, `$HOME/.stxt` (`%USERPROFILE%\.stxt` on Windows);
3. the system level, `/etc/stxt` (`%ProgramData%\stxt` on Windows).

Precedence is **per namespace**: the nearest level that defines a namespace wins, and the rest of the chain still contributes the namespaces that level does not define. Defining one namespace twice at the same level is a resolution error, and leaves that namespace without an active definition. When `STXT_PATH` is defined it replaces the whole chain — useful in CI and tests.

The resolver never touches the file system or the environment itself: you inject a `DiscoveryFileSystem` and a `DiscoveryEnvironment`. That is what lets the same logic run over Node's `fs`, over an editor's virtual file system (`vscode.workspace.fs`) or over an in-memory tree in a test. Here are the Node adapters:

```ts
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import {
    DiscoveryEntry,
    DiscoveryEnvironment,
    DiscoveryFileSystem,
    DiscoveryResolver,
} from '@stxt-lang/core';

class NodeFileSystem implements DiscoveryFileSystem {
    async isDirectory(p: string): Promise<boolean> {
        try {
            return (await fs.stat(p)).isDirectory();
        } catch {
            return false; // not existing is the normal case, not an error
        }
    }
    async listDirectory(p: string): Promise<DiscoveryEntry[]> {
        const entries = await fs.readdir(p, { withFileTypes: true });
        return entries.map(entry => ({
            path: path.join(p, entry.name),
            name: entry.name,
            isDirectory: entry.isDirectory(),
        }));
    }
    readFile(p: string): Promise<string> {
        return fs.readFile(p, 'utf-8');
    }
    parentOf(p: string): string | null {
        const parent = path.dirname(p);
        return parent === p ? null : parent; // null at the file-system root
    }
    join(p: string, name: string): string {
        return path.join(p, name);
    }
}

class NodeEnvironment implements DiscoveryEnvironment {
    getStxtPath(): string[] | null {
        const value = process.env.STXT_PATH;
        // null (not defined) and [] (defined but empty) mean different things
        return value === undefined ? null : value.split(path.delimiter).filter(e => e !== '');
    }
    getUserLevelDir(): string | null {
        return path.join(os.homedir(), '.stxt');
    }
    getSystemLevelDir(): string | null {
        return '/etc/stxt';
    }
}
```

With those in place, resolving a document and validating it is two steps — and note that `DiscoveryResult` implements `SchemaProvider`, so it goes straight into the validator:

```ts
import { Parser, SchemaValidator, ConditionalValidator } from '@stxt-lang/core';

const resolver = new DiscoveryResolver(new NodeFileSystem(), new NodeEnvironment());

// The chain is per document: pass the directory the document lives in
// (null for stdin or an unsaved buffer, which starts the chain at the user level).
const result = await resolver.resolve('/repo/site/posts');

console.log(result.getChain());
// [ '/repo/site/.stxt', '/repo/.stxt' ]   ← both ancestors, nearest first

// Resolution errors are collected, never thrown: report them and carry on
for (const error of result.getErrors()) {
    console.error(`[${error.code}] ${error.message}`);
}

const parser = new Parser();
parser.registerValidator(new ConditionalValidator(new SchemaValidator(result)));

const parsed = parser.parseResult(documentText);
```

`DiscoveryResult` also tells you *where* a schema came from, which is what an editor needs for "go to definition" or a diagnostic that explains itself:

```ts
const definition = result.getDefinition('blog.post');

console.log(definition?.file);      // '/repo/site/.stxt/blog.stxt'
console.log(definition?.levelDir);  // '/repo/site/.stxt'  ← the level that won

result.getActiveDefinitions();      // one entry per namespace, precedence applied
result.getAllSchemas();             // just the schemas of the above
```

Levels are cached by directory, so resolving many documents that share ancestors reads each `.stxt/` once. Call `resolver.clearCache()` when the definition files may have changed — from a file watcher, for instance.

## Observing the parse

`Observer` receives streaming callbacks while the document is parsed — useful for syntax highlighting, indexes or any per-line bookkeeping.

```ts
import { Parser, Observer, Node, Line } from '@stxt-lang/core';

class LoggingObserver implements Observer {
    onCreate(node: Node, line: string): void {
        console.log('open', node.getQualifiedName());
    }
    onFinish(node: Node): void {
        console.log('close', node.getQualifiedName());
    }
    onComment(lineNumber: number, line: string): void { /* ... */ }
    onTextLine(node: Node, lineNumber: number, lineString: string, line: Line): void { /* ... */ }
}

const parser = new Parser();
parser.registerObserver(new LoggingObserver());
parser.parseResult(text);
```

## Writing STXT back out

```ts
import { NodeWriter, IndentStyle } from '@stxt-lang/core';

// A single node, or a whole document list
const text = NodeWriter.toSTXT(node, IndentStyle.TABS);
const doc = NodeWriter.toSTXTDocs(result.getNodes(), IndentStyle.SPACES_4);
```

## API surface

Everything importable from the package:

- **Parsing** — `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`
- **Exceptions** — `ParseException`, `ValidationException`
- **Extension points** — `Observer`
- **Schemas** — `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `transformNodeToSchema`, `transformTemplateNodeToSchema`
- **Runtime** — `UnifiedSchemaProvider`, `ConditionalValidator`, `NodeWriter`, `IndentStyle`
- **Discovery** — `DiscoveryResolver`, `DiscoveryOptions`, `DiscoveryResult`, `DiscoveryDefinition`, `DiscoveryLevel`, `DiscoveryError`, `DiscoveryFileSystem`, `DiscoveryEntry`, `DiscoveryEnvironment`

## License

MIT — see [LICENSE](LICENSE).
