import * as assert from "assert";
import { Parser } from "../core/Parser";
import { InlineNode } from "../core/InlineNode";
import { TextNode } from "../core/TextNode";
import { StringUtils } from "../core/StringUtils";
import { RuntimeException } from "../exceptions/RuntimeException";
import { ParseException } from "../exceptions/ParseException";
import { ChildLineParser } from "../template/ChildLineParser";
import { UnifiedSchemaProvider } from "../runtime/UnifiedSchemaProvider";
import { SchemaValidator } from "../schema/SchemaValidator";
import { DiscoveryResolver } from "../discovery/DiscoveryResolver";
import { DiscoveryEntry, DiscoveryFileSystem } from "../discovery/DiscoveryFileSystem";
import { MemoryFileSystem, TestEnvironment } from "./discoveryMemory";

/**
 * Hardening of the 2026-09-06 security review: every case here reproduced a pathological
 * cost, an escaping exception or a structure injection before the fix. The timing cases use
 * inputs that took seconds to minutes before and take milliseconds now, so mocha's default
 * timeout is the assertion.
 */

function code(e: unknown): string {
	return e instanceof RuntimeException || e instanceof ParseException ? e.code : String(e);
}

describe("Hardening (security review 2026-09-06)", () => {

	// ---------------------------------------------------------------- trims

	describe("blank trimming is linear", () => {

		it("trims and right-trims blanks only, by index", () => {
			assert.strictEqual(StringUtils.trim("\t a \t"), "a");
			assert.strictEqual(StringUtils.trim(" a "), "a ");
			assert.strictEqual(StringUtils.trim("　a"), "　a");
			assert.strictEqual(StringUtils.trim("   "), "");
			assert.strictEqual(StringUtils.trim(null), "");
			assert.strictEqual(StringUtils.rightTrim(" a \t"), " a");
			assert.strictEqual(StringUtils.rightTrim("a "), "a ");
			assert.strictEqual(StringUtils.rightTrim("\t"), "");
			assert.strictEqual(StringUtils.compactSpaces(" a \t b "), "a b");
		});

		it("parses 100 lines with an inner run of 9 990 blanks each in milliseconds (was 50 s)", () => {
			const line = "n: x" + " ".repeat(9990) + "y\n";
			const result = new Parser().parseResult(line.repeat(100));

			assert.strictEqual(result.getErrors().length, 0);
			assert.strictEqual(result.getNodes().length, 100);
			assert.strictEqual((result.getNodes()[0] as InlineNode).getValue().length, 9992);
		});
	});

	// ---------------------------------------------------------------- template RuleSpec

	describe("ChildLineParser scans the RuleSpec without backtracking", () => {

		it("rejects an unclosed value list of 9 990 blanks in milliseconds (was minutes)", () => {
			for (const line of ["TEXT [" + " ".repeat(9990) + "x", "[" + "\t ".repeat(4995) + "x", "(" + " ".repeat(9990) + "x"]) {
				assert.throws(() => ChildLineParser.parse(line, 1), (e: unknown) => code(e) === "STRUCTURE_LINE_NOT_VALID");
			}
		});

		it("keeps the grammar of the former pattern, line by line", () => {
			const ok = (line: string, type: string | null, min: number | null, max: number | null, values: string[] | null) => {
				const c = ChildLineParser.parse(line, 1);
				assert.deepStrictEqual([c.getType(), c.getMin(), c.getMax(), c.getValues()], [type, min, max, values], JSON.stringify(line));
			};
			ok("( 2 ) TEXT", "TEXT", 2, 2, null);
			ok("  [a, b]  ", null, null, null, ["a", "b"]);
			ok("TEXT [ ]", "TEXT", null, null, []);
			ok("(1,3) ENUM [ a , b ]", "ENUM", 1, 3, ["a", "b"]);
			ok("TEXT [a[b]", "TEXT", null, null, ["a[b"]);
			ok("(?)\t@Ref\t", "@Ref", null, 1, null);
		});

		it("rejects what the former pattern rejected, with the same codes", () => {
			const ko = (line: string, expected: string) => {
				assert.throws(() => ChildLineParser.parse(line, 1), (e: unknown) => code(e) === expected, JSON.stringify(line) + " -> " + expected);
			};

			ko("()", "STRUCTURE_LINE_NOT_VALID");
			ko("( )", "STRUCTURE_LINE_NOT_VALID");
			ko("((1))", "STRUCTURE_LINE_NOT_VALID");
			ko("(1", "STRUCTURE_LINE_NOT_VALID");
			ko("TEXT (1)", "STRUCTURE_LINE_NOT_VALID");
			ko("(1) (2)", "STRUCTURE_LINE_NOT_VALID");
			ko("TEXT a]", "STRUCTURE_LINE_NOT_VALID");
			ko("TEXT [a", "STRUCTURE_LINE_NOT_VALID");
			ko("[a] b", "STRUCTURE_LINE_NOT_VALID");
			ko("[a] [b]", "STRUCTURE_LINE_NOT_VALID");
			// STXT-TEMPLATE-SPEC 9: an ENUM value cannot contain "]", the end of the list. The
			// former JS pattern took "a]" as a value here; java and python never did.
			ko("[a]]", "STRUCTURE_LINE_NOT_VALID");
			ko("(1[) TEXT", "CARDINALITY_NOT_VALID");
			ko("(x) TEXT", "CARDINALITY_NOT_VALID");
		});
	});

	// ---------------------------------------------------------------- ENUM message

	it("an ENUM INVALID_VALUE message does not carry the list of allowed values", () => {
		const values = Array.from({ length: 2000 }, (_, i) => `\t\t\tValue: v${i}`).join("\n");
		const provider = new UnifiedSchemaProvider();
		provider.addFile(`Schema (@stxt.schema): com.example.big\n\tNode: R\n\t\tChildren:\n\t\t\tChild: E\n\t\t\t\tMax: 5\n\tNode: E\n\t\tType: ENUM\n\t\tValues:\n${values}\n`);
		const parser = new Parser();
		parser.registerValidator(new SchemaValidator(provider, false));

		const result = parser.parseResult("R (com.example.big):\n\tE: zz\n\tE: v1\n");

		assert.strictEqual(result.getErrors().length, 1);
		assert.strictEqual(result.getErrors()[0].code, "INVALID_VALUE");
		assert.ok(result.getErrors()[0].message.length < 100, result.getErrors()[0].message);
		assert.ok(result.getErrors()[0].message.includes("'zz'"));
	});

	// ---------------------------------------------------------------- line breaks through the API

	describe("a value or a text line set through the API cannot contain a line break", () => {

		it("InlineNode rejects LF and keeps a lone CR", () => {
			assert.throws(() => new InlineNode("A", "a\nb: injected"), (e: unknown) => code(e) === "LINE_BREAK_NOT_ALLOWED");
			const node = new InlineNode("A", "a");
			assert.throws(() => node.setValue("x\ny"), (e: unknown) => code(e) === "LINE_BREAK_NOT_ALLOWED");
			assert.strictEqual(node.getValue(), "a");
			node.setValue("a\rb");
			assert.strictEqual(node.getValue(), "a\rb");
		});

		it("TextNode rejects LF in a line and splits a string instead", () => {
			assert.throws(() => new TextNode("A", ["x\ny"]), (e: unknown) => code(e) === "LINE_BREAK_NOT_ALLOWED");
			const node = new TextNode("A", "x\ny");
			assert.deepStrictEqual(node.getTextLines(), ["x", "y"]);
			assert.throws(() => node.addTextLine("p\nq"), (e: unknown) => code(e) === "LINE_BREAK_NOT_ALLOWED");
			assert.throws(() => node.setTextLines(["ok", "p\nq"]), (e: unknown) => code(e) === "LINE_BREAK_NOT_ALLOWED");
			assert.deepStrictEqual(node.getTextLines(), ["x", "y"]);
			node.addTextLine("z\r");
			assert.deepStrictEqual(node.getTextLines(), ["x", "y", "z\r"]);
		});
	});

	// ---------------------------------------------------------------- deep trees built by a program

	describe("trees built by a program, with no nesting limit", () => {

		it("builds a chain of 100 000 nodes in linear time and resolves the namespace at the leaf", () => {
			const root = new InlineNode("Root", "a.b", null);
			let node = root;
			for (let i = 0; i < 100000; i++) {
				const child = new InlineNode("N");
				node.addChild(child);
				node = child;
			}

			assert.strictEqual(node.getLevel(), 100000);
			assert.strictEqual(node.getNamespace(), "a.b");
			assert.strictEqual(node.getQualifiedName(), "a.b:n");
		});

		it("still detects every cycle", () => {
			const root = new InlineNode("Root");
			const child = new InlineNode("Child");
			const grandchild = new InlineNode("Grandchild");
			root.addChild(child);
			child.addChild(grandchild);

			assert.throws(() => root.addChild(root), (e: unknown) => code(e) === "NODE_CYCLE");
			assert.throws(() => grandchild.addChild(root), (e: unknown) => code(e) === "NODE_CYCLE");

			// A detached subtree cannot be re-attached below its own descendant either
			const a = new InlineNode("A");
			const b = new InlineNode("B");
			a.addChild(b);
			assert.throws(() => b.addChild(a), (e: unknown) => code(e) === "NODE_CYCLE");
		});
	});

	// ---------------------------------------------------------------- parser input

	describe("parser input handling", () => {

		it("splits lines lazily at LF and CRLF only: a lone CR is content (STXT-SPEC 3)", () => {
			const nodes = new Parser().parse("A: one\rB: two\r\nC: three\n") as InlineNode[];

			assert.deepStrictEqual(nodes.map(n => [n.getName(), n.getValue()]), [["A", "one\rB: two"], ["C", "three"]]);
			assert.deepStrictEqual(new Parser().parse("A: 1\nB: 2").map(n => n.getName()), ["A", "B"]);
			assert.deepStrictEqual(new Parser().parse(""), []);
		});

		it("rejects a limit that is not an integer >= 0 or -1", () => {
			for (const bad of [NaN, -2, 1.5, Infinity]) {
				assert.throws(() => new Parser({ maxLineLength: bad }), RangeError);
				assert.throws(() => new Parser({ maxNesting: bad }), RangeError);
				assert.throws(() => new Parser({ maxInputSize: bad }), RangeError);
			}
			assert.strictEqual(new Parser({ maxNesting: -1, maxLineLength: 0, maxInputSize: -1 }).parseResult("").getErrors().length, 0);
		});
	});

	// ---------------------------------------------------------------- discovery

	describe("discovery descent and ascent", () => {

		/** A level whose every directory lists the same two subdirectories: a cycle of breadth 2. */
		class CyclicFileSystem implements DiscoveryFileSystem {
			listings = 0;
			async isDirectory(path: string): Promise<boolean> { return path.startsWith("/p/.stxt"); }
			async listDirectory(): Promise<DiscoveryEntry[]> {
				this.listings++;
				return [
					{ path: "/p/.stxt/a", name: "a", isDirectory: true },
					{ path: "/p/.stxt/b", name: "b", isDirectory: true },
				];
			}
			async readFile(): Promise<string> { throw new Error("no files"); }
			parentOf(path: string): string | null { return path === "/" ? null : path.substring(0, path.lastIndexOf("/")) || "/"; }
			join(path: string, name: string): string { return path === "/" ? "/" + name : path + "/" + name; }
		}

		it("visits each directory of a level once, so a cycle of breadth 2 is not entered 2^32 times", async () => {
			const fs = new CyclicFileSystem();
			const result = await new DiscoveryResolver(fs, new TestEnvironment()).resolve("/p");

			assert.strictEqual(fs.listings, 3);
			assert.strictEqual(result.getErrors().length, 0);
		});

		it("an adapter whose isDirectory throws does not make resolve() throw", async () => {
			const fs = new MemoryFileSystem({ "/p/.stxt/x.stxt": "irrelevant" });
			fs.isDirectory = async () => { throw new Error("boom"); };
			const resolver = new DiscoveryResolver(fs, new TestEnvironment(["/etc/stxt"], "/home/u/.stxt", "/etc/stxt"));

			assert.deepStrictEqual(await resolver.resolveChain("/p"), []);
			assert.strictEqual((await resolver.resolve("/p")).getErrors().length, 0);
		});

		it("rejects a maxAscent that is not an integer >= 0", () => {
			for (const bad of [Infinity, NaN, -1, 1.5]) {
				assert.throws(() => new DiscoveryResolver(new MemoryFileSystem({}), new TestEnvironment(), { maxAscent: bad }), RangeError);
			}
		});
	});

	// ---------------------------------------------------------------- namespaces

	describe("namespaces (STXT-SPEC 7)", () => {

		it("are checked by a linear scan: 2 000 labels are valid, and the malformed shapes are not", () => {
			const long = "a.".repeat(1999) + "a";
			assert.strictEqual(new Parser().parse(`N (${long}): v\n`)[0].getNamespace(), long);

			for (const bad of ["a", "@", "@a", "a.", ".a", "a..b", "a b.c", "a.b!", ""]) {
				assert.throws(() => new Parser().parse(`N (${bad}): v\n`), (e: unknown) => code(e) === "INVALID_NAMESPACE" || code(e) === "INVALID_LINE", JSON.stringify(bad));
			}
			for (const good of ["a.b", "A.B", "@stxt.schema", "com.example.docs", "a1.2b"]) {
				assert.strictEqual(new Parser().parse(`N (${good}): v\n`)[0].getNamespace(), good.toLowerCase());
			}
		});

		it("lower-cases ASCII only: U+212A KELVIN SIGN is not a k (homograph, 7.1)", () => {
			assert.throws(() => new Parser().parse("N (\u212Aelvin.x): v\n"), (e: unknown) => code(e) === "INVALID_NAMESPACE");
			assert.throws(() => new InlineNode("N", "\u212Aelvin.x", "v"), (e: unknown) => code(e) === "INVALID_NAMESPACE");
			assert.strictEqual(StringUtils.lowerCase("Com.Example"), "com.example");
			assert.strictEqual(StringUtils.lowerCase("\u212A"), "\u212A");
		});
	});
});
