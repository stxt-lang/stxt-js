import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { ParseException } from "../exceptions/ParseException";
import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";
import { SchemaProviderMeta } from "../schema/SchemaProviderMeta";
import { SchemaValidator } from "../schema/SchemaValidator";
import { transformNodeToSchema } from "../schema/SchemaParser";
import { MetaTemplateSchemaProvider } from "../template/MetaTemplateSchemaProvider";
import { transformTemplateNodeToSchema } from "../template/TemplateParser";
import { DiscoveryEnvironment } from "./DiscoveryEnvironment";
import { DiscoveryError } from "./DiscoveryError";
import { DiscoveryEntry, DiscoveryFileSystem } from "./DiscoveryFileSystem";
import { DiscoveryDefinition, DiscoveryLevel, DiscoveryResult } from "./DiscoveryResult";

/** Options of a {@link DiscoveryResolver}. */
export interface DiscoveryOptions {
    /**
     * Maximum number of ancestor directories examined during the project-level ascent.
     * A safeguard against pathological paths (circular links, virtual file systems), as
     * allowed by STXT-DISCOVERY-SPEC section 4.1. Defaults to 32.
     */
    maxAscent?: number;
}

/** Name of the resolution directories (STXT-DISCOVERY-SPEC section 3). */
const STXT_DIR = ".stxt";

/** File extension of STXT documents. */
const STXT_EXTENSION = ".stxt";

/** Default value of {@link DiscoveryOptions.maxAscent}. */
const DEFAULT_MAX_ASCENT = 32;

/**
 * Maximum depth of the recursive descent through a resolution directory's subtree. An
 * internal safeguard (STXT-DISCOVERY-SPEC sections 3 and 10) against symlink loops and
 * pathological trees; not part of the public API.
 */
const DEFAULT_MAX_DESCENT = 32;

/**
 * Reference implementation of STXT-DISCOVERY-SPEC: builds the resolution chain of a
 * document (project ascent, user level, system level, or the `STXT_PATH` override), loads
 * every definition of every level and applies the per-namespace precedence.
 *
 * The resolver is host-agnostic: all file-system and environment access goes through the
 * injected {@link DiscoveryFileSystem} and {@link DiscoveryEnvironment}, so the same logic
 * serves a command line (Node `fs`), an editor (`vscode.workspace.fs`) or a test (an
 * in-memory tree).
 *
 * Loaded levels are cached by directory: resolving many documents that share levels loads
 * each directory once, which is the sharing that STXT-DISCOVERY-SPEC section 7 allows —
 * a level's content does not depend on which document is being resolved. Call
 * {@link clearCache} when the underlying files may have changed.
 */
export class DiscoveryResolver {
    private readonly maxAscent: number;
    private readonly schemaMeta: SchemaProvider = new SchemaProviderMeta();
    private readonly templateMeta: SchemaProvider = new MetaTemplateSchemaProvider();
    private readonly levelCache: Map<string, DiscoveryLevel> = new Map();

    /**
     * Creates a resolver.
     *
     * @param fs file-system access.
     * @param env environment access (`STXT_PATH`, user and system directories).
     * @param options optional settings.
     */
    constructor(
        private readonly fs: DiscoveryFileSystem,
        private readonly env: DiscoveryEnvironment,
        options?: DiscoveryOptions
    ) {
        this.maxAscent = options?.maxAscent ?? DEFAULT_MAX_ASCENT;
    }

