import { Parser } from "../core/Parser";
import { Node } from "../core/Node";

import { Schema } from "../schema/Schema";
import { SchemaProvider } from "../schema/SchemaProvider";

import { ValidationException } from "../exceptions/ValidationException";
import { RuntimeException } from "../exceptions/RuntimeException";
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
	 * @param namespace namespace whose schema is wanted; only `@stxt.template` is served.
	 * @returns the meta-schema of the template language.
	 * @throws RuntimeException with code `RESOURCE_NOT_FOUND` if any other namespace is asked for.
	 */
	getSchema(namespace: string): Schema {
		if (namespace !== "@stxt.template") {
			throw new RuntimeException("RESOURCE_NOT_FOUND", `Not found '${namespace}' in namespace: @stxt.template`);
		}

		// meta always exists once the constructor finished, but this mirrors the Java version
		if (!this.meta) {
			throw new ValidationException(0, "META_SCHEMA_NOT_AVAILABLE", "Meta schema not available");
		}

		return this.meta;
	}
}
