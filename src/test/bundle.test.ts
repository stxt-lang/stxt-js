import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import * as all from "../all";

/**
 * The browser bundles of dist/ (the files a CDN serves) are built by esbuild from src/all.ts,
 * not by tsc like the rest of the package. These tests load both as a browser would and check
 * that they are the same library: same exports, same behaviour.
 */

type Api = typeof all;

const DIST = path.resolve(__dirname, "../../dist");

const TEMPLATE = [
	"Template (@stxt.template): com.example.bundle",
	"\tStructure >>",
	"\t\tRecipe:",
	"\t\t\tServings: (1) NATURAL",
	"\t\t\tSteps: (?) TEXT",
].join("\n");

const DOCUMENT = [
	"Recipe (com.example.bundle): Bread",
	"\tServings: four",
	"\tSteps >>",
	"\t\tMix: and bake",
].join("\n");

/** The IIFE bundle, run in an empty context: what a `<script>` tag leaves in the page. */
function loadGlobal(): Api {
	const code = fs.readFileSync(path.join(DIST, "stxt-core.js"), "utf-8");
	const context = vm.createContext({});
	vm.runInContext(code, context);
	return vm.runInContext("StxtCore", context) as Api;
}

/** The ESM bundle. tsc compiles `import()` to `require()` here, hence the indirection. */
function loadModule(): Promise<Api> {
	const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Api>;
	return dynamicImport("file://" + path.join(DIST, "stxt-core.mjs"));
}

function check(api: Api): void {
	assert.deepStrictEqual(Object.keys(api).sort(), Object.keys(all).sort());
	assert.strictEqual(api.SPEC_VERSION, all.SPEC_VERSION);

	const provider = new api.UnifiedSchemaProvider();
	provider.addFile(TEMPLATE);
	const parser = new api.Parser();
	parser.registerValidator(new api.SchemaValidator(provider));
	const result = parser.parseResult(DOCUMENT);

	// Array.from: the arrays of the IIFE bundle belong to another realm, and deepStrictEqual tells them apart
	assert.deepStrictEqual(Array.from(result.getErrors(), error => error.code), ["INVALID_VALUE"]);
	assert.ok(result.getErrors()[0] instanceof api.ValidationException);
	assert.strictEqual(api.toCanonicalJson(result.getNodes()), all.toCanonicalJson(new all.Parser().parse(DOCUMENT)));
	assert.strictEqual(api.Formatter.format(DOCUMENT, api.IndentStyle.SPACES_4).text, all.Formatter.format(DOCUMENT, all.IndentStyle.SPACES_4).text);
}

describe("Browser bundles", () => {
	it("dist/stxt-core.js defines the global StxtCore with the public API", () => {
		check(loadGlobal());
	});

	it("dist/stxt-core.mjs exports the public API", async () => {
		check(await loadModule());
	});
});