    /**
     * Builds the resolution chain of a document (STXT-DISCOVERY-SPEC sections 4 and 6)
     * without loading any definition.
     *
     * @param documentDir directory containing the document, or null for a document with no
     *        file-system location (standard input, an unsaved buffer), whose chain starts
     *        at the user level.
     * @returns the existing resolution directories, highest precedence first.
     */
    async resolveChain(documentDir: string | null): Promise<string[]> {
        // STXT_PATH, when defined, completely replaces the chain (spec section 6).
        const stxtPath = this.env.getStxtPath();

        if (stxtPath !== null) {
            return this.existingUnique(stxtPath);
        }

        const chain: string[] = [];

        // Project level: every .stxt directory from the document's directory upward.
        if (documentDir !== null) {
            let dir: string | null = documentDir;

            for (let level = 0; level < this.maxAscent && dir !== null; level++) {
                const candidate = this.fs.join(dir, STXT_DIR);

                if (await this.fs.isDirectory(candidate)) {
                    chain.push(candidate);
                }

                dir = this.fs.parentOf(dir);
            }
        }

        // User and system levels. The ascent may have reached them already (a document
        // under the user's home finds $HOME/.stxt as a project candidate): deduplicate.
        const userDir = this.env.getUserLevelDir();
        const systemDir = this.env.getSystemLevelDir();

        for (const dir of [userDir, systemDir]) {
            if (dir !== null && !chain.includes(dir) && await this.fs.isDirectory(dir)) {
                chain.push(dir);
            }
        }

        return chain;
    }

    /**
     * Resolves the definitions applicable to a document: builds its chain, loads every
     * level (from the cache when already loaded) and returns the result with the
     * per-namespace precedence applied.
     *
     * @param documentDir directory containing the document, or null for a document with no
     *        file-system location.
     * @returns the resolution result, usable directly as a `SchemaProvider`.
     */
    async resolve(documentDir: string | null): Promise<DiscoveryResult> {
        const chain = await this.resolveChain(documentDir);
        const levels: DiscoveryLevel[] = [];

        for (const dir of chain) {
            levels.push(await this.loadLevel(dir));
        }

        return new DiscoveryResult(levels, this.schemaMeta, this.templateMeta);
    }

    /**
     * Empties the level cache, so that the next resolve re-reads every directory. Call it
     * when the definition files may have changed (e.g. from a file watcher).
     */
    clearCache(): void {
        this.levelCache.clear();
    }

    // Filters a list of directories down to the existing ones, removing duplicates.
    private async existingUnique(dirs: string[]): Promise<string[]> {
        const result: string[] = [];

        for (const dir of dirs) {
            if (!result.includes(dir) && await this.fs.isDirectory(dir)) {
                result.push(dir);
            }
        }

        return result;
    }

    // Loads a resolution directory (or returns it from the cache): every file under it,
    // recursively, with the level-local duplicate detection of spec section 5.
    private async loadLevel(dir: string): Promise<DiscoveryLevel> {
        const cached = this.levelCache.get(dir);

        if (cached) {
            return cached;
        }

        const level: DiscoveryLevel = { dir, definitions: new Map(), conflictedNamespaces: new Set(), errors: [] };

        for (const file of await this.collectFiles(dir)) {
            await this.loadFile(file, level);
        }

        this.levelCache.set(dir, level);
        return level;
    }

    // Collects every file under a directory, recursively, sorted by path so that results
    // and error messages do not depend on the listing order of the file system. The descent
    // is bounded by DEFAULT_MAX_DESCENT and tolerant of listing failures (STXT-DISCOVERY-SPEC
    // sections 3 and 10): a subdirectory that reaches the depth limit or cannot be listed
    // contributes no files, never an exception. Together with adapters that do not follow
    // directory symlinks, this stops symlink loops and pathological trees from turning
    // resolution into unbounded recursion or an escaping error.
    private async collectFiles(dir: string): Promise<string[]> {
        return this.collectFilesAt(dir, 0);
    }

    private async collectFilesAt(dir: string, depth: number): Promise<string[]> {
        const files: string[] = [];

        // Safeguard against symlink loops and pathological trees (spec section 10): stop
        // descending once the depth limit is reached.
        if (depth >= DEFAULT_MAX_DESCENT) {
            return files;
        }

        let entries: DiscoveryEntry[];

        try {
            entries = [...await this.fs.listDirectory(dir)].sort((a, b) => a.path < b.path ? -1 : 1);
        } catch {
            // A directory that cannot be listed contributes no files (spec section 3); it
            // does not stop the resolution of the rest of the level.
            return files;
        }

        for (const entry of entries) {
            if (entry.isDirectory) {
                files.push(...await this.collectFilesAt(entry.path, depth + 1));
            } else {
                files.push(entry.path);
            }
        }

        return files;
    }

