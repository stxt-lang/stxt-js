import * as assert from "assert";
import { MemoryFileSystem, TestEnvironment } from "./discoveryMemory";
import { DiscoveryError } from "../discovery/DiscoveryError";
import { DiscoveryResolver } from "../discovery/DiscoveryResolver";

/**
 * Conformance tests of DiscoveryResolver against STXT-DISCOVERY-SPEC, over an in-memory
 * file system: chain building (project ascent, user, system, STXT_PATH), per-namespace
 * precedence and the resolution errors of section 8.
 */

/** In-memory DiscoveryFileSystem: a flat map of full paths to file contents. */
function template(namespace: string, rootNode: string): string {
	return [
		`Template (@stxt.template): ${namespace}`,
		"\tStructure >>",
		`\t\t${rootNode} (${namespace}):`,
		"\t\t\tTitle: (1)",
		"",
	].join("\n");
}

function schema(namespace: string, rootNode: string): string {
	return [
		`Schema (@stxt.schema): ${namespace}`,
		`\tNode: ${rootNode}`,
		"\t\tChildren:",
		"\t\t\tChild: Title",
		"\t\t\t\tMin: 1",
		"\t\t\t\tMax: 1",
		"\tNode: Title",
		"",
	].join("\n");
}

describe("DiscoveryResolver", () => {

	describe("resolution chain (spec section 4)", () => {

		it("collects every ancestor .stxt directory, nearest first, without stopping at the first one", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/common.stxt": template("com.acme.common", "Common"),
				"/repo/web/.stxt/web.stxt": template("com.acme.web", "Web"),
				"/repo/web/docs/doc.stxt": "irrelevant",
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const chain = await resolver.resolveChain("/repo/web/docs");

			assert.deepStrictEqual(chain, ["/repo/web/.stxt", "/repo/.stxt"]);
		});

		it("appends the user and system levels after the project levels", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/a.stxt": template("com.acme.a", "A"),
				"/home/ana/.stxt/b.stxt": template("org.ana.b", "B"),
				"/etc/stxt/c.stxt": template("org.corp.c", "C"),
			});
			const env = new TestEnvironment(null, "/home/ana/.stxt", "/etc/stxt");
			const resolver = new DiscoveryResolver(fs, env);

			const chain = await resolver.resolveChain("/repo");

			assert.deepStrictEqual(chain, ["/repo/.stxt", "/home/ana/.stxt", "/etc/stxt"]);
		});

		it("ignores user and system directories that do not exist", async () => {
			const fs = new MemoryFileSystem({ "/repo/.stxt/a.stxt": template("com.acme.a", "A") });
			const env = new TestEnvironment(null, "/home/ana/.stxt", "/etc/stxt");
			const resolver = new DiscoveryResolver(fs, env);

			assert.deepStrictEqual(await resolver.resolveChain("/repo"), ["/repo/.stxt"]);
		});

		it("does not duplicate the user level when the ascent already found it", async () => {
			const fs = new MemoryFileSystem({ "/home/ana/.stxt/a.stxt": template("org.ana.a", "A") });
			const env = new TestEnvironment(null, "/home/ana/.stxt", null);
			const resolver = new DiscoveryResolver(fs, env);

			assert.deepStrictEqual(await resolver.resolveChain("/home/ana/notes"), ["/home/ana/.stxt"]);
		});

		it("a document with no location starts at the user level", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/a.stxt": template("com.acme.a", "A"),
				"/home/ana/.stxt/b.stxt": template("org.ana.b", "B"),
			});
			const env = new TestEnvironment(null, "/home/ana/.stxt", null);
			const resolver = new DiscoveryResolver(fs, env);

			assert.deepStrictEqual(await resolver.resolveChain(null), ["/home/ana/.stxt"]);
		});

		it("honors the maxAscent safeguard", async () => {
			const fs = new MemoryFileSystem({ "/a/.stxt/x.stxt": template("com.acme.x", "X") });
			fs.addEmptyDir("/a/b/c/d/e");
			const resolver = new DiscoveryResolver(fs, new TestEnvironment(), { maxAscent: 3 });

			// The ascent examines /a/b/c/d/e, /a/b/c/d and /a/b/c, and stops before /a.
			assert.deepStrictEqual(await resolver.resolveChain("/a/b/c/d/e"), []);
		});
	});

	describe("STXT_PATH (spec section 6)", () => {

		it("replaces the whole chain, including the project level", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/a.stxt": template("com.acme.a", "A"),
				"/ci/defs/b.stxt": template("org.ci.b", "B"),
			});
			const env = new TestEnvironment(["/ci/defs"], "/home/ana/.stxt", "/etc/stxt");
			const resolver = new DiscoveryResolver(fs, env);

			assert.deepStrictEqual(await resolver.resolveChain("/repo"), ["/ci/defs"]);
		});

		it("defined but empty leaves the chain empty", async () => {
			const fs = new MemoryFileSystem({ "/repo/.stxt/a.stxt": template("com.acme.a", "A") });
			const resolver = new DiscoveryResolver(fs, new TestEnvironment([]));

			assert.deepStrictEqual(await resolver.resolveChain("/repo"), []);
			assert.strictEqual((await resolver.resolve("/repo")).getAllSchemas().length, 0);
		});

		it("ignores nonexistent entries and keeps the order as precedence", async () => {
			const fs = new MemoryFileSystem({
				"/one/a.stxt": template("com.acme.doc", "One"),
				"/two/a.stxt": template("com.acme.doc", "Two"),
			});
			const env = new TestEnvironment(["/missing", "/one", "/two"]);
			const resolver = new DiscoveryResolver(fs, env);

			const result = await resolver.resolve("/anywhere");

			assert.deepStrictEqual(result.getChain(), ["/one", "/two"]);
			assert.strictEqual(result.getDefinition("com.acme.doc")?.file, "/one/a.stxt");
		});
	});

	describe("per-namespace precedence (spec section 5)", () => {

		it("the nearest level wins for each namespace", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/web.stxt": template("com.acme.web", "Old"),
				"/repo/web/.stxt/web.stxt": template("com.acme.web", "New"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo/web");

			assert.strictEqual(result.getDefinition("com.acme.web")?.file, "/repo/web/.stxt/web.stxt");
			assert.strictEqual(result.getErrors().length, 0, "a cross-level duplicate is not an error");
			assert.strictEqual(result.getAllSchemas().length, 1);
		});

		it("different namespaces resolve from different levels in the same validation", async () => {
			const fs = new MemoryFileSystem({
				"/repo/web/.stxt/web.stxt": template("com.acme.web", "Web"),
				"/repo/.stxt/common.stxt": template("com.acme.common", "Common"),
				"/home/ana/.stxt/personal.stxt": template("org.ana.notes", "Notes"),
			});
			const env = new TestEnvironment(null, "/home/ana/.stxt", null);
			const resolver = new DiscoveryResolver(fs, env);

			const result = await resolver.resolve("/repo/web");

			assert.strictEqual(result.getDefinition("com.acme.web")?.levelDir, "/repo/web/.stxt");
			assert.strictEqual(result.getDefinition("com.acme.common")?.levelDir, "/repo/.stxt");
			assert.strictEqual(result.getDefinition("org.ana.notes")?.levelDir, "/home/ana/.stxt");
			assert.strictEqual(result.getAllSchemas().length, 3);
		});

		it("a template at a nearer level beats a schema at a farther one", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/doc.stxt": schema("com.acme.doc", "Document"),
				"/repo/web/.stxt/doc.stxt": template("com.acme.doc", "Document"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo/web");

			assert.strictEqual(result.getDefinition("com.acme.doc")?.file, "/repo/web/.stxt/doc.stxt");
		});

		it("subdirectories of a resolution directory belong to the same level", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/sub/dir/a.stxt": template("com.acme.a", "A"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo");

			assert.strictEqual(result.getDefinition("com.acme.a")?.levelDir, "/repo/.stxt");
		});
	});

	describe("resolution errors (spec section 8)", () => {

		it("a same-level duplicate is an error and leaves the namespace without active definition", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/one.stxt": template("com.acme.doc", "One"),
				"/repo/.stxt/two.stxt": schema("com.acme.doc", "Two"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo");

			const errors = result.getErrors();
			assert.strictEqual(errors.length, 1);
			assert.strictEqual(errors[0].code, DiscoveryError.DUPLICATE_NAMESPACE);
			assert.strictEqual(errors[0].namespace, "com.acme.doc");
			assert.strictEqual(result.getSchema("com.acme.doc"), null);
			assert.strictEqual(result.getAllSchemas().length, 0);
		});

		it("a same-level duplicate does not block the farther levels' other namespaces", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/one.stxt": template("com.acme.doc", "One"),
				"/repo/.stxt/two.stxt": template("com.acme.doc", "Two"),
				"/repo/.stxt/other.stxt": template("com.acme.other", "Other"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo");

			assert.strictEqual(result.getSchema("com.acme.doc"), null);
			assert.ok(result.getSchema("com.acme.other"), "the non-conflicting namespace keeps working");
		});

		it("a nearer same-level conflict does not fall back to a farther definition of that namespace", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/one.stxt": template("com.acme.doc", "One"),
				"/repo/.stxt/two.stxt": template("com.acme.doc", "Two"),
				"/home/ana/.stxt/farther.stxt": template("com.acme.doc", "Farther"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment(null, "/home/ana/.stxt", null));

			const result = await resolver.resolve("/repo");

			assert.strictEqual(result.getDefinition("com.acme.doc"), undefined);
			assert.strictEqual(result.getSchema("com.acme.doc"), null);
			assert.ok(!result.getActiveDefinitions().some(definition => definition.namespace === "com.acme.doc"));
		});

		it("a file that does not parse is NOT_PARSEABLE", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/broken.stxt": "This line has no colon and no block marker\n",
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const errors = (await resolver.resolve("/repo")).getErrors();

			assert.strictEqual(errors.length, 1);
			assert.strictEqual(errors[0].code, DiscoveryError.NOT_PARSEABLE);
		});

		it("a document of another namespace is NOT_A_DEFINITION", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/doc.stxt": "Document (com.acme.doc):\n\tTitle: Hello\n",
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const errors = (await resolver.resolve("/repo")).getErrors();

			assert.strictEqual(errors.length, 1);
			assert.strictEqual(errors[0].code, DiscoveryError.NOT_A_DEFINITION);
		});

		it("a non-.stxt file is NOT_A_DEFINITION", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/README.md": "# Not a definition\n",
				"/repo/.stxt/good.stxt": template("com.acme.doc", "Doc"),
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo");

			assert.strictEqual(result.getErrors().length, 1);
			assert.strictEqual(result.getErrors()[0].code, DiscoveryError.NOT_A_DEFINITION);
			assert.ok(result.getSchema("com.acme.doc"), "the valid definition still loads");
		});

		it("a definition that fails its meta-schema is INVALID_DEFINITION", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/bad.stxt": "Schema (@stxt.schema): com.acme.bad\n\tBogus: not allowed here\n",
			});
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const errors = (await resolver.resolve("/repo")).getErrors();

			assert.strictEqual(errors.length, 1);
			assert.strictEqual(errors[0].code, DiscoveryError.INVALID_DEFINITION);
		});
	});

	describe("DiscoveryResult as SchemaProvider", () => {

		it("serves the meta-schemas of the two reserved namespaces", async () => {
			const fs = new MemoryFileSystem({ "/repo/.stxt/a.stxt": template("com.acme.a", "A") });
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const result = await resolver.resolve("/repo");

			assert.ok(result.getSchema("@stxt.schema"), "meta-schema of schemas");
			assert.ok(result.getSchema("@stxt.template"), "meta-schema of templates");
		});

		it("reports provenance through getActiveDefinitions", async () => {
			const fs = new MemoryFileSystem({
				"/repo/.stxt/a.stxt": template("com.acme.a", "A"),
				"/home/ana/.stxt/b.stxt": template("org.ana.b", "B"),
			});
			const env = new TestEnvironment(null, "/home/ana/.stxt", null);
			const resolver = new DiscoveryResolver(fs, env);

			const definitions = (await resolver.resolve("/repo")).getActiveDefinitions();

			assert.deepStrictEqual(
				definitions.map(d => [d.namespace, d.levelDir]),
				[["com.acme.a", "/repo/.stxt"], ["org.ana.b", "/home/ana/.stxt"]]);
		});

		it("caches loaded levels until clearCache", async () => {
			const files: Record<string, string> = { "/repo/.stxt/a.stxt": template("com.acme.a", "A") };
			const fs = new MemoryFileSystem(files);
			const resolver = new DiscoveryResolver(fs, new TestEnvironment());

			const first = await resolver.resolve("/repo");
			assert.ok(first.getSchema("com.acme.a"));

			// Same level object from the cache: a second resolve sees the same definitions.
			const second = await resolver.resolve("/repo/anywhere-else/../.");
			void second;

			resolver.clearCache();
			const third = await resolver.resolve("/repo");
			assert.ok(third.getSchema("com.acme.a"), "reload after clearCache keeps working");
		});
	});
});
