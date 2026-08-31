import { Parser } from "../core/Parser";
import { Node } from "../core/Node";

import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";

import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { transformTemplateNodeToSchema } from "./TemplateParser";

/**
 * {@link SchemaProvider} that defines in code the meta-schema of the template language itself
 * (`@stxt.template`), so that a loaded template can validate itself.
 */
export class MetaTemplateSchemaProvider implements SchemaProvider {
	private static readonly META_TEXT = `Template (@stxt.template): @stxt.template
\tStructure >>
\t\tTemplate (@stxt.template):
\t\t\tDescription: (?) TEXT
\t\t\tStructure: (1) BLOCK
`;

	/** Compiled once per process and shared between instances, exactly like {@link SchemaProviderMeta}. */
	private static compiledMeta: Schema | undefined;

	private readonly meta: Schema;

	/**
	 * Compiles the meta-template the first time and keeps the schema it produces ready to be served.
	 *
	 * @throws ValidationException with code `META_SCHEMA_INVALID` if the meta-template does not produce exactly one document.
	 */
	constructor() {
		if (!MetaTemplateSchemaProvider.compiledMeta) {
			const parser = new Parser();
			const nodes: Node[] = parser.parse(MetaTemplateSchemaProvider.META_TEXT);

			if (nodes.length !== 1) {
				throw new ValidationException(
					ParseException.NO_LINE,
					"META_SCHEMA_INVALID",
					`Meta schema must produce exactly 1 document, got ${nodes.length}`
				);
			}

			MetaTemplateSchemaProvider.compiledMeta = transformTemplateNodeToSchema(nodes[0]);
		}

		this.meta = MetaTemplateSchemaProvider.compiledMeta;
	}

	/**
	 * Serves the meta-schema of the template language.
	 *
	 * Follows the {@link SchemaProvider} contract: providers never throw "not found". Any
	 * namespace other than `@stxt.template` yields `null`; only the `SchemaValidator`
	 * reports `SCHEMA_NOT_FOUND`.
	 *
	 * @param namespace namespace whose schema is wanted; only `@stxt.template` is served.
	 * @returns the meta-schema of the template language, or `null` for any other namespace.
	 */
	getSchema(namespace: string): Schema | null {
		if (namespace !== Schema.TEMPLATE_NAMESPACE) {
			return null;
		}

		return this.meta;
	}
}
