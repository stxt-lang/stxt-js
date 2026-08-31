import { Schema } from "./Schema";
import { SchemaProvider } from "./SchemaProvider";
import { Parser } from "../core/Parser";
import { Node } from "../core/Node";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { transformNodeToSchema } from "./SchemaParser";

/**
 * {@link SchemaProvider} that defines in code the meta-schema of the schema language itself
 * (`@stxt.schema`), so that a loaded schema can validate itself.
 */
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
            Value: TIME
            Value: TIMESTAMP
            Value: UUID
            Value: EMAIL
            Value: HEXADECIMAL
            Value: BINARY
            Value: BASE64
            Value: GROUP
            Value: ENUM
            Value: MARKDOWN
    Node: Values
        Type: GROUP
        Children:
            Child: Value
                Min: 1
    Node: Value
`;

	/**
	 * The meta-schema is immutable, so it is compiled once per process, lazily, and every
	 * instance serves this same schema (constructing these providers is common: every
	 * `addSchema()` and every discovery compilation builds one).
	 */
	private static compiledMeta: Schema | undefined;

	private readonly meta: Schema;

	/**
	 * Compiles the meta-schema the first time and keeps it ready to be served.
	 *
	 * @throws ValidationException with code `META_SCHEMA_INVALID` if the meta-schema does not produce exactly one document.
	 */
	constructor() {
		if (!SchemaProviderMeta.compiledMeta) {
			const parser = new Parser();
			const nodes: Node[] = parser.parse(SchemaProviderMeta.META_TEXT);

			if (nodes.length !== 1) {
				throw new ValidationException(ParseException.NO_LINE, "META_SCHEMA_INVALID", `Meta schema must produce exactly 1 document, got ${nodes.length}`);
			}

			SchemaProviderMeta.compiledMeta = transformNodeToSchema(nodes[0]);
		}

		this.meta = SchemaProviderMeta.compiledMeta;
	}

	/**
	 * Serves the meta-schema of the schema language.
	 *
	 * Follows the {@link SchemaProvider} contract: providers never throw "not found". Any
	 * namespace other than `@stxt.schema` yields `null`, so that this provider can sit at
	 * the end of a fallback chain (it is the default parent of {@link SchemaProviderMemory})
	 * and the {@link SchemaValidator} is the only one reporting `SCHEMA_NOT_FOUND`.
	 *
	 * @param namespace namespace whose schema is wanted; only `@stxt.schema` is served.
	 * @returns the meta-schema of the schema language, or `null` for any other namespace.
	 */
	getSchema(namespace: string): Schema | null {
		if (namespace !== Schema.SCHEMA_NAMESPACE) {
			return null;
		}

		return this.meta;
	}
}
