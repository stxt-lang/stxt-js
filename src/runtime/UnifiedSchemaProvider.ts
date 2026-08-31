import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { Schema } from "../schema/Schema";
import { compileDefinitionNode } from "../schema/DefinitionCompiler";
import { SchemaProvider } from "../schema/SchemaProvider";
import { SchemaProviderMeta } from "../schema/SchemaProviderMeta";
import { transformNodeToSchema } from "../schema/SchemaParser";
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

		if (key === Schema.TEMPLATE_NAMESPACE) {
			return this.templateMeta.getSchema(key);
		} else if (key === Schema.SCHEMA_NAMESPACE) {
			return this.schemaMeta.getSchema(key);
		}

		return this.schemas.get(key);
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

			if (namespace === Schema.TEMPLATE_NAMESPACE) {
				this.addNode(node, this.templateMeta, transformTemplateNodeToSchema);
			} else if (namespace === Schema.SCHEMA_NAMESPACE) {
				this.addNode(node, this.schemaMeta, transformNodeToSchema);
			}
		}
	}

	// Compiles a definition root through the shared pipeline (see DefinitionCompiler)
	// and registers it; a definition that does not validate is never registered.
	private addNode(node: Node, meta: SchemaProvider, transform: (node: Node) => Schema): void {
		const schema: Schema = compileDefinitionNode(node, meta, transform);

		this.schemas.set(StringUtils.lowerCase(schema.getNamespace()), schema);
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
