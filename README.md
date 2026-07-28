# @stxt-lang/core

Parser and schema validator for **STXT**, an indentation-based structured-text format.

STXT is a plain-text format for writing structured, semantic documents: no braces, no closing tags, just indentation. It is designed to be equally readable by humans and by machines, and it comes with an optional schema layer so documents can be validated.

- Website and language reference: <https://stxt.dev>
- VSCode extension: [STXT - Semantic Text](https://marketplace.visualstudio.com/items?itemName=stxt-lang.stxt)

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

Everything importable from the package: `Node`, `Parser`, `ParseResult`, `Line`, `Constants`, `parseLine`, `StringUtils`, `ParseException`, `ValidationException`, `Observer`, `Schema`, `SchemaValidator`, `SchemaProvider`, `NodeDefinition`, `ChildDefinition`, `transformNodeToSchema`, `UnifiedSchemaProvider`, `ConditionalValidator`, `NodeWriter`, `IndentStyle`, `transformTemplateNodeToSchema`.

## License

MIT — see [LICENSE](LICENSE).
