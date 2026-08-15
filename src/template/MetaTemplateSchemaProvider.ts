import { Parser } from "../core/Parser";
import { Node } from "../core/Node";

import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";

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

	private readonly meta: Schema;

	/**
	 * Parses the meta-template and keeps the schema it produces ready to be served.
	 *
	 * @throws ValidationException with code `META_SCHEMA_INVALID` if the meta-template does not produce exactly one document.
	 */
	constructor() {
		const parser = new Parser();
		const nodes: Node[] = parser.parse(MetaTemplateSchemaProvider.META_TEXT);

		if (nodes.length !== 1) {
			throw new ValidationException(
				0,
				"META_SCHEMA_INVALID",
				`Meta schema must produce exactly 1 document, got ${nodes.length}`
			);
		}

		this.meta = transformTemplateNodeToSchema(nodes[0]);
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
		if (namespace !== "@stxt.template") {
			return null;
		}

		// meta always exists once the constructor finished, but this mirrors the Java version
		if (!this.meta) {
			throw new ValidationException(0, "META_SCHEMA_NOT_AVAILABLE", "Meta schema not available");
		}

		return this.meta;
	}
}
