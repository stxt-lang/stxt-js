import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { Schema } from "./Schema";
import { transformNodeToSchema } from "./SchemaParser";
import { SchemaProvider } from "./SchemaProvider";
import { SchemaProviderMeta } from "./SchemaProviderMeta";
import { SchemaValidator } from "./SchemaValidator";

/**
 * In-memory {@link SchemaProvider}: it keeps the schemas added with {@link SchemaProviderMemory.addSchema}
 * indexed by namespace, and falls back to a parent provider (the meta-schema by default) for the
 * namespaces it does not know.
 */
export class SchemaProviderMemory implements SchemaProvider {
    private readonly parentSchema: SchemaProvider;

    /**
     * Creates an empty provider.
     *
     * @param parent provider to fall back to when a namespace is not registered here; the
     *        meta-schema provider when omitted.
     */
    constructor(parent?: SchemaProvider | null | undefined) {
        if (!parent) {
            this.parentSchema = new SchemaProviderMeta();
        } else {
            this.parentSchema = parent;
        }
    }

    protected readonly schemas: Map<string, Schema> = new Map();

    /**
     * Resolves the schema that applies to a namespace, delegating to the parent provider when it
     * is not registered here.
     *
     * @param namespace namespace whose schema is wanted.
     * @returns the schema of the namespace, or null/undefined if neither this provider nor its parent has one.
     */
    getSchema(namespace: string): Schema | undefined | null {
        const key = StringUtils.lowerCase(namespace);

        let result: Schema | undefined | null = this.schemas.get(key);
        if (!result) {
            result = this.parentSchema.getSchema(namespace);
        }
        return result;
    }

    /**
     * Parses a schema document, validates it against the meta-schema and registers it under its
     * own namespace.
     *
     * @param txt text of the `@stxt.schema` document.
     * @throws ParseException or ValidationException if the document is not a valid schema.
     */
    addSchema(txt: string): void {
        const parser: Parser = new Parser();
        const node: Node = parser.parse(txt)[0];
        const schema: Schema = transformNodeToSchema(node);

        const schemaValidator = new SchemaValidator(new SchemaProviderMeta(), true);
        schemaValidator.validate(node);

        const key = schema.getNamespace();
        this.schemas.set(key, schema);
    }

    /** Removes every schema registered in this provider (the parent one is left untouched). */
    clear(): void {
        this.schemas.clear();
    }

    /** @returns every schema registered in this provider, in registration order. */
    getAllSchemas(): ReadonlyArray<Schema> {
        return Array.from(this.schemas.values());
    }
}
