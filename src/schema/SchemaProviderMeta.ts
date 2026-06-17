import { Schema } from "./Schema";
import { SchemaProvider } from "./SchemaProvider";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { ValidationException } from "../exceptions/ValidationException";
import { RuntimeException } from "../exceptions/RuntimeException";
import { transformNodeToSchema } from "./SchemaParser";

export class SchemaProviderMeta implements SchemaProvider {
    private static readonly META_TEXT = `Schema (@stxt.schema): @stxt.schema
    Node: Schema
        Children:
            Child: Description
                Max: 1
            Child: Node
                Min: 1
    Node: Node
        Children:
            Child: Type
                Max: 1
            Child: Children
                Max: 1
            Child: Description
                Max: 1
            Child: Values
                Max: 1
    Node: Children
        Type: GROUP
        Children:
            Child: Child
                Min: 1
    Node: Description
        Type: TEXT
    Node: Child
        Children:
            Child: Min
                Max: 1
            Child: Max
                Max: 1
    Node: Min
        Type: NATURAL
    Node: Max
        Type: NATURAL
    Node: Type
        Type: ENUM
        Values:
            Value: INLINE
            Value: BLOCK
            Value: TEXT
            Value: BOOLEAN
            Value: URL
            Value: INTEGER
            Value: NATURAL
            Value: NUMBER
            Value: DATE
            Value: TIMESTAMP
            Value: EMAIL
            Value: HEXADECIMAL
            Value: BASE64
            Value: GROUP
            Value: ENUM
    Node: Values
        Children:
            Child: Value
                Min: 1
    Node: Value
`;

    private readonly meta: Schema;

    constructor() {
        const parser = new Parser();
        const nodes: Node[] = parser.parse(SchemaProviderMeta.META_TEXT);

        if (nodes.length !== 1) {
            throw new ValidationException(0, "META_SCHEMA_INVALID", `Meta schema must produce exactly 1 document, got ${nodes.length}`);
        }

        this.meta = transformNodeToSchema(nodes[0]);
    }

    getSchema(namespace: string): Schema {
        if (namespace !== Schema.SCHEMA_NAMESPACE) {
            throw new RuntimeException("RESOURCE_NOT_FOUND", `Not found '${namespace}' in namespace: ${Schema.SCHEMA_NAMESPACE}`);
        }

        if (!this.meta) {
            throw new ValidationException(0, "META_SCHEMA_NOT_AVAILABLE", "Meta schema not available");
        }

        return this.meta;
    }
}
