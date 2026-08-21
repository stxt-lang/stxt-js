import * as assert from "assert";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaValidator } from "../schema/SchemaValidator";
import { transformNodeToSchema } from "../schema/SchemaParser";
import { transformTemplateNodeToSchema } from "../template/TemplateParser";
import { TemplateSchemaProviderMemory } from "../template/TemplateSchemaProviderMemory";

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
		parser.registerValidator({ validate: () => { throw "plain string"; } });
		const errors = parser.parseResult("A: 1\n").getErrors();
		assert.deepStrictEqual(errors.map(e => e.code), ["UNEXPECTED_ERROR"]);
		assert.strictEqual(errors[0].message, "plain string");
	});
});
