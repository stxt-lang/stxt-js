import { Schema } from "./Schema";
import { NodeDefinition } from "./NodeDefinition";
import { ChildDefinition } from "./ChildDefinition";
import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { NamespaceValidator } from "../core/NamespaceValidator";
import { StringUtils } from "../core/StringUtils";
import { NameNamespaceParser } from "../core/NameNamespaceParser";
import { TypeRegistry } from "./TypeRegistry";

/**
 * Turns the tree of an already parsed `@stxt.schema` document into a {@link Schema}.
 *
 * @param node root node of the schema document, `Schema (@stxt.schema): ...`.
 * @returns the schema the document defines.
 * @throws ValidationException with `SCHEMA_ROOT_NOT_VALID`, `SCHEMA_NAMESPACE_EMPTY`, `SCHEMA_NODE_NOT_INLINE`
 *         or the code of the first rule of the schema language the document breaks, if the document is not a valid `@stxt.schema` one.
 */
export function transformNodeToSchema(node: Node): Schema {
	// Node name
	const nodeName = node.getCanonicalName();
	const namespaceSchema = node.getNamespace();

	// Get the name and the namespace
	if (nodeName !== "schema" || namespaceSchema !== Schema.SCHEMA_NAMESPACE) {
		throw new ValidationException(node.getLine(), "SCHEMA_ROOT_NOT_VALID", `Expected schema(${Schema.SCHEMA_NAMESPACE}) but got ${nodeName}(${namespaceSchema})`);
	}
	const root = inline(node);

	// The target namespace: required, and with a valid format. The value arrives already
	// trimmed of language blanks by the parser; any other whitespace (NBSP...) is content
	// and must fall through to the format check, exactly as in the other ports.
	const targetNamespace = StringUtils.lowerCase(root.getValue());
	if (!targetNamespace) {
		throw new ValidationException(root.getLine(), "SCHEMA_NAMESPACE_EMPTY", "Schema namespace is empty");
	}
	if (!NamespaceValidator.isValid(targetNamespace)) {
		throw new ValidationException(root.getLine(), "SCHEMA_ROOT_NOT_VALID", `Schema namespace not valid: ${targetNamespace}`);
	}

	// Get the description
	const descrip = root.getChild("description")?.getText();

	const schema = new Schema(targetNamespace, root.getLine(), descrip);

	// Used to check that every child is defined
	const allNames = new Set<string>();

	// Get the nodes
	for (const n of root.getChildrenByName("node")) {
		const schNode = createFrom(n, schema.getNamespace());
		schema.addNodeDefinition(schNode);
		allNames.add(schNode.getCanonicalName());
	}

	// Check that every name is defined
	for (const schNode of schema.getNodes().values()) {
		for (const schChild of schNode.getChildren().values()) {
			// Only names of the same namespace are checked
			if (schChild.getNamespace() === schema.getNamespace()) {
				const childNorm = schChild.getCanonicalName();

				if (!allNames.has(childNorm)) {
					throw new ValidationException(ParseException.NO_LINE, "CHILD_NOT_DEFINED", `Child ${childNorm} not defined in ${schema.getNamespace()}`);
				}
			}
		}
	}

	return schema;
}

/** The schema language is written with inline nodes; anything else is not a schema. */
function inline(node: Node): InlineNode {
	if (node instanceof InlineNode) {
		return node;
	}
	throw new ValidationException(node.getLine(), "SCHEMA_NODE_NOT_INLINE", `Node '${node.getName()}' must be inline in a schema`);
}

/** Builds the definition of a node from a `Node:` entry of the schema document. */
function createFrom(node: Node, namespace: string): NodeDefinition {
	const n = inline(node);
	const name = n.getValue();

	let type = "INLINE";
	const typeNode = n.getChild("type");
	if (typeNode) {
		type = typeNode.getText();
	}
	const description = n.getChild("description")?.getText();

	const result = new NodeDefinition(name, type, n.getLine(), description);

	const children = n.getChild("children");
	if (children) {
		// Schema error 13.5: Children in a Node whose type does not admit children
		if (!TypeRegistry.admitsChildren(type)) {
			throw new ValidationException(children.getLine(), "CHILDREN_NOT_ALLOWED_FOR_TYPE", `Type ${type} does not allow children (node ${name})`);
		}
		for (const child of inline(children).getChildrenByName("child")) {
			putChildToSchemaNode(result, child, namespace);
		}
	}

	// Allowed values: only valid for the ENUM type
	const valuesNodes = n.getChildrenByName("values"); // the "Values:" containers
	let valueEntries: ReadonlyArray<Node> = [];        // the "Value:" entries inside
	if (valuesNodes && valuesNodes.length > 0) {
		if (type !== "ENUM") {
			throw new ValidationException(n.getLine(), "VALUES_NOT_ALLOWED_FOR_TYPE", `Values only supported for type ENUM, not for type ${type}`);
		}

		if (valuesNodes.length > 1) {
			throw new ValidationException(valuesNodes[1].getLine(), "VALUES_DUPLICATED", `Node '${n.getValue()}' defines 'Values' ${valuesNodes.length} times`);
		}

		valueEntries = inline(valuesNodes[0]).getChildrenByName("value");
		for (const v of valueEntries) {
			// An empty Value: is a schema error (STXT-SCHEMA-SPEC 7.2, condition 14 of section 13):
			// an enumeration whose only valid value is the empty string makes no sense
			if (v.getText().length === 0) {
				throw new ValidationException(v.getLine(), "VALUE_EMPTY", "Value of ENUM cannot be empty");
			}
			result.addValue(v.getText(), v.getLine());
		}
	}

	// An ENUM must declare at least one value (a "Values:" with no entries included)
	if (type === "ENUM" && valueEntries.length === 0) {
		throw new ValidationException(n.getLine(), "VALUES_REQUIRED", "ENUM Type must include values");
	}

	return result;
}

/** Adds to a node definition the expected child a `Child:` entry declares. */
function putChildToSchemaNode(schemaNode: NodeDefinition, childNode: Node, defNamespace: string): void {
	const child = inline(childNode);

	// Get the name and the namespace
	const ns = NameNamespaceParser.parse(child.getValue(), defNamespace, child.getLine(), child.getValue());
	const name = ns.getName();
	const namespace = ns.getNamespace();

	const min = getInteger(child, "min");
	const max = getInteger(child, "max");

	// Invalid cardinality when Min > Max (STXT-SCHEMA-SPEC 10 and 13.7)
	if (min !== null && max !== null && min > max) {
		throw new ValidationException(child.getLine(), "MIN_GREATER_THAN_MAX", `Min ${min} greater than Max ${max}`);
	}

	const schemaChild = new ChildDefinition(name, namespace, min, max, child.getLine());
	schemaNode.addChildDefinition(schemaChild);
}

/** Reads an integer child (`Min`, `Max`) of a node, or null when it is not there. */
function getInteger(node: InlineNode, name: string): number | null {
	const n = node.getChild(name);
	if (!n) {
		return null;
	}

	const raw = n.getText();
	const parsed = Number.parseInt(raw, 10);

	if (Number.isNaN(parsed)) {
		throw new ValidationException(node.getLine(), "CARDINALITY_NOT_VALID", `Integer not valid: ${raw}`);
	}

	return parsed;
}
