import * as assert from "assert";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { ParseException } from "../exceptions/ParseException";
import { LimitException } from "../exceptions/LimitException";
import { StreamObserver } from "../processors/StreamObserver";
import { Observer } from "../processors/Observer";
import { TextNode } from "../core/TextNode";
import { Line } from "../core/Line";

/** A document nesting the given number of levels (level 0 is the first), one node per level. */
function nested(levels: number): string {
	let content = "";
	for (let i = 0; i < levels; i++) {
		content += "\t".repeat(i) + "N" + i + ": v\n";
	}
	return content;
}

/** A StreamObserver that collects everything it is notified. */
class CollectingStreamObserver implements StreamObserver {
	roots: Node[] = [];
	errors: ParseException[] = [];

	onRootNode(node: Node): void {
		this.roots.push(node);
	}

	onError(error: ParseException): void {
		this.errors.push(error);
	}
}

describe("Parser limits (STXT-SPEC 11.2)", () => {

	it("Nesting deeper than the default 100 levels aborts with LIMIT_NESTING_EXCEEDED", () => {
		const result = new Parser().parseResult(nested(101));

		assert.strictEqual(result.getErrors().length, 1);
		const error = result.getErrors()[0];
		assert.ok(error instanceof LimitException);
		assert.strictEqual(error.code, "LIMIT_NESTING_EXCEEDED");
		assert.strictEqual(error.line, 101);
		// The abort leaves the open nodes unclosed: nothing is collected
		assert.strictEqual(result.getNodes().length, 0);
	});

	it("Nesting of exactly 100 levels parses under the defaults", () => {
		const result = new Parser().parseResult(nested(100));

		assert.strictEqual(result.getErrors().length, 0);
		assert.strictEqual(result.getNodes().length, 1);
	});

	it("maxNesting is configurable: level maxNesting - 1 parses, level maxNesting aborts", () => {
		assert.strictEqual(new Parser({ maxNesting: 3 }).parseResult(nested(3)).hasErrors(), false);

		const result = new Parser({ maxNesting: 3 }).parseResult(nested(4));
		assert.strictEqual(result.getErrors()[0].code, "LIMIT_NESTING_EXCEEDED");
		assert.strictEqual(result.getErrors()[0].line, 4);
	});

	it("maxNesting -1 disables the limit", () => {
		const result = new Parser({ maxNesting: -1, maxInputSize: -1 }).parseResult(nested(150));

		assert.strictEqual(result.getErrors().length, 0);
		assert.strictEqual(result.getNodes().length, 1);
	});

	it("A line longer than the default 10000 characters aborts with LIMIT_LINE_LENGTH_EXCEEDED", () => {
		const result = new Parser().parseResult("Name: " + "x".repeat(10000) + "\n");

		assert.strictEqual(result.getErrors().length, 1);
		assert.strictEqual(result.getErrors()[0].code, "LIMIT_LINE_LENGTH_EXCEEDED");
		assert.strictEqual(result.getErrors()[0].line, 1);
	});

	it("maxLineLength is configurable and the roots already closed stay collected", () => {
		const content = "First: one\nSecond: two\nThird: " + "x".repeat(50) + "\n";
		const result = new Parser({ maxLineLength: 20 }).parseResult(content);

		assert.strictEqual(result.getErrors().length, 1);
		assert.strictEqual(result.getErrors()[0].code, "LIMIT_LINE_LENGTH_EXCEEDED");
		assert.strictEqual(result.getErrors()[0].line, 3);
		// First closed when line 2 was processed; Second was still open at the abort,
		// because the limit is checked before the line that would have closed it
		assert.strictEqual(result.getNodes().length, 1);
		assert.strictEqual(result.getNodes()[0].getName(), "First");
	});

	it("An input larger than maxInputSize aborts with LIMIT_INPUT_SIZE_EXCEEDED", () => {
		const result = new Parser({ maxInputSize: 30 }).parseResult("A: 1\nB: 2\nC: 3\nD: 4\nE: 5\nF: 6\nG: 7\n");

		assert.strictEqual(result.getErrors().length, 1);
		assert.strictEqual(result.getErrors()[0].code, "LIMIT_INPUT_SIZE_EXCEEDED");
	});

	it("A limit error aborts multi-error collection: it is in every case the last error", () => {
		// A syntax error before the limit is collected; the invalid line after it is never seen
		const content = "bad line\nName: " + "x".repeat(50) + "\nalso bad\n";
		const result = new Parser({ maxLineLength: 20 }).parseResult(content);

		assert.strictEqual(result.getErrors().length, 2);
		assert.strictEqual(result.getErrors()[0].code, "INVALID_LINE");
		assert.strictEqual(result.getErrors()[1].code, "LIMIT_LINE_LENGTH_EXCEEDED");
	});

	it("parse() throws the limit error as a LimitException", () => {
		assert.throws(() => new Parser().parse(nested(101)), (e: unknown) => {
			return e instanceof LimitException && e.code === "LIMIT_NESTING_EXCEEDED";
		});
	});
});

