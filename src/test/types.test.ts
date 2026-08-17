import * as assert from "assert";
import { Parser } from "../core/Parser";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaValidator } from "../schema/SchemaValidator";

/**
 * Value types (STXT-SCHEMA-SPEC section 9) checked through SchemaValidator over a schema that
 * declares one node per type. Only the cases the corpus does not already cover live here.
 */
const PROVIDER = new SchemaProviderMemory();
PROVIDER.addSchema([
	"Schema (@stxt.schema): com.example.types",
	"\tNode: EMAIL",
	"\t\tType: EMAIL",
	"",
].join("\n"));

function codes(type: string, value: string): string[] {
	const node = new Parser().parse(`${type} (com.example.types): ${value}\n`)[0];
	return new SchemaValidator(PROVIDER, true).validate(node).map(e => e.code);
}

describe("EMAIL type", () => {
	const good = [
		"ana@example.com",
		"a.b+c@sub.example.org",
		// STXT-SCHEMA-SPEC 9.4: display name followed by the address between angle brackets
		"Ana García <ana@example.com>",
		"Ana<ana@example.com>",
		"Ana García   <ana@example.com>",
		"\"García, Ana\" <ana@example.com>",
	];
	const bad = [
		"ana@",
		"@example.com",
		"ana@localhost",
		"a b@example.com",
		// the bracketed form needs a name, balanced brackets, a valid address and nothing after
		"<ana@example.com>",
		"   <ana@example.com>",
		"Ana <ana@>",
		"Ana <ana@localhost>",
		"Ana <ana@example.com",
		"Ana ana@example.com>",
		"Ana ana@example.com",
		"Ana <ana@example.com> extra",
		"Ana <ana@example.com> <ana@example.com>",
		"Ana <<ana@example.com>>",
	];

	good.forEach(value => it(`accepts ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes("EMAIL", value), []);
	}));

	bad.forEach(value => it(`rejects ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes("EMAIL", value), ["INVALID_VALUE"]);
	}));

	it("rejects the block form", () => {
		const node = new Parser().parse("EMAIL (com.example.types) >>\n\tana@example.com\n")[0];
		assert.deepStrictEqual(new SchemaValidator(PROVIDER, true).validate(node).map(e => e.code), ["NOT_ALLOWED_TEXT"]);
	});
});
