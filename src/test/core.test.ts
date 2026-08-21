import * as assert from "assert";
import { Parser } from "../core/Parser";
import { TextNode } from "../core/TextNode";
import { InlineNode } from "../core/InlineNode";

describe("Core conformance regressions", () => {
	it("accepts a decomposed Unicode name and gives it the NFC canonical name", () => {
		const node = new Parser().parse("Cafe\u0301: value\n")[0];

		assert.strictEqual(node.getName(), "Cafe\u0301");
		assert.strictEqual(node.getNormalizedName(), "café");
		assert.strictEqual(node.getNormalizedName(), new Parser().parse("Café: value\n")[0].getNormalizedName());
	});

	it("accepts combining marks (Mn, Mc) in names and still requires a letter or digit (spec 4.2)", () => {
		const [hindi, q] = new Parser().parse("\u0939\u093f\u0902\u0926\u0940: x\nQ\u0301: y\n");
		assert.strictEqual(hindi.getCanonicalName(), "\u0939\u093f\u0902\u0926\u0940");
		assert.strictEqual(q.getCanonicalName(), "q\u0301");

		const codes = (text: string) => new Parser().parseResult(text).getErrors().map(e => e.code);
		assert.deepStrictEqual(codes("\u0301: only a mark\n"), ["INVALID_NODE_NAME"]);
		assert.deepStrictEqual(codes("a\u20dd: enclosing mark\n"), ["INVALID_NODE_NAME"]);
	});

	it("closes a block with a comment at the level of the block node (spec 6.1 and 9.1)", () => {
		// A block is a literal: it cannot be commented from inside
		const root = new Parser().parse("Root:\n\tBody >>\n\t\tfirst\n\t\t# still text\n\t# closes the block\n\tAfter: sibling\n")[0] as InlineNode;
		const [body, after] = root.getChildren();

		assert.ok(body instanceof TextNode);
		assert.deepStrictEqual((body as TextNode).getTextLines(), ["first", "# still text"]);
		assert.strictEqual(after.getName(), "After");
		assert.strictEqual((after as InlineNode).getValue(), "sibling");
	});

	it("closes only the block with a shallower comment, not its ancestors", () => {
		const root = new Parser().parse("Root:\n\tBody >>\n\t\tline\n# root-level comment\n\tAfter: x\n")[0] as InlineNode;

		assert.deepStrictEqual(root.getChildren().map(c => c.getName()), ["Body", "After"]);
		assert.deepStrictEqual((root.getChildren()[0] as TextNode).getTextLines(), ["line"]);
	});

	it("fails on text that follows a closing comment instead of losing the comment silently", () => {
		const codes = (text: string) => new Parser().parseResult(text).getErrors().map(e => e.code);

		assert.deepStrictEqual(codes("Root:\n\tBody >>\n\t\tfirst\n\t# oops\n\t\tsecond\n"), ["INDENTATION_LEVEL_NOT_VALID"]);
		assert.deepStrictEqual(codes("Body >>\n\tfirst\n# oops\n\tsecond\n"), ["INVALID_LINE"]);
	});

	it("finishes the block before notifying the comment to the observers", () => {
		const events: string[] = [];
		const parser = new Parser();
		parser.registerObserver({
			onCreate: node => events.push("create " + node.getName()),
			onFinish: node => events.push("finish " + node.getName()),
			onComment: line => events.push("comment " + line),
			onTextLine: () => events.push("text"),
		});
		parser.parse("A: x\n\tT >>\n\t\tline\n\t# closes T\n\tB: y\n");

		assert.deepStrictEqual(events, ["create A", "create T", "text", "finish T", "comment 4", "create B", "finish B", "finish A"]);
	});
});

describe("Blanks are only U+0020 and U+0009 (STXT-SPEC 4)", () => {
	const codes = (text: string) => new Parser().parseResult(text).getErrors().map((e) => e.code);

	it("keeps an NBSP as part of an inline value and of block lines", () => {
		const root = new Parser().parse("Root:\n\tTrailing: Joan \n\tLeading: Joan\n\tOnly: \n\tBlock >>\n\t\tfirst \n\t\t \n\t\tin the middle\n")[0] as InlineNode;
		const [trailing, leading, only, block] = root.getChildren();
		assert.strictEqual((trailing as InlineNode).getValue(), "Joan ");
		assert.strictEqual((leading as InlineNode).getValue(), " Joan");
		assert.strictEqual((only as InlineNode).getValue(), " ");
		assert.deepStrictEqual([...(block as TextNode).getTextLines()], ["first ", " ", "in the middle"]);
	});

	it("does not treat a line holding only an NBSP as empty, nor one after >>", () => {
		assert.deepStrictEqual(codes(" \n"), ["INVALID_LINE"]);
		assert.deepStrictEqual(codes("Block >> \n"), ["INLINE_VALUE_NOT_VALID"]);
		assert.deepStrictEqual(codes("Root: x\n \t\n\n"), []);
	});

	it("does not trim an NBSP from a name, which makes the name invalid", () => {
		assert.deepStrictEqual(codes("Name : x\n"), ["INVALID_NODE_NAME"]);
		assert.deepStrictEqual(codes("A B: x\n"), ["INVALID_NODE_NAME"]);
		assert.strictEqual(new Parser().parse("Name \t: x\n")[0].getName(), "Name");
	});
});
