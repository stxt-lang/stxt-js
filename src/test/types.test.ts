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
	"\tNode: URL",
	"\t\tType: URL",
	"\tNode: DATE",
	"\t\tType: DATE",
	"\tNode: TIME",
	"\t\tType: TIME",
	"\tNode: TIMESTAMP",
	"\t\tType: TIMESTAMP",
	"\tNode: NUMBER",
	"\t\tType: NUMBER",
	"",
].join("\n"));

function codes(type: string, value: string): string[] {
	const node = new Parser().parse(`${type} (com.example.types): ${value}\n`)[0];
	return new SchemaValidator(PROVIDER, true).validate(node).map(e => e.code);
}

// STXT-SCHEMA-SPEC 9.4: the grammar of each type is normative; calendar and clock ranges included.
const GRAMMAR_CASES: [string, string[], string[]][] = [
	["NUMBER", ["1", "-1.5", "+1", "1.", ".5", "007", "1e10", "1.2E-3"], ["abc", "1,5", "", "1e", "e5", "1.2.3"]],
	["DATE", ["2026-08-21", "2024-02-29", "0000-01-01", "9999-12-31"],
		["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2023-02-29", "2026-8-21", "21-08-2026", "2026-08-21T10:00"]],
	["TIME", ["00:00:00", "23:59:59"], ["24:00:00", "10:60:00", "10:00:60", "10:30", "1:30:00", "10:30:00.5", "10:30:00Z"]],
	["TIMESTAMP", ["2026-08-21T10:30", "2026-08-21T10:30:00", "2026-08-21T10:30:00.1", "2026-08-21T10:30:00.123456Z",
		"2026-08-21T10:30:00+02:00", "2024-02-29T23:59:59-23:59"],
		["2026-02-30T10:30", "2026-08-21T24:00", "2026-08-21T10:60:00", "2026-08-21T10:30:00+24:00", "2026-08-21T10:30:00+02:60",
			"2026-08-21 10:30:00", "2026-08-21", "2026-08-21T10:30:00.", "2026-08-21T10:30:00+0200"]],
];

GRAMMAR_CASES.forEach(([type, good, bad]) => describe(`${type} type`, () => {
	good.forEach(value => it(`accepts ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes(type, value), []);
	}));
	bad.forEach(value => it(`rejects ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes(type, value), ["INVALID_VALUE"]);
	}));
	it("rejects the block form", () => {
		const node = new Parser().parse(`${type} (com.example.types) >>\n\t${good[0]}\n`)[0];
		assert.deepStrictEqual(new SchemaValidator(PROVIDER, true).validate(node).map(e => e.code), ["NOT_ALLOWED_TEXT"]);
	});
}));

describe("URL type", () => {
	// STXT-SCHEMA-SPEC 9.4: absolute URL, scheme and host mandatory, own grammar (not `new URL()`)
	const good = [
		"https://stxt.dev",
		"https://stxt.dev/path/to?q=1&r=2#frag",
		"HTTP://EXAMPLE.COM/",
		"http://localhost:8080/",
		"ftp://user:pw@example.com/dir/",
		"http://[::1]:80/x",
		"http://192.168.0.1",
		"git+ssh://host/repo.git",
		"https://例え.jp/パス",
		"http://host?q=1",
	];
	const bad = [
		"stxt.dev",
		"www.stxt.dev/x",
		"mailto:ana@example.com",
		"urn:isbn:9780131103627",
		"tel:+34600000000",
		"file:///etc/hosts",
		"http://",
		"://stxt.dev",
		"http:/stxt.dev",
		"1http://stxt.dev",
		"https://exa mple.com",
		"https://host:abc",
		"http://[::1",
		"http://user@",
		"https://host/path with space",
		"",
	];

	good.forEach(value => it(`accepts ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes("URL", value), []);
	}));

	bad.forEach(value => it(`rejects ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(codes("URL", value), ["INVALID_VALUE"]);
	}));

	it("rejects the block form", () => {
		const node = new Parser().parse("URL (com.example.types) >>\n\thttps://stxt.dev\n")[0];
		assert.deepStrictEqual(new SchemaValidator(PROVIDER, true).validate(node).map(e => e.code), ["NOT_ALLOWED_TEXT"]);
	});
});

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
