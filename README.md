# @stxt-lang/core

Parser and schema validator for **STXT**, in TypeScript.

STXT is a **Human-First** language, designed for documents and structured data: indentation is
the structure, free text is literal, and schemas are written in STXT itself.

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

- `Name: value` is an **inline node**.
- `Name >>` opens a **text block**. Every deeper-indented line belongs to it.
- Indentation is **one level per tab or per 4 spaces**.
- `Name (a.b.c):` attaches a **namespace** to a node. Children inherit it unless they declare their own.

Links:

- The language: <https://stxt.dev>
- The full guide of this library: <https://stxt.dev/tools-typescript>
- The other implementations: [`dev.stxt:stxt-core`](https://central.sonatype.com/artifact/dev.stxt/stxt-core) (Java) and [`stxt`](https://pypi.org/project/stxt/) (Python)
- The tools built on it: the [`stxt` command](https://www.npmjs.com/package/@stxt-lang/cli), the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=stxt-lang.stxt) and the [playground](https://play.stxt.dev)

## Install

```bash
npm install @stxt-lang/core
```

The package ships CommonJS with type declarations, and works from TypeScript and from plain Node. It has no runtime dependencies.

## Parsing

```ts
import { Parser, ParseResult, Node, InlineNode } from '@stxt-lang/core';

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

console.log(article.getName());       // "Article"
console.log(article.getNamespace());  // "blog.post"
if (article instanceof InlineNode) {
    console.log(article.getChild('Title')?.getText()); // "Getting started with STXT"
}
```

| Entry point | Behaviour |
|---|---|
| `parseResult(text)` | Collects every error, and also returns the nodes it managed to build |
| `parse(text)` | Throws a `ParseException` on the first error |
| `parseStream(lines)` | Retains no nodes or errors (see *Observing the parse*) |

## Working with the tree

`Node` is an abstract class with two forms:

| Class | Syntax | What it has |
|---|---|---|
| `InlineNode` | `Name: value` | The optional value, the children and the child lookups: `getChildren()`, `getChild(name)`, `getChildrenByName(name)` |
| `TextNode` | `Name >>` | The literal text lines |

Both share what is in `Node`: the name and the canonical name, the declared and the effective
namespace, the source line, the parent (always an `InlineNode`) and `getText()`.
The form of a node is told apart with `instanceof`.

Trees are mutable, and every node knows its parent:

```ts
import { InlineNode, TextNode, Node } from '@stxt-lang/core';

const email = new InlineNode('Email', 'com.example.docs', 'Weekly report');
email.addInlineNode('From', 'ana@example.com');
const to = email.addInlineNode('To');
to.addInlineNode('Address', 'bob@example.com');
const body = email.addTextNode('Body', 'Hi Bob,\n\nSee attached.');

body.getParent() === email;   // true
body.getLevel();              // 1
to.getNamespace();            // "com.example.docs", inherited
to.getDeclaredNamespace();    // "": it declares none

// Reorganise: move "To" to the front
to.detach();
email.addChild(to, 0);

// Edit in place
email.setNamespace('com.example.mail');   // the whole inheriting subtree follows
body.setText('Hi Bob,\n\nSee the new attachment.');

for (const child of email.getChildren()) {
    if (child instanceof InlineNode) { console.log(child.getValue(), child.getChildren().length); }
    if (child instanceof TextNode)   { console.log(child.getTextLines()); }
}
```

- In the overloads with two strings, the second one is the *content* (value or text). The namespace only appears in the three-argument forms.
- Adding a node that already has a parent throws `NODE_ALREADY_ATTACHED`. Adding an ancestor throws `NODE_CYCLE`.
- The level is derived from the chain of parents. The source line is only set by the parser.

## Validating against a schema

Schemas are STXT documents, written in the `@stxt.schema` namespace, or in the shorter
`@stxt.template` form, which compiles to a schema. `UnifiedSchemaProvider` loads both kinds,
validates them against their meta-schema, and registers them by namespace.

```ts
import {
    Parser,
    UnifiedSchemaProvider,
    SchemaValidator,
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
// Only nodes that carry a namespace are validated; free nodes pass through
parser.registerValidator(new SchemaValidator(provider));

const result = parser.parseResult(documentText);

for (const error of result.getErrors()) {
    // Schema problems are ValidationException; syntax problems are plain ParseException
    const severity = error instanceof ValidationException ? 'warning' : 'error';
    console.log(`${severity} at line ${error.line} [${error.code}]: ${error.message}`);
}
```

The value types are those of [STXT-SCHEMA-SPEC §9](https://stxt.dev/stxt-schema-ref#s9): `INLINE`, `BLOCK`, `TEXT`, `MARKDOWN`, `BOOLEAN`, `INTEGER`, `NATURAL`, `NUMBER`, `DATE`, `TIME`, `TIMESTAMP`, `UUID`, `EMAIL`, `URL`, `HEXADECIMAL`, `BINARY`, `BASE64`, `GROUP`, `ENUM`.

## Finding the schemas: discovery

`UnifiedSchemaProvider` receives the schema text. **Discovery** answers the previous question:
given this document, which definitions apply to it? `DiscoveryResolver` implements
STXT-DISCOVERY-SPEC, and it is the resolver of the command line and of the VS Code extension.

Definitions live in `.stxt/` directories. For a document, the resolution chain is, highest
precedence first:

1. Every ancestor `.stxt/` directory, nearest first. The ascent does **not** stop at the first
   one: in a monorepo, the subproject's and the repository root's both take part.
2. The user level, `$HOME/.stxt` (`%USERPROFILE%\.stxt` on Windows).
3. The system level, `/etc/stxt` (`%ProgramData%\stxt` on Windows).

The rules:

- Precedence is **per namespace**. The nearest level that defines a namespace wins, and the rest
  of the chain still provides the namespaces that level does not define.
- Two definitions of one namespace at the same level are a resolution error, and that namespace
  has no active definition.
- When `STXT_PATH` is defined it replaces the whole chain, which is useful in CI and in tests.

The resolver never touches the file system or the environment. It receives a
`DiscoveryFileSystem` and a `DiscoveryEnvironment`, so the same logic runs over Node's `fs`,
over an editor's virtual file system (`vscode.workspace.fs`) or over an in-memory tree in a
test. The adapters for Node:

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

`DiscoveryResult` implements `SchemaProvider`, so it goes straight into the validator:

```ts
import { Parser, SchemaValidator } from '@stxt-lang/core';

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
parser.registerValidator(new SchemaValidator(result));

const parsed = parser.parseResult(documentText);
```

`DiscoveryResult` also records where each definition came from, which is what an editor needs for "go to definition":

```ts
const definition = result.getDefinition('blog.post');

console.log(definition?.file);      // '/repo/site/.stxt/blog.stxt'
console.log(definition?.levelDir);  // '/repo/site/.stxt'  ← the level that won

result.getActiveDefinitions();      // one entry per namespace, precedence applied
result.getAllSchemas();             // just the schemas of the above
```

Levels are cached by directory, so each `.stxt/` is read once. `resolver.clearCache()` invalidates the cache when the definition files may have changed.

## Observing the parse

An `Observer` receives calls while the document is parsed. It is useful for syntax highlighting or for indexes.

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

A `StreamObserver` receives the results: each completed root node and each error. With
`parseStream` the parser retains no nodes or errors, so a file larger than memory can be
processed one root tree at a time:

```ts
import { Parser, StreamObserver, Node, ParseException } from '@stxt-lang/core';

const parser = new Parser();
parser.registerStreamObserver({
    onRootNode(node: Node): void { handle(node); },       // one complete root at a time
    onError(error: ParseException): void { report(error); },
} satisfies StreamObserver);
parser.parseStream(readLinesLazily(file));  // any Iterable<string> of lines
```

## Parser limits

The parser applies three limits by default (STXT-SPEC §11.2):

| Limit | Default | Error code |
|---|---|---|
| Nesting depth | 100 levels | `LIMIT_NESTING_EXCEEDED` |
| Line length | 10 000 characters | `LIMIT_LINE_LENGTH_EXCEEDED` |
| Input size | 10 000 000 characters | `LIMIT_INPUT_SIZE_EXCEEDED` |

A limit error is a `LimitException`, and it aborts the parse: it is always the last error
reported. Each limit is configurable per parser, and `-1` disables it:

```ts
const parser = new Parser({ maxNesting: 500, maxInputSize: -1 });
```

## Writing STXT back out

```ts
import { NodeWriter, IndentStyle } from '@stxt-lang/core';

// A single node, or a whole document list
const text = NodeWriter.toSTXT(node, IndentStyle.TABS);
const doc = NodeWriter.toSTXTDocs(result.getNodes(), IndentStyle.SPACES_4);
```

`NodeWriter` writes the tree, so comments and blank lines are lost.

`Formatter` reformats a document **keeping the comments and the blank lines**. It rewrites the
original text line by line, and returns the text together with the syntax errors it found. It is
the formatter of `stxt format`, the VS Code extension and the playground.

```ts
import { Formatter, IndentStyle } from '@stxt-lang/core';

const { text, errors } = Formatter.format(source, IndentStyle.TABS);
if (errors.length === 0) {
  fs.writeFileSync(file, text);
}
```

Formatting parses the document, so `Formatter.format` takes the limits of the parser as an
optional third argument: `Formatter.format(source, IndentStyle.TABS, { maxInputSize: -1 })`.

## API surface

Everything importable from the package:

- **Parsing**: `Node`, `InlineNode`, `TextNode`, `Parser`, `ParserOptions`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`
- **Exceptions**: `ParseException`, `ValidationException`, `LimitException`, `RuntimeException`
- **Extension points**: `Observer`, `StreamObserver`, `Validator`
- **Schemas**: `Schema`, `SchemaValidator`, `SchemaProvider`, `SchemaProviderMemory`, `SchemaProviderMeta`, `NodeDefinition`, `ChildDefinition`, `TypeRegistry`, `Type`, `transformNodeToSchema`
- **Templates**: `transformTemplateNodeToSchema`, `TEMPLATE_NAMESPACE`, `TemplateSchemaProviderMemory`, `MetaTemplateSchemaProvider`
- **Runtime**: `UnifiedSchemaProvider`, `NodeWriter`, `IndentStyle`, `Formatter`, `FormatResult`, `toCanonicalTree`, `toCanonicalJson`
- **Discovery**: `DiscoveryResolver`, `DiscoveryOptions`, `DiscoveryResult`, `DiscoveryDefinition`, `DiscoveryLevel`, `DiscoveryError`, `DiscoveryFileSystem`, `DiscoveryEntry`, `DiscoveryEnvironment`

## Conformance

`@stxt-lang/core` implements the five STXT specifications, and passes every case of the
[conformance kit](https://github.com/stxt-lang/stxt-lang/tree/master/conformance) in all its
profiles: `core`, `schema`, `template`, `discovery` and `text`. It is the same kit the other
implementations run.

`SPEC_VERSION` is the date of the STXT-SPEC text the package implements. The package version is
independent, and follows semver. The specifications carry a date and a status, not a version
number: see <https://stxt.dev/stability>.

## License

MIT, see [LICENSE](LICENSE).
