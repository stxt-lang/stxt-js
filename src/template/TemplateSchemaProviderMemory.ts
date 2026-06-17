// TemplateSchemaProvider.ts

import { Parser } from "../core/Parser";
import { Node } from "../core/Node";

import { SchemaValidator } from "../schema/SchemaValidator";
import { ValidationException } from "../exceptions/ValidationException";

import { MetaTemplateSchemaProvider } from "./MetaTemplateSchemaProvider";
import { SchemaProviderMemory } from "../schema/SchemaProviderMemory";
import { SchemaProvider } from "../schema/SchemaProvider";
import { transformTemplateNodeToSchema } from "./TemplateParser";

export class TemplateSchemaProviderMemory extends SchemaProviderMemory {
    
    constructor(parent?: SchemaProvider | null | undefined) {
        if (!parent) {
            parent = new MetaTemplateSchemaProvider();
        }
        super(parent);
    }

    addTemplate(template: string): void {
        const parser = new Parser();

        const nodes: Node[] = parser.parse(template);
        if (nodes.length !== 1) {
            throw new ValidationException(0, "INVALID_SCHEMA", `There are ${nodes.length}, and expected is 1`);
        }

        // Validamos el template contra el meta-schema de templates
        const schemaValidator = new SchemaValidator(new MetaTemplateSchemaProvider(), true);
        schemaValidator.validate(nodes[0]);

        // Generamos schema desde el template
        const sch = transformTemplateNodeToSchema(nodes[0]);

        // Check mínimo de seguridad (en Java también se controlaba el namespace esperado)
        if (!sch.getNamespace() || sch.getNamespace().trim().length === 0) {
            throw new ValidationException(0, "INVALID_SCHEMA", "Schema namespace is empty");
        }

        this.schemas.set(sch.getNamespace(), sch);
    }
}
