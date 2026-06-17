import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";
import { SchemaProviderMeta } from "../schema/SchemaProviderMeta";
import { transformNodeToSchema } from "../schema/SchemaParser";
import { SchemaValidator } from "../schema/SchemaValidator";
import { MetaTemplateSchemaProvider } from "../template/MetaTemplateSchemaProvider";
import { transformTemplateNodeToSchema } from "../template/TemplateParser";

/**
 * Provider unificado que maneja tanto schemas como templates.
 * Detecta automáticamente el tipo según el namespace del nodo raíz:
 * - @stxt.template => procesa como template
 * - @stxt.schema => procesa como schema
 * - otros => no hace nada
 */
export class UnifiedSchemaProvider implements SchemaProvider {
    private readonly schemas: Map<string, Schema> = new Map();
    private readonly schemaMeta: SchemaProvider;
    private readonly templateMeta: SchemaProvider;

    constructor() {
        this.schemaMeta = new SchemaProviderMeta();
        this.templateMeta = new MetaTemplateSchemaProvider();
    }

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
        // Validar contra el meta-schema de templates
        const schemaValidator = new SchemaValidator(this.templateMeta, true);
        schemaValidator.validate(node);

        // Transformar el template a schema
        const schema: Schema = transformTemplateNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());
        
        this.schemas.set(key, schema);
    }

    private addSchemaNode(node: Node): void {
        // Validar contra el meta-schema de schemas
        const schemaValidator = new SchemaValidator(this.schemaMeta, true);
        schemaValidator.validate(node);

        // Transformar el nodo a schema
        const schema: Schema = transformNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());
        
        this.schemas.set(key, schema);
    }

    clear(): void {
        this.schemas.clear();
    }

    getAllSchemas(): ReadonlyArray<Schema> {
        return Array.from(this.schemas.values());
    }
}