    // Loads one file of a level: parses it and registers every root as a definition,
    // reporting the errors of spec section 8.
    private async loadFile(file: string, level: DiscoveryLevel): Promise<void> {
        // Spec section 3: every file under a resolution directory must be a definition.
        if (!file.endsWith(STXT_EXTENSION)) {
            level.errors.push(new DiscoveryError(
                DiscoveryError.NOT_A_DEFINITION, file,
                `Not an STXT definition file: ${file}`));
            return;
        }

        let nodes: Node[];

        try {
            nodes = new Parser().parse(await this.fs.readFile(file));
        } catch (e: unknown) {
            level.errors.push(new DiscoveryError(
                DiscoveryError.NOT_PARSEABLE, file,
                `Cannot parse ${file}: ${e instanceof Error ? e.message : String(e)}`));
            return;
        }

        if (nodes.length === 0) {
            level.errors.push(new DiscoveryError(
                DiscoveryError.NOT_A_DEFINITION, file,
                `Empty document, not a definition: ${file}`));
            return;
        }

        for (const node of nodes) {
            this.loadRootNode(node, file, level);
        }
    }

    // Validates one root node against its meta-schema, compiles it to a schema and
    // registers it in the level, detecting same-level duplicates.
    private loadRootNode(node: Node, file: string, level: DiscoveryLevel): void {
        const namespace = node.getNamespace();
        let schema: Schema;

        try {
            if (namespace === "@stxt.template") {
                schema = this.compile(node, this.templateMeta, transformTemplateNodeToSchema);
            } else if (namespace === "@stxt.schema") {
                schema = this.compile(node, this.schemaMeta, transformNodeToSchema);
            } else {
                level.errors.push(new DiscoveryError(
                    DiscoveryError.NOT_A_DEFINITION, file,
                    `Root node belongs to '${namespace ?? ""}', not to @stxt.schema or @stxt.template: ${file}`));
                return;
            }
        } catch (e: unknown) {
            const message = e instanceof ParseException ? `[${e.code}] ${e.message}` : String(e);
            level.errors.push(new DiscoveryError(
                DiscoveryError.INVALID_DEFINITION, file,
                `Invalid definition in ${file}: ${message}`));
            return;
        }

        const key = StringUtils.lowerCase(schema.getNamespace());
        const existing = level.definitions.get(key);

        // Spec section 8: on a same-level duplicate, never silently pick one of the
        // definitions — the namespace has no active definition while the conflict exists.
        if (level.conflictedNamespaces.has(key) || existing) {
            if (existing) {
                level.definitions.delete(key);
                level.conflictedNamespaces.add(key);
            }

            const firstFile = existing ? existing.file : "another file of this level";
            level.errors.push(new DiscoveryError(
                DiscoveryError.DUPLICATE_NAMESPACE, file,
                `Duplicate definition for namespace '${schema.getNamespace()}' at level ${level.dir}: ` +
                `already defined in ${firstFile}`,
                schema.getNamespace()));
            return;
        }

        const definition: DiscoveryDefinition = {
            namespace: schema.getNamespace(),
            schema,
            file,
            levelDir: level.dir,
        };

        level.definitions.set(key, definition);
    }

    // Validates a root node against a meta-schema and transforms it into a Schema,
    // throwing the first validation error (same policy as UnifiedSchemaProvider).
    private compile(node: Node, meta: SchemaProvider, transform: (node: Node) => Schema): Schema {
        const errors = new SchemaValidator(meta, true).validate(node);

        if (errors.length > 0) {
            throw errors[0];
        }

        return transform(node);
    }
}
