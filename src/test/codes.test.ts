import * as assert from "assert";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaValidator } from "../schema/SchemaValidator";
import { transformNodeToSchema } from "../schema/SchemaParser";
import { transformTemplateNodeToSchema } from "../template/TemplateParser";
import { TemplateSchemaProviderMemory } from "../template/TemplateSchemaProviderMemory";
import { RuntimeException } from "../exceptions/RuntimeException";
import { Constants } from "../core/Constants";
import { SPEC_VERSION } from "../all";
import * as all from "../all";
import * as fs from "fs";
import * as path from "path";
import { findStxtLang } from "./corpus";

/**
 * Error codes introduced or split in 0.9.1 (normative annexes STXT-SPEC 11.1, STXT-SCHEMA-SPEC 13.1
 * and STXT-TEMPLATE-SPEC 14.1). The renamed 1:1 codes are covered by the corpus and the other suites.
 */

function validationCode(fn: () => unknown): { code: string; line: number; validation: boolean } {
	try {
		fn();
	} catch (e: unknown) {
		if (e instanceof ParseException) {
			return { code: e.code, line: e.line, validation: e instanceof ValidationException };
		}
		throw e;
	}
	assert.fail("expected a ParseException");
}

function root(text: string): Node {
	return new Parser().parse(text)[0];
}

describe("Cardinality codes: TOO_FEW_CHILDREN / TOO_MANY_CHILDREN", () => {
	const provider = new SchemaProviderMemory();
	provider.addSchema([
		"Schema (@stxt.schema): com.example.card",
		"\tNode: Root",
		"\t\tChildren:",
		"\t\t\tChild: Item",
		"\t\t\t\tMin: 1",
		"\t\t\t\tMax: 2",
		"\tNode: Item",
		"",
	].join("\n"));

	function codes(doc: string): string[] {
		return new SchemaValidator(provider, true).validate(root(doc)).map(e => e.code);
	}

	it("reports TOO_FEW_CHILDREN when count < Min", () => {
		assert.deepStrictEqual(codes("Root (com.example.card):\n"), ["TOO_FEW_CHILDREN"]);
	});

	it("reports TOO_MANY_CHILDREN on the parent and on each child when count > Max", () => {
		const doc = "Root (com.example.card):\n\tItem: a\n\tItem: b\n\tItem: c\n";
		const errors = new SchemaValidator(provider, true).validate(root(doc));
		assert.deepStrictEqual(errors.map(e => e.code), ["TOO_MANY_CHILDREN", "TOO_MANY_CHILDREN", "TOO_MANY_CHILDREN", "TOO_MANY_CHILDREN"]);
		assert.deepStrictEqual(errors.map(e => e.line), [1, 2, 3, 4]);
	});

	it("reports nothing when count is within [Min, Max]", () => {
		assert.deepStrictEqual(codes("Root (com.example.card):\n\tItem: a\n"), []);
	});
});

describe("VALUE_NOT_ALLOWED: a value on a GROUP", () => {
	const provider = new SchemaProviderMemory();
	provider.addSchema([
		"Schema (@stxt.schema): com.example.group",
		"\tNode: Root",
		"\t\tType: GROUP",
		"",
	].join("\n"));

	it("rejects an inline value", () => {
		const errors = new SchemaValidator(provider, true).validate(root("Root (com.example.group): value\n"));
		assert.deepStrictEqual(errors.map(e => e.code), ["VALUE_NOT_ALLOWED"]);
	});

	it("rejects the block form", () => {
		const errors = new SchemaValidator(provider, true).validate(root("Root (com.example.group) >>\n\ttext\n"));
		assert.deepStrictEqual(errors.map(e => e.code), ["VALUE_NOT_ALLOWED"]);
	});

	it("accepts the empty form", () => {
		assert.deepStrictEqual(new SchemaValidator(provider, true).validate(root("Root (com.example.group):\n")), []);
	});
});

