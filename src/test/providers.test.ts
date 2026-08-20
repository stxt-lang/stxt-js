import * as assert from "assert";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { TemplateSchemaProviderMemory } from "../template/TemplateSchemaProviderMemory";
import { ValidationException } from "../exceptions/ValidationException";
import { SchemaProviderMeta } from "../schema/SchemaProviderMeta";
import { MetaTemplateSchemaProvider } from "../template/MetaTemplateSchemaProvider";
import { SchemaValidator } from "../schema/SchemaValidator";
import { Parser } from "../core/Parser";

/**
 * Regression: a definition that does not validate against its meta-schema must never
 * be registered by the in-memory providers. addSchema/addTemplate used to discard the
 * ValidationException[] returned by SchemaValidator.validate() (a leftover of the
 * Validator contract change from throwing to collecting), silently registering
 * invalid definitions. Same policy as UnifiedSchemaProvider/DiscoveryResolver:
 * if there are errors, throw the first one.
 */
describe("SchemaProviderMemory.addSchema", () => {
	// Passes the parser and the transform, but Type: FOO violates the meta-schema ENUM
	const INVALID_SCHEMA = [
		"Schema (@stxt.schema): com.example.demo",
		"\tNode: Root",
		"\t\tType: FOO",
		"",
	].join("\n");

	const VALID_SCHEMA = [
		"Schema (@stxt.schema): com.example.demo",
		"\tNode: Root",
		"\t\tType: TEXT",
		"",
	].join("\n");

	it("throws the first validation error for an invalid schema and does not register it", () => {
		const provider = new SchemaProviderMemory();

		assert.throws(
			() => provider.addSchema(INVALID_SCHEMA),
			(e: unknown) => e instanceof ValidationException,
			"an invalid schema must throw a ValidationException"
		);

		assert.strictEqual(provider.getAllSchemas().length, 0, "the invalid schema must not be registered");
	});

	it("still registers a valid schema", () => {
		const provider = new SchemaProviderMemory();
		provider.addSchema(VALID_SCHEMA);

		assert.strictEqual(provider.getAllSchemas().length, 1);
		assert.ok(provider.getSchema("com.example.demo"));
	});

	it("rejects a schema Node whose value is not a valid STXT node name", () => {
		const provider = new SchemaProviderMemory();
		const invalidName = [
			"Schema (@stxt.schema): com.example.demo",
			"\tNode: Invalid!",
			"",
		].join("\n");

		assert.throws(
			() => provider.addSchema(invalidName),
			(e: unknown) => e instanceof ValidationException && e.code === "INVALID_NODE_NAME"
		);
	});

	it("rejects a schema Child whose value is not a valid STXT node name", () => {
		const provider = new SchemaProviderMemory();
		const invalidName = [
			"Schema (@stxt.schema): com.example.demo",
			"\tNode: Root",
			"\t\tChildren:",
			"\t\t\tChild: Invalid!",
			"",
		].join("\n");

		assert.throws(
			() => provider.addSchema(invalidName),
			(e: unknown) => e instanceof ValidationException && e.code === "INVALID_NODE_NAME"
		);
	});
});

describe("TemplateSchemaProviderMemory.addTemplate", () => {
	// Parses fine and the transform ignores the extra child, but the meta-template's
	// closed content model does not declare "Foo" under Template
	const INVALID_TEMPLATE = [
		"Template (@stxt.template): com.example.demo",
		"\tStructure >>",
		"\t\tRoot:",
		"\tFoo: bar",
		"",
	].join("\n");

	const VALID_TEMPLATE = [
		"Template (@stxt.template): com.example.demo",
		"\tStructure >>",
		"\t\tRoot:",
		"",
	].join("\n");

	it("throws the first validation error for an invalid template and does not register it", () => {
		const provider = new TemplateSchemaProviderMemory();

		assert.throws(
			() => provider.addTemplate(INVALID_TEMPLATE),
			(e: unknown) => e instanceof ValidationException,
			"an invalid template must throw a ValidationException"
		);

		assert.strictEqual(provider.getAllSchemas().length, 0, "the invalid template must not be registered");
	});

	it("still registers a valid template", () => {
		const provider = new TemplateSchemaProviderMemory();
		provider.addTemplate(VALID_TEMPLATE);

		assert.strictEqual(provider.getAllSchemas().length, 1);
		assert.ok(provider.getSchema("com.example.demo"));
	});

	it("rejects a BLOCK line inside Structure", () => {
		const provider = new TemplateSchemaProviderMemory();
		const invalidStructure = [
			"Template (@stxt.template): com.example.demo",
			"\tStructure >>",
			"\t\tRoot >>",
			"",
		].join("\n");

		assert.throws(
			() => provider.addTemplate(invalidStructure),
			(e: unknown) => e instanceof ValidationException && e.code === "INVALID_CHILD_LINE"
		);
	});
});

/**
 * SchemaProvider contract: providers never throw "not found". getSchema() returns null for a
 * namespace they have no schema for, and only SchemaValidator turns that absence into the
 * SCHEMA_NOT_FOUND finding. The meta providers used to throw RESOURCE_NOT_FOUND for any other
 * namespace, which leaked through SchemaProviderMemory (whose default parent is the meta
 * provider) and made a Validator throw instead of returning its errors.
 */
describe("SchemaProvider contract: null instead of 'not found' exceptions", () => {
	it("SchemaProviderMeta returns null for any namespace other than @stxt.schema", () => {
		const meta = new SchemaProviderMeta();
		assert.strictEqual(meta.getSchema("com.example.unknown"), null);
		assert.strictEqual(meta.getSchema("@stxt.template"), null);
		assert.ok(meta.getSchema("@stxt.schema"));
	});

	it("MetaTemplateSchemaProvider returns null for any namespace other than @stxt.template", () => {
		const meta = new MetaTemplateSchemaProvider();
		assert.strictEqual(meta.getSchema("com.example.unknown"), null);
		assert.strictEqual(meta.getSchema("@stxt.schema"), null);
		assert.ok(meta.getSchema("@stxt.template"));
	});

	it("SchemaProviderMemory with the default meta parent returns null for an unknown namespace", () => {
		const provider = new SchemaProviderMemory();
		assert.strictEqual(provider.getSchema("com.example.unknown"), null);
	});

	it("SchemaValidator reports SCHEMA_NOT_FOUND as a finding, without throwing, for an unknown namespace", () => {
		const validator = new SchemaValidator(new SchemaProviderMemory(), true);
		const [doc] = new Parser().parse("Doc (com.example.unknown): x\n");

		const errors = validator.validate(doc);
		assert.strictEqual(errors.length, 1);
		assert.strictEqual(errors[0].code, "SCHEMA_NOT_FOUND");
	});

	it("SchemaValidator never validates the empty namespace, but does validate a namespaced node inside it (STXT-SCHEMA-SPEC 5)", () => {
		const validator = new SchemaValidator(new SchemaProviderMemory(), true);

		assert.deepStrictEqual(validator.validate(new Parser().parse("Doc: x\n\tChild: y\n")[0]), []);

		const errors = validator.validate(new Parser().parse("Doc: x\n\tFree: y\n\tBound (com.example.unknown): z\n")[0]);
		assert.deepStrictEqual(errors.map(e => [e.code, e.line]), [["SCHEMA_NOT_FOUND", 3]]);
	});
});
