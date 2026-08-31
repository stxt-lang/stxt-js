import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { Schema } from "./Schema";
import { SchemaProvider } from "./SchemaProvider";
import { SchemaValidator } from "./SchemaValidator";

/*
 * The one pipeline every definition loader shares, whatever the store: the in-memory
 * providers (a document each), UnifiedSchemaProvider (several roots per file) and
 * discovery. A definition node is validated against the meta-schema of its kind and,
 * only when valid, transformed into a Schema; a definition that does not validate is
 * never registered anywhere — the first validation finding is thrown instead.
 * Mirrors stxt-impl/schema/definition_compiler.txt.
 */

/**
 * Validates one root node against the meta provider of its kind and compiles it into a
 * {@link Schema}.
 *
 * @param node root node of the definition (`Schema (@stxt.schema)` or `Template (@stxt.template)`).
 * @param meta provider of the meta-schema of the kind.
 * @param transform function that turns the validated node into a Schema.
 * @returns the compiled schema.
 * @throws ValidationException the first validation finding, if the node does not validate.
 */
export function compileDefinitionNode(node: Node, meta: SchemaProvider, transform: (node: Node) => Schema): Schema {
	const errors = new SchemaValidator(meta, true).validate(node);

	if (errors.length > 0) {
		throw errors[0];
	}

	return transform(node);
}

/**
 * Parses a whole document that must hold exactly one definition, and compiles it.
 *
 * @param text text of the definition document.
 * @param meta provider of the meta-schema of the kind.
 * @param transform function that turns the validated root into a Schema.
 * @param multipleRootsCode error code when the document does not hold exactly one root
 *        (`SCHEMA_MULTIPLE_ROOTS` for schemas, `TEMPLATE_MULTIPLE_ROOTS` for templates).
 * @param kind word naming the kind in the error message (`schema` or `template`).
 * @returns the compiled schema.
 * @throws ParseException or ValidationException if the document is not a valid definition.
 */
export function compileDefinitionDocument(
	text: string,
	meta: SchemaProvider,
	transform: (node: Node) => Schema,
	multipleRootsCode: string,
	kind: string
): Schema {
	const nodes: Node[] = new Parser().parse(text);

	if (nodes.length !== 1) {
		throw new ValidationException(ParseException.NO_LINE, multipleRootsCode, `A ${kind} document must hold exactly 1 root node, got ${nodes.length}`);
	}

	return compileDefinitionNode(nodes[0], meta, transform);
}
