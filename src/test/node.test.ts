import * as assert from "assert";
import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { TextNode } from "../core/TextNode";
import { Parser } from "../core/Parser";
import { ParseException } from "../exceptions/ParseException";
import { RuntimeException } from "../exceptions/RuntimeException";
import { NodeWriter } from "../runtime/NodeWriter";
import { toCanonicalJson } from "../runtime/TreeJson";

/**
 * The 0.7.0 node model: two forms, each owning only what is its own; parent links with
 * integrity; derived level; declared vs effective namespace; mutability. Mirrors NodeTest of the
 * Java port.
 */
describe("Node model (0.7.0)", () => {

	// ---------------------------------------------------------------- forms

	it("two forms with their own content", () => {
		const inline = new InlineNode("Title", "  Hello  ");
		const text = new TextNode("Body", "line 1\nline 2");

		assert.strictEqual(inline.isTextNode(), false);
		assert.strictEqual(inline.getValue(), "Hello");
		assert.strictEqual(inline.getText(), "Hello");

		assert.strictEqual(text.isTextNode(), true);
		assert.deepStrictEqual([...text.getTextLines()], ["line 1", "line 2"]);
		assert.strictEqual(text.getText(), "line 1\nline 2");
	});

	it("each form owns only what is really its own", () => {
		// Children and lookups live in InlineNode; text lines in TextNode; nothing of that in Node
		const base = Node.prototype as unknown as Record<string, unknown>;
		assert.strictEqual(base["getChildren"], undefined);
		assert.strictEqual(base["getChild"], undefined);
		assert.strictEqual(base["getValue"], undefined);
		assert.strictEqual(base["getTextLines"], undefined);
		assert.strictEqual((TextNode.prototype as unknown as Record<string, unknown>)["getChildren"], undefined);

		// Walking a tree asks for the form
		const root = new InlineNode("Doc");
		root.addTextNode("Text", "t");
		root.addInlineNode("Inline");
		let inline = 0, text = 0;
		for (const child of root.getChildren()) {
			if (child instanceof InlineNode) { inline++; }
			if (child instanceof TextNode) { text++; }
		}
		assert.strictEqual(inline, 1);
		assert.strictEqual(text, 1);
	});

	it("a text node splits at LF and CRLF and keeps a trailing empty line", () => {
		const text = new TextNode("Body", "a\r\nb\n");
		assert.deepStrictEqual([...text.getTextLines()], ["a", "b", ""]);

		text.setText("x");
		assert.deepStrictEqual([...text.getTextLines()], ["x"]);
		text.addTextLine("y");
		text.setTextLines(["p", "q"]);
		assert.strictEqual(text.getText(), "p\nq");
		text.clearText();
		assert.strictEqual(text.getText(), "");

		assert.deepStrictEqual([...new TextNode("T", ["l1", "l2"]).getTextLines()], ["l1", "l2"]);
	});

	// ---------------------------------------------------------------- parent links

	it("addChild links both ends and derives the level", () => {
		const root = new InlineNode("Doc");
		const child = root.addInlineNode("Child", "v");
		const grandchild = child.addTextNode("Text", "t");

		assert.strictEqual(child.getParent(), root);
		assert.strictEqual(grandchild.getParent(), child);
		assert.strictEqual(root.getParent(), null);
		assert.strictEqual(root.getLevel(), 0);
		assert.strictEqual(child.getLevel(), 1);
		assert.strictEqual(grandchild.getLevel(), 2);
		assert.deepStrictEqual([...root.getChildren()], [child]);
	});

	it("a node cannot have two parents", () => {
		const a = new InlineNode("A");
		const b = new InlineNode("B");
		const child = a.addInlineNode("Child");

		assert.throws(() => b.addChild(child), (e: unknown) => e instanceof RuntimeException && e.code === "NODE_ALREADY_ATTACHED");
		assert.strictEqual(child.getParent(), a, "the failed add changes nothing");
		assert.strictEqual(b.getChildren().length, 0);
	});

	it("removeChild and detach unlink both ends", () => {
		const a = new InlineNode("A");
		const b = new InlineNode("B");
		const child = a.addInlineNode("Child");

		assert.strictEqual(a.removeChild(child), true);
		assert.strictEqual(child.getParent(), null);
		assert.strictEqual(a.getChildren().length, 0);
		assert.strictEqual(a.removeChild(child), false, "not a child any more");
		assert.strictEqual(b.removeChild(child), false, "never was a child of b");

		b.addChild(child);
		assert.strictEqual(child.getParent(), b);
		assert.strictEqual(child.detach(), true);
		assert.strictEqual(child.getParent(), null);
		assert.strictEqual(child.detach(), false, "already a root");
	});

	it("removeChild uses identity, not equality", () => {
		const root = new InlineNode("Doc");
		const first = root.addInlineNode("Item", "same");
		const second = root.addInlineNode("Item", "same");

		assert.strictEqual(root.removeChild(second), true);
		assert.deepStrictEqual([...root.getChildren()], [first]);
		assert.strictEqual(first.getParent(), root);
	});

	it("addChild at an index, and reorder", () => {
		const root = new InlineNode("Doc");
		const a = root.addInlineNode("A");
		const c = root.addInlineNode("C");
		const b = new InlineNode("B");
		root.addChild(b, 1);
		assert.deepStrictEqual([...root.getChildren()], [a, b, c]);

		// Move C to the front: detach, then insert
		c.detach();
		root.addChild(c, 0);
		assert.deepStrictEqual([...root.getChildren()], [c, a, b]);

		assert.throws(() => root.addChild(new InlineNode("X"), 7), RangeError);
	});

	it("cycles are rejected", () => {
		const root = new InlineNode("Doc");
		const child = root.addInlineNode("Child");
		const grandchild = child.addInlineNode("Grandchild");

		assert.throws(() => root.addChild(root), (e: unknown) => e instanceof RuntimeException && e.code === "NODE_CYCLE");
		assert.throws(() => grandchild.addChild(root), (e: unknown) => e instanceof RuntimeException && e.code === "NODE_CYCLE");
	});

	// ---------------------------------------------------------------- namespaces

	it("the effective namespace is inherited through the parent chain", () => {
		const root = new InlineNode("Doc", "com.example.docs", "x");
		const child = root.addInlineNode("Child");
		const text = child.addTextNode("Text", "t");
		const other = root.addInlineNode("Other", "org.other.ns", null);

		assert.strictEqual(root.getDeclaredNamespace(), "com.example.docs");
		assert.strictEqual(child.getDeclaredNamespace(), "");
		assert.strictEqual(child.getNamespace(), "com.example.docs");
		assert.strictEqual(text.getNamespace(), "com.example.docs");
		assert.strictEqual(other.getNamespace(), "org.other.ns");
		assert.strictEqual(child.getQualifiedName(), "com.example.docs:child");
	});

	it("changing a declared namespace changes the whole inheriting subtree", () => {
		const root = new InlineNode("Doc", "com.example.docs", "x");
		const child = root.addInlineNode("Child");
		const own = root.addInlineNode("Own", "org.other.ns", null);

		root.setNamespace("com.example.v2");
		assert.strictEqual(child.getNamespace(), "com.example.v2");
		assert.strictEqual(own.getNamespace(), "org.other.ns", "a declared namespace is not affected");

		root.setNamespace(null);
		assert.strictEqual(root.getNamespace(), "");
		assert.strictEqual(child.getNamespace(), "");
	});

	it("moving a subtree inherits the new parent's namespace, and detaching loses it", () => {
		const a = new InlineNode("A", "com.a.ns", null);
		const b = new InlineNode("B", "com.b.ns", null);
		const child = a.addInlineNode("Child");
		assert.strictEqual(child.getNamespace(), "com.a.ns");

		child.detach();
		assert.strictEqual(child.getNamespace(), "");

		b.addChild(child);
		assert.strictEqual(child.getNamespace(), "com.b.ns");
	});

	it("the namespace is lower-cased and validated", () => {
		const n = new InlineNode("Doc", "Com.Example", null);
		assert.strictEqual(n.getDeclaredNamespace(), "com.example");
		assert.throws(() => n.setNamespace("nodots"), ParseException);
		assert.throws(() => new InlineNode("Doc", "bad namespace", null), ParseException);
	});

	it("parsed trees expose declared and effective namespaces, parents and levels", () => {
		const docs = new Parser().parse([
			"Doc (com.example.docs): x",
			"\tChild: y",
			"\t\tOther (org.other.ns): z",
			"\t\t\tDeep: w",
			"",
		].join("\n"));
		const doc = docs[0] as InlineNode;
		const child = doc.getChildren()[0] as InlineNode;
		const other = child.getChildren()[0] as InlineNode;
		const deep = other.getChildren()[0];

		assert.strictEqual(doc.getDeclaredNamespace(), "com.example.docs");
		assert.strictEqual(child.getDeclaredNamespace(), "");
		assert.strictEqual(child.getNamespace(), "com.example.docs");
		assert.strictEqual(other.getDeclaredNamespace(), "org.other.ns");
		assert.strictEqual(deep.getNamespace(), "org.other.ns");
		assert.strictEqual(child.getParent(), doc);
		assert.strictEqual(deep.getParent(), other);
		assert.strictEqual(deep.getLevel(), 3);
	});

	// ---------------------------------------------------------------- name, value, line

	it("name, value and line are mutable", () => {
		const n = new InlineNode("Título  Largo", "v");
		assert.strictEqual(n.getName(), "Título Largo");
		assert.strictEqual(n.getCanonicalName(), "título-largo");
		assert.strictEqual(n.getLine(), Node.NO_LINE);

		n.setName("Otro nombre");
		assert.strictEqual(n.getCanonicalName(), "otro-nombre");
		n.setValue(null);
		assert.strictEqual(n.getValue(), "");
		n.setLine(42);
		assert.strictEqual(n.getLine(), 42);

		assert.throws(() => n.setName("Invalid!"), (e: unknown) => e instanceof ParseException && e.code === "INVALID_NODE_NAME");
		assert.strictEqual(n.getName(), "Otro nombre", "the failed rename changes nothing");
	});

	it("the parser sets the line; code-built nodes have none", () => {
		const parsed = (new Parser().parse("Doc: x\n\tChild: y\n")[0] as InlineNode).getChildren()[0];
		assert.strictEqual(parsed.getLine(), 2);
		assert.strictEqual(new TextNode("T").getLine(), Node.NO_LINE);
	});

	it("getNormalizedName is the deprecated alias of getCanonicalName", () => {
		const n = new InlineNode("Año Nuevo");
		assert.strictEqual(n.getCanonicalName(), "año-nuevo");
		assert.strictEqual(n.getNormalizedName(), n.getCanonicalName());
	});

	// ---------------------------------------------------------------- lookups

	it("child lookups use the effective namespace", () => {
		const root = new InlineNode("Doc", "com.example.docs", null);
		root.addInlineNode("Item", "1");
		root.addInlineNode("Item", "2");
		const foreign = root.addInlineNode("Item", "org.other.ns", "3");
		root.addTextNode("Text", "t");

		assert.strictEqual(root.getChildrenByName("item").length, 2);
		assert.deepStrictEqual(root.getChildrenByName("Item", "org.other.ns"), [foreign]);
		assert.throws(() => root.getChild("Item"), (e: unknown) => e instanceof RuntimeException && e.code === "AMBIGUOUS_CHILD");
		assert.strictEqual(root.getChild("Missing"), null);
		assert.strictEqual(root.getChild("Text")?.getText(), "t");
	});

	// ---------------------------------------------------------------- built trees behave like parsed ones

	it("a tree built by code writes and reparses to the same canonical tree", () => {
		const doc = new InlineNode("Email", "com.example.docs", "Weekly report");
		doc.addInlineNode("From", "ana@example.com");
		const to = doc.addInlineNode("To");
		to.addInlineNode("Address", "bob@example.com");
		doc.addTextNode("Body", "Hi Bob,\n\nSee attached.\n");
		doc.addInlineNode("Cc", "org.other.ns", "x");

		const written = NodeWriter.toSTXT(doc);
		const reparsed = new Parser().parse(written);

		assert.strictEqual(toCanonicalJson([doc]), toCanonicalJson(reparsed));
		assert.ok(written.includes("Email (com.example.docs): Weekly report"));
		assert.ok(written.includes("\tCc (org.other.ns): x"), "the namespace is written where declared");
		assert.ok(!written.includes("From (com.example.docs)"), "inherited namespaces are implicit");
	});
});