describe("Schema load codes", () => {
	it("VALUES_DUPLICATED is a ValidationException at the line of the second Values node", () => {
		const doc = [
			"Schema (@stxt.schema): com.example.dup",
			"\tNode: Color",
			"\t\tType: ENUM",
			"\t\tValues:",
			"\t\t\tValue: red",
			"\t\tValues:",
			"\t\t\tValue: blue",
			"",
		].join("\n");
		const e = validationCode(() => transformNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "VALUES_DUPLICATED");
		assert.strictEqual(e.line, 6);
		assert.strictEqual(e.validation, true);
	});

	it("SCHEMA_NODE_NOT_INLINE when a schema node is written with >>", () => {
		const doc = [
			"Schema (@stxt.schema): com.example.block",
			"\tNode >>",
			"\t\tRoot",
			"",
		].join("\n");
		const e = validationCode(() => transformNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "SCHEMA_NODE_NOT_INLINE");
		assert.strictEqual(e.line, 2);
	});

	it("SCHEMA_NAMESPACE_EMPTY when the target namespace is empty", () => {
		const doc = "Schema (@stxt.schema):\n\tNode: Root\n";
		assert.strictEqual(validationCode(() => transformNodeToSchema(root(doc))).code, "SCHEMA_NAMESPACE_EMPTY");
		assert.strictEqual(validationCode(() => new SchemaProviderMemory().addSchema(doc)).code, "SCHEMA_NAMESPACE_EMPTY");
	});

	it("SCHEMA_ROOT_NOT_VALID when the root is not Schema (@stxt.schema)", () => {
		assert.strictEqual(validationCode(() => transformNodeToSchema(root("Esquema (@stxt.schema): com.example.x\n"))).code, "SCHEMA_ROOT_NOT_VALID");
		assert.strictEqual(validationCode(() => transformNodeToSchema(root("Schema (com.example.other): com.example.x\n"))).code, "SCHEMA_ROOT_NOT_VALID");
	});

	it("SCHEMA_ROOT_NOT_VALID when the target namespace is malformed", () => {
		const e = validationCode(() => transformNodeToSchema(root("Schema (@stxt.schema): not a namespace\n\tNode: Root\n")));
		assert.strictEqual(e.code, "SCHEMA_ROOT_NOT_VALID");
		assert.strictEqual(e.validation, true);
	});

	it("SCHEMA_MULTIPLE_ROOTS when the document does not hold exactly one root", () => {
		const two = "Schema (@stxt.schema): com.example.a\n\tNode: Root\nSchema (@stxt.schema): com.example.b\n\tNode: Root\n";
		assert.strictEqual(validationCode(() => new SchemaProviderMemory().addSchema(two)).code, "SCHEMA_MULTIPLE_ROOTS");
		assert.strictEqual(validationCode(() => new SchemaProviderMemory().addSchema("# nothing\n")).code, "SCHEMA_MULTIPLE_ROOTS");
	});
});

describe("Template load codes", () => {
	it("TEMPLATE_ROOT_NOT_VALID when the root is not Template (@stxt.template)", () => {
		const doc = "Plantilla (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot (1)\n";
		assert.strictEqual(validationCode(() => transformTemplateNodeToSchema(root(doc))).code, "TEMPLATE_ROOT_NOT_VALID");
	});

	it("TEMPLATE_ROOT_NOT_VALID when the target namespace is malformed", () => {
		const doc = "Template (@stxt.template): nodots\n\tStructure >>\n\t\tRoot (1)\n";
		const e = validationCode(() => transformTemplateNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "TEMPLATE_ROOT_NOT_VALID");
		assert.strictEqual(e.validation, true);
	});

	it("TEMPLATE_NAMESPACE_EMPTY when the target namespace is empty", () => {
		const doc = "Template (@stxt.template):\n\tStructure >>\n\t\tRoot (1)\n";
		assert.strictEqual(validationCode(() => transformTemplateNodeToSchema(root(doc))).code, "TEMPLATE_NAMESPACE_EMPTY");
		assert.strictEqual(validationCode(() => new TemplateSchemaProviderMemory().addTemplate(doc)).code, "TEMPLATE_NAMESPACE_EMPTY");
	});

	it("TEMPLATE_MULTIPLE_ROOTS when the document does not hold exactly one root", () => {
		const one = "Template (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot (1)\n";
		assert.strictEqual(validationCode(() => new TemplateSchemaProviderMemory().addTemplate(one + one)).code, "TEMPLATE_MULTIPLE_ROOTS");
	});
});

describe("Template blanks are the language blanks only (STXT-TEMPLATE-SPEC 6.2/9)", () => {
	// A non-ASCII space (NBSP, U+00A0) is content, never a template blank: the grammar
	// trims/splits on U+0020 and U+0009 only. So `(1) TEXT` is not `(1) TEXT`; the
	// type becomes " TEXT", an unknown type, exactly as any non-existent type. This
	// matches Java/Python, which use [ \t] rather than the platform's \s.
	const NBSP = "\u00A0";

	it("TYPE_NOT_VALID when a NBSP hugs the type instead of a real space", () => {
		const doc = `Template (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot:\n\t\t\tField: (1)${NBSP}TEXT\n`;
		const e = validationCode(() => transformTemplateNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "TYPE_NOT_VALID");
		assert.strictEqual(e.validation, true);
	});

	it("CARDINALITY_NOT_VALID when a NBSP sits inside the cardinality", () => {
		const doc = `Template (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot:\n\t\t\tField: (${NBSP}1) TEXT\n`;
		const e = validationCode(() => transformTemplateNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "CARDINALITY_NOT_VALID");
		assert.strictEqual(e.validation, true);
	});
});

