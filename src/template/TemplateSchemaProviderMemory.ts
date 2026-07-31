// TemplateSchemaProvider.ts

import { Parser } from "../core/Parser";
import { Node } from "../core/Node";

import { SchemaValidator } from "../schema/SchemaValidator";
import { ValidationException } from "../exceptions/ValidationException";

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
     * @throws ValidationException with code `INVALID_SCHEMA` if the document does not hold exactly
     *         one template, or if the resulting schema has no namespace.
     */
    addTemplate(template: string): void {
        const parser = new Parser();

        const nodes: Node[] = parser.parse(template);
        if (nodes.length !== 1) {
            throw new ValidationException(0, "INVALID_SCHEMA", `There are ${nodes.length}, and expected is 1`);
        }

        // Validate the template against the template meta-schema
        const schemaValidator = new SchemaValidator(new MetaTemplateSchemaProvider(), true);
        schemaValidator.validate(nodes[0]);

        // Build the schema out of the template
        const sch = transformTemplateNodeToSchema(nodes[0]);

        // Minimum safety check (Java checked the expected namespace here too)
        if (!sch.getNamespace() || sch.getNamespace().trim().length === 0) {
            throw new ValidationException(0, "INVALID_SCHEMA", "Schema namespace is empty");
        }

        this.schemas.set(sch.getNamespace(), sch);
    }
}
