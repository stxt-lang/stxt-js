import { StringUtils } from "../core/StringUtils";
import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";
import { DiscoveryError } from "./DiscoveryError";

/**
 * An active definition: a schema or template that won the per-namespace precedence for a
 * document's resolution chain, together with where it came from.
 */
export interface DiscoveryDefinition {
    /** Target namespace of the definition, as written in the definition document. */
    namespace: string;
    /** The compiled schema (templates are compiled to schemas at load time). */
    schema: Schema;
    /** Full path of the file the definition was read from. */
    file: string;
    /** Resolution directory (level) the file belongs to. */
    levelDir: string;
}

/**
 * A loaded resolution directory: its definitions indexed by lowercased target namespace.
 * Namespaces in conflict inside the level (spec 8.1) are excluded from the map.
 */
export interface DiscoveryLevel {
    /** Full path of the resolution directory. */
    dir: string;
    /** Definitions of the level by lowercased target namespace, conflicts excluded. */
    definitions: Map<string, DiscoveryDefinition>;
    /** Namespaces with a same-level conflict; they block fallback to farther levels. */
    conflictedNamespaces: Set<string>;
    /** Resolution errors found while loading this level. */
    errors: DiscoveryError[];
}

/**
 * The outcome of resolving a document's definitions (STXT-DISCOVERY-SPEC): the chain of
 * levels, the active definition per namespace (nearest level wins) and every resolution
 * error found along the way.
 *
 * It implements {@link SchemaProvider}, so it can be handed directly to a
 * `SchemaValidator`/`ConditionalValidator` to validate the document it was resolved for.
 * Like `UnifiedSchemaProvider`, it serves the meta-schemas of the two reserved namespaces
 * itself, so schema and template documents also validate against it.
 */
export class DiscoveryResult implements SchemaProvider {
    /**
     * Creates a result. Built by {@link DiscoveryResolver}; not meant to be constructed
     * directly.
     *
     * @param levels loaded levels of the chain, highest precedence first.
     * @param schemaMeta provider of the @stxt.schema meta-schema.
     * @param templateMeta provider of the @stxt.template meta-schema.
     */
    constructor(
        private readonly levels: ReadonlyArray<DiscoveryLevel>,
        private readonly schemaMeta: SchemaProvider,
        private readonly templateMeta: SchemaProvider
    ) {}

    /**
     * Resolves the schema that applies to a namespace: the meta-schemas for the two
     * reserved namespaces, and otherwise the active definition of the nearest level.
     *
     * @param namespace namespace whose schema is wanted.
     * @returns the schema of the namespace, or null if the chain has no definition for it.
     */
    getSchema(namespace: string): Schema | null | undefined {
        if (namespace === "@stxt.template") {
            return this.templateMeta.getSchema(namespace);
        } else if (namespace === "@stxt.schema") {
            return this.schemaMeta.getSchema(namespace);
        }

        return this.getDefinition(namespace)?.schema ?? null;
    }

    /**
     * The active definition of a namespace: the one from the nearest level that defines it
     * (STXT-DISCOVERY-SPEC section 5), with its provenance.
     *
     * @param namespace namespace whose definition is wanted.
     * @returns the active definition, or undefined if the chain has none for the namespace.
     */
    getDefinition(namespace: string): DiscoveryDefinition | undefined {
        const key = StringUtils.lowerCase(namespace);

        for (const level of this.levels) {
            // STXT-DISCOVERY-SPEC section 8: a closer conflict leaves the namespace
            // without an active definition instead of falling back to a farther level.
            if (level.conflictedNamespaces.has(key)) {
                return undefined;
            }

            const definition = level.definitions.get(key);

            if (definition) {
                return definition;
            }
        }

        return undefined;
    }

    /**
     * Every active definition of the chain, with per-namespace precedence already applied:
     * one entry per namespace, from its nearest defining level.
     *
     * @returns the active definitions, ordered by level (nearest level's definitions first).
     */
    getActiveDefinitions(): ReadonlyArray<DiscoveryDefinition> {
        const seen = new Set<string>();
        const result: DiscoveryDefinition[] = [];

        for (const level of this.levels) {
            // Mark conflicts as seen so getActiveDefinitions() has the same semantics
            // as getDefinition(): they block definitions in farther levels.
            for (const key of level.conflictedNamespaces) {
                seen.add(key);
            }

            for (const [key, definition] of level.definitions) {
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(definition);
                }
            }
        }

        return result;
    }

    /**
     * Every active schema of the chain (the schemas of {@link getActiveDefinitions}).
     *
     * @returns the active schemas, ordered by level (nearest level's schemas first).
     */
    getAllSchemas(): ReadonlyArray<Schema> {
        return this.getActiveDefinitions().map(definition => definition.schema);
    }

    /**
     * The resolution chain: the loaded level directories, highest precedence first.
     *
     * @returns the directories of the chain, in precedence order.
     */
    getChain(): ReadonlyArray<string> {
        return this.levels.map(level => level.dir);
    }

    /**
     * Every resolution error found while loading the chain (STXT-DISCOVERY-SPEC section 8).
     *
     * @returns the errors, ordered by level and then by file.
     */
    getErrors(): ReadonlyArray<DiscoveryError> {
        const result: DiscoveryError[] = [];

        for (const level of this.levels) {
            result.push(...level.errors);
        }

        return result;
    }
}
