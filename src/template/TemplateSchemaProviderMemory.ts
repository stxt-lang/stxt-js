import { compileDefinitionDocument } from "../schema/DefinitionCompiler";
import { MetaTemplateSchemaProvider } from "./MetaTemplateSchemaProvider";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaProvider } from "../schema/SchemaProvider";
import { transformTemplateNodeToSchema } from "./TemplateParser";

/**
 * In-memory {@link SchemaProvider} fed with `@stxt.template` documents: each template is turned
 * into its equivalent {@link Schema} and registered under its own namespace.
 */
export class TemplateSchemaProviderMemory extends SchemaProviderMemory {

	/**
	 * Creates an empty provider.
	 *
	 * @param parent provider to fall back to when a namespace is not registered here; the
	 *        template meta-schema provider when omitted.
	 */
	constructor(parent?: SchemaProvider | null | undefined) {
		if (!parent) {
			parent = new MetaTemplateSchemaProvider();
		}
		super(parent);
	}

	/**
	 * Parses a template document, validates it against the template meta-schema and registers the
	 * schema it produces.
	 *
	 * @param template text of the `@stxt.template` document.
	 * @throws ValidationException with code `TEMPLATE_MULTIPLE_ROOTS` if the document does not hold
	 *         exactly one root node, `TEMPLATE_ROOT_NOT_VALID` or `TEMPLATE_NAMESPACE_EMPTY` if that
	 *         root is not `Template (@stxt.template): ns`, or the first validation error if the
	 *         template does not validate against the template meta-schema.
	 */
	addTemplate(template: string): void {
		const schema = compileDefinitionDocument(template, new MetaTemplateSchemaProvider(), transformTemplateNodeToSchema, "TEMPLATE_MULTIPLE_ROOTS", "template");

		this.schemas.set(schema.getNamespace(), schema);
	}
}