describe("VALUE_EMPTY: an empty ENUM value (0.10.0)", () => {
	it("schema: an empty Value: fails at the line of that Value", () => {
		const doc = [
			"Schema (@stxt.schema): com.example.s",
			"\tNode: Root",
			"\t\tType: ENUM",
			"\t\tValues:",
			"\t\t\tValue: x",
			"\t\t\tValue:",
			"",
		].join("\n");
		const e = validationCode(() => transformNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "VALUE_EMPTY");
		assert.strictEqual(e.line, 6);
		assert.strictEqual(e.validation, true);
	});

	["[a, , b]", "[a, b,]", "[, a]", "[ , ]"].forEach(list => it(`template: ${list} fails at the line of the Structure line`, () => {
		const doc = `Template (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot:\n\t\t\tField: (1) ENUM ${list}\n`;
		const e = validationCode(() => transformTemplateNodeToSchema(root(doc)));
		assert.strictEqual(e.code, "VALUE_EMPTY");
		assert.strictEqual(e.line, 4);
		assert.strictEqual(e.validation, true);
	}));

	["[]", "[ ]"].forEach(list => it(`template: a whole empty list ${list} stays VALUES_REQUIRED`, () => {
		const doc = `Template (@stxt.template): com.example.t\n\tStructure >>\n\t\tRoot:\n\t\t\tField: (1) ENUM ${list}\n`;
		assert.strictEqual(validationCode(() => transformTemplateNodeToSchema(root(doc))).code, "VALUES_REQUIRED");
	}));
});

describe("Message framing (0.10.0)", () => {
	it("message is only the description; toString adds the code and the line", () => {
		const e = validationCode(() => new Parser().parse("Root:\n\t\tChild: x\n"));
		assert.strictEqual(e.code, "INDENTATION_LEVEL_NOT_VALID");
		try {
			new Parser().parse("Root:\n\t\tChild: x\n");
			assert.fail("expected a ParseException");
		} catch (err: unknown) {
			const pe = err as ParseException;
			assert.strictEqual(pe.message, "Level of indent incorrect: 2");
			assert.strictEqual(pe.toString(), "[INDENTATION_LEVEL_NOT_VALID] line 2: Level of indent incorrect: 2");
			assert.strictEqual(String(pe), pe.toString());
		}
	});

	it("ValidationException uses the same frame", () => {
		const e = new ValidationException(7, "SOME_CODE", "Some description");
		assert.strictEqual(e.message, "Some description");
		assert.strictEqual(e.toString(), "[SOME_CODE] line 7: Some description");
	});

	it("RuntimeException prints [CODE] message", () => {
		const e = new RuntimeException("SOME_CODE", "Some description");
		assert.strictEqual(e.message, "Some description");
		assert.strictEqual(e.toString(), "[SOME_CODE] Some description");
	});
});

describe("SPEC_VERSION", () => {
	it("is exported from the package entry point and equals Constants.SPEC_VERSION", () => {
		assert.strictEqual(SPEC_VERSION, "1.0");
		assert.strictEqual(Constants.SPEC_VERSION, SPEC_VERSION);
		assert.strictEqual(all.SPEC_VERSION, "1.0");
	});

	it("equals Metadata/Version of STXT-SPEC in stxt-lang (es/stxt-core-ref.stxt)", () => {
		const file = path.join(findStxtLang(), "es", "stxt-core-ref.stxt");
		const root = new Parser().parse(fs.readFileSync(file, "utf-8"))[0] as InlineNode;
		const metadata = root.getChild("Metadata") as InlineNode;
		const version = metadata.getChild("Version") as InlineNode | null;

		assert.ok(version, "STXT-SPEC has no Metadata/Version");
		assert.strictEqual(Constants.SPEC_VERSION, version!.getValue());
	});
});

describe("UNEXPECTED_ERROR: wrapper for an unforeseen exception", () => {
	it("wraps a plain Error thrown by a validator as a ValidationException at the node's line", () => {
		const parser = new Parser();
		parser.registerValidator({ validate: () => { throw new Error("boom"); } });
		const result = parser.parseResult("A: 1\nB: 2\n");
		const errors = result.getErrors();
		assert.deepStrictEqual(errors.map(e => e.code), ["UNEXPECTED_ERROR", "UNEXPECTED_ERROR"]);
		assert.deepStrictEqual(errors.map(e => e.line), [1, 2]);
		assert.ok(errors.every(e => e instanceof ValidationException));
		assert.strictEqual(errors[0].message, "boom");
	});

	it("wraps a non-Error value too", () => {
		const parser = new Parser();
		// Deliberate: the wrapper must cope with thrown values that are not Error objects
		// eslint-disable-next-line no-throw-literal
		parser.registerValidator({ validate: () => { throw "plain string"; } });
		const errors = parser.parseResult("A: 1\n").getErrors();
		assert.deepStrictEqual(errors.map(e => e.code), ["UNEXPECTED_ERROR"]);
		assert.strictEqual(errors[0].message, "plain string");
	});
});
