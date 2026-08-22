import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { Parser } from "../core/Parser";
import { ParseException } from "../exceptions/ParseException";
import { toCanonicalJson } from "../runtime/TreeJson";
import { describeCorpus } from "./corpus";

/**
 * The STXT conformance kit: `conformance/manifest.json` of stxt-lang lists every case with
 * its category and expected result, so that any implementation can run the same cases with
 * a small runner like this one and no knowledge of the other ports' test suites.
 *
 * - `tree`: the input parses and its canonical tree (STXT-TREE-SPEC) equals the expected
 *   JSON file, compared as a JSON value.
 * - `parse-error`: the input is rejected, and the first error carries the expected code and
 *   line (STXT-SPEC 11.1).
 */
interface Manifest {
	kit: string;
	specifications: Record<string, string>;
	cases: Case[];
}

interface Case {
	id: string;
	category: string;
	spec: string;
	description: string;
	input: string;
	expected?: string;
	error?: { code: string; line: number };
}

describeCorpus("Conformance kit", root => {
	const directory = path.join(root, "conformance");
	const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf-8"));
	const read = (file: string) => fs.readFileSync(path.join(directory, file), "utf-8");

	it("declares a kit version and the specifications it covers", () => {
		assert.match(manifest.kit, /^\d+\.\d+$/);
		assert.strictEqual(manifest.specifications["STXT-SPEC"], "1.0");
		assert.strictEqual(manifest.specifications["STXT-TREE-SPEC"], "1.0");
		assert.ok(manifest.cases.length > 0);
	});

	it("lists every case file, and every case exactly once", () => {
		const ids = manifest.cases.map(c => c.id);
		assert.deepStrictEqual(ids, [...new Set(ids)], "duplicate case ids");
		const listed = new Set(manifest.cases.map(c => c.input));
		for (const sub of ["tree", "parse"]) {
			for (const file of fs.readdirSync(path.join(directory, sub)).filter(f => f.endsWith(".stxt"))) {
				assert.ok(listed.has(`${sub}/${file}`), `${sub}/${file} is not in the manifest`);
			}
		}
	});

	for (const c of manifest.cases) {
		it(`${c.id}: ${c.description}`, () => {
			const input = read(c.input);
			switch (c.category) {
				case "tree": {
					const nodes = new Parser().parse(input);
					const actual = JSON.parse(toCanonicalJson(nodes));
					assert.deepStrictEqual(actual, JSON.parse(read(c.expected!)));
					break;
				}
				case "parse-error": {
					let error: ParseException | undefined;
					try {
						new Parser().parse(input);
					} catch (e) {
						if (!(e instanceof ParseException)) throw e;
						error = e;
					}
					assert.ok(error, `${c.id}: parsed without errors, expected ${c.error!.code}`);
					assert.deepStrictEqual({ code: error.code, line: error.line }, c.error);
					break;
				}
				default:
					assert.fail(`${c.id}: unknown category ${c.category}`);
			}
		});
	}
});
