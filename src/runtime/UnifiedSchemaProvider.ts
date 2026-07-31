import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";
import { SchemaProviderMeta } from "../schema/SchemaProviderMeta";
import { transformNodeToSchema } from "../schema/SchemaParser";
import { SchemaValidator } from "../schema/SchemaValidator";
import { ValidationException } from "../exceptions/ValidationException";
import { MetaTemplateSchemaProvider } from "../template/MetaTemplateSchemaProvider";
import { transformTemplateNodeToSchema } from "../template/TemplateParser";

/**
 * Unified provider that handles both schemas and templates.
 * It detects which one it is from the namespace of the root node:
 * - @stxt.template => processed as a template
 * - @stxt.schema => processed as a schema
 * - anything else => ignored
 */
export class UnifiedSchemaProvider implements SchemaProvider {
    private readonly schemas: Map<string, Schema> = new Map();
    private readonly schemaMeta: SchemaProvider;
    private readonly templateMeta: SchemaProvider;

    /** Creates an empty provider, with the two meta-schemas already loaded. */
    constructor() {
        this.schemaMeta = new SchemaProviderMeta();
        this.templateMeta = new MetaTemplateSchemaProvider();
    }

    /**
     * Resolves the schema that applies to a namespace, serving the meta-schemas of the two
     * reserved namespaces itself.
     *
     * @param namespace namespace whose schema is wanted.
     * @returns the schema of the namespace, or null/undefined if none has been registered for it.
     */
    getSchema(namespace: string): Schema | undefined | null {
        const key = StringUtils.lowerCase(namespace);

        if (namespace === "@stxt.template") {
            return this.templateMeta.getSchema(key);
        } else if (namespace === "@stxt.schema") {
            return this.schemaMeta.getSchema(key);
        }

        let result: Schema | undefined | null = this.schemas.get(key);

        return result;
    }

    /**
     * Parses a document and registers every schema or template it defines, each one under its own
     * namespace. Documents of any other namespace are ignored.
     *
     * @param text text of the document to load.
     * @throws ParseException if the document cannot be parsed, or the first ValidationException if
     *         a schema or a template does not validate against its meta-schema.
     */
    addFile(text: string): void {
        const parser = new Parser();
        const nodes: Node[] = parser.parse(text);

        for (const node of nodes) {
            const namespace = node.getNamespace();

            if (namespace === "@stxt.template") {
                this.addTemplateNode(node);
            } else if (namespace === "@stxt.schema") {
                this.addSchemaNode(node);
            }
        }
    }

    private addTemplateNode(node: Node): void {
        // Validate against the meta-schema of templates
        const schemaValidator = new SchemaValidator(this.templateMeta, true);
        UnifiedSchemaProvider.throwIfInvalid(schemaValidator.validate(node));

        // Transform the template into a schema
        const schema: Schema = transformTemplateNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());

        this.schemas.set(key, schema);
    }

    private addSchemaNode(node: Node): void {
        // Validate against the meta-schema of schemas
        const schemaValidator = new SchemaValidator(this.schemaMeta, true);
        UnifiedSchemaProvider.throwIfInvalid(schemaValidator.validate(node));

        // Transform the node into a schema
        const schema: Schema = transformNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());

        this.schemas.set(key, schema);
    }

    // A schema/template that does not validate against its meta-schema must not be loaded
    private static throwIfInvalid(errors: ValidationException[]): void {
        if (errors.length > 0) {
            throw errors[0];
        }
    }

    /** Removes every schema and template registered in this provider. */
    clear(): void {
        this.schemas.clear();
    }

    /** @returns every schema registered in this provider, in registration order. */
    getAllSchemas(): ReadonlyArray<Schema> {
        return Array.from(this.schemas.values());
    }
}