describe("StreamObserver (every mode) and parseStream", () => {

	it("parseStream hands each completed root to onRootNode, with its subtree complete", () => {
		function* lines(): Generator<string> {
			yield "Entry: one";
			yield "\tDetail: a";
			yield "Entry: two";
			yield "\tDetail >>";
			yield "\t\ttext line";
		}

		const collector = new CollectingStreamObserver();
		const parser = new Parser();
		parser.registerStreamObserver(collector);
		parser.parseStream(lines());

		assert.strictEqual(collector.errors.length, 0);
		assert.strictEqual(collector.roots.length, 2);
		assert.strictEqual(collector.roots[0].getName(), "Entry");
		assert.strictEqual((collector.roots[0] as InlineNode).getChildren().length, 1);
		const detail = (collector.roots[1] as InlineNode).getChildren()[0] as TextNode;
		assert.deepStrictEqual(detail.getTextLines(), ["text line"]);
	});

	it("parseStream notifies errors by onError and keeps going, like parseResult", () => {
		const collector = new CollectingStreamObserver();
		const parser = new Parser();
		parser.registerStreamObserver(collector);
		parser.parseStream(["bad line", "Name: value"]);

		assert.strictEqual(collector.errors.length, 1);
		assert.strictEqual(collector.errors[0].code, "INVALID_LINE");
		assert.strictEqual(collector.roots.length, 1);
	});

	it("parseStream removes a BOM on the first line", () => {
		const collector = new CollectingStreamObserver();
		const parser = new Parser();
		parser.registerStreamObserver(collector);
		parser.parseStream(["\uFEFF" + "Name: value"]);

		assert.strictEqual(collector.errors.length, 0);
		assert.strictEqual(collector.roots[0].getName(), "Name");
	});

	it("parseStream stops consuming the input when a limit aborts", () => {
		let consumed = 0;
		function* endless(): Generator<string> {
			for (;;) {
				consumed++;
				yield "Entry: " + consumed;
			}
		}

		const collector = new CollectingStreamObserver();
		const parser = new Parser({ maxInputSize: 100 });
		parser.registerStreamObserver(collector);
		parser.parseStream(endless());

		assert.strictEqual(collector.errors.length, 1);
		assert.strictEqual(collector.errors[0].code, "LIMIT_INPUT_SIZE_EXCEEDED");
		assert.ok(consumed <= 12, "the endless input stopped being consumed: " + consumed);
	});

	it("A StreamObserver fires in parseResult too, with the same roots the result collects", () => {
		const collector = new CollectingStreamObserver();
		const parser = new Parser();
		parser.registerStreamObserver(collector);
		const result = parser.parseResult("One: 1\nbad line\nTwo: 2\n");

		assert.strictEqual(collector.roots.length, 2);
		assert.strictEqual(collector.roots[0], result.getNodes()[0]);
		assert.strictEqual(collector.roots[1], result.getNodes()[1]);
		assert.strictEqual(collector.errors.length, 1);
		assert.strictEqual(collector.errors[0], result.getErrors()[0]);
	});

	it("In fail-fast parse() a StreamObserver still sees every error before the throw", () => {
		const collector = new CollectingStreamObserver();
		const parser = new Parser();
		parser.registerStreamObserver(collector);

		assert.throws(() => parser.parse("bad one\nbad two\n"));
		assert.strictEqual(collector.errors.length, 2);
	});

	it("An Observer keeps firing in parseStream", () => {
		const created: string[] = [];
		const observer: Observer = {
			onCreate(node: Node): void { created.push(node.getName()); },
			onFinish(): void { /* not needed */ },
			onComment(): void { /* not needed */ },
			onTextLine(_node: TextNode, _lineNumber: number, _lineString: string, _line: Line): void { /* not needed */ },
		};

		const parser = new Parser();
		parser.registerObserver(observer);
		parser.parseStream(["Root: v", "\tChild: w"]);

		assert.deepStrictEqual(created, ["Root", "Child"]);
	});
});
