import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { Parser } from "../core/Parser";
import { ValidationException } from "../exceptions/ValidationException";

import { ChildDefinition } from "../schema/ChildDefinition";
import { NodeDefinition } from "../schema/NodeDefinition";
import { Schema } from "../schema/Schema";

import { StringUtils } from "../core/StringUtils";

import { ChildLineParser } from "./ChildLineParser";
import { ChildLine } from "./ChildLine";
import { ParseException } from "../exceptions/ParseException";
import { TypeRegistry } from "../schema/TypeRegistry";
import { NamespaceValidator } from "../core/NamespaceValidator";

/** Namespace of the template language itself, `@stxt.template`. */
/** Namespace of the template language itself, `@stxt.template`. */
export const TEMPLATE_NAMESPACE = "@stxt.template";

/**
 * Turns the tree of an already parsed `@stxt.template` document into an equivalent {@link Schema}.
 *
 * @param node root of the already parsed `@stxt.template` document.
 * @returns the resulting {@link Schema}.
 * @throws ValidationException with `TEMPLATE_ROOT_NOT_VALID` or `TEMPLATE_NAMESPACE_EMPTY` if the root is
 *         not `Template (@stxt.template): ns`, or with the code of the rule the template breaks, with the
 *         line already shifted to the one of the original document.
 */
export function transformTemplateNodeToSchema(node: Node): Schema {
	// The root must be `Template (@stxt.template): ns`
	if (node.getCanonicalName() !== "template" || node.getNamespace() !== TEMPLATE_NAMESPACE) {
		throw new ValidationException(node.getLine(), "TEMPLATE_ROOT_NOT_VALID", `Expected template(${TEMPLATE_NAMESPACE}) but got ${node.getCanonicalName()}(${node.getNamespace()})`);
	}

	// The target namespace: required, and with a valid format
	const targetNamespace = StringUtils.lowerCase(node.getText());
	if (!targetNamespace || StringUtils.trim(targetNamespace).length === 0) {
		throw new ValidationException(node.getLine(), "TEMPLATE_NAMESPACE_EMPTY", "Template namespace is empty");
	}
	if (!NamespaceValidator.isValid(targetNamespace)) {
		throw new ValidationException(node.getLine(), "TEMPLATE_ROOT_NOT_VALID", `Template namespace not valid: ${targetNamespace}`);
	}

	// Set the namespace
	const result = new Schema(targetNamespace, node.getLine(), undefined);

	// Look for the structure node (a template is an inline root; a text root has none)
	const structure = node instanceof InlineNode ? node.getChild("structure") : null;
	if (!structure) {
		throw new ValidationException(node.getLine(), "TEMPLATE_STRUCTURE_REQUIRED", "Template must define 'Structure >>'");
	}

	const text = structure.getText();
	const offset = structure.getLine();

	// Build a plain parser
	const parser = new Parser();

	// Parse to get the nodes
	try {
		const nodes = parser.parse(text);
		// Walk every node adding it to the schema
		for (const n of nodes) {
			addToSchema(result, n);
		}
	} catch (e) {
		// ValidationException extends ParseException: check it first so the severity is not
		// downgraded (the extension paints ValidationException as a Warning)
		if (e instanceof ValidationException) {
			throw new ValidationException(e.line + offset, e.code, e.message);
		}
		if (e instanceof ParseException) {
			throw new ParseException(e.line + offset, e.code, e.message);
		}
		throw e;
	}

	// Look for the descriptions
	const description = (node as InlineNode).getChild("description");
	if (description) {
		const text = description.getText();
		try {
			const nodes = parser.parse(text);
			addDescriptions(result, nodes);
		} catch (e) {
			if (e instanceof ValidationException) {
				throw new ValidationException(e.line + description.getLine(), e.code, e.message);
			}
			if (e instanceof ParseException) {
				throw new ParseException(e.line + description.getLine(), e.code, e.message);
			}
			throw e;
		}
	}

	// Return the result
	return result;
}


/** Adds to the schema the definition a node of the structure declares, along with its children. */
function addToSchema(schema: Schema, node: Node): void {
	// A Structure line must use the template grammar's ':' form. The core parser
	// also accepts BLOCK nodes here, so reject them explicitly (STXT-TEMPLATE-SPEC 6.3).
	if (!(node instanceof InlineNode)) {
		throw new ValidationException(node.getLine(), "STRUCTURE_LINE_NOT_VALID", "Template Structure lines must use ':'");
	}

	// Get the qualified name
	let namespace = node.getNamespace();
	const name = node.getName();

	// Look at the data
	let cl: ChildLine = ChildLineParser.parse(node.getValue(), node.getLine());

	if (!namespace || namespace === "") {
		namespace = schema.getNamespace();
	}

	if (namespace !== schema.getNamespace()) {
		// An external node may only declare cardinality: no type, no ENUM values
		// and no children (STXT-TEMPLATE-SPEC 6.4, 10 and 14.15)
		const type = cl.getType();
		if (type && StringUtils.trim(type).length > 0) {
			throw new ValidationException(node.getLine(), "TYPE_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", "Not allowed type definition in external namespaces");
		}

		const values = cl.getValues();
		if (values) {
			throw new ValidationException(node.getLine(), "VALUES_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", `Not allowed values in external namespaces (node ${node.getName()})`);
		}

		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", `Not allowed children in external namespaces (node ${node.getName()})`);
		}

		// Nodes that do not belong to @stxt.template create nothing here!!
		return;
	}

	// Check whether it is new and add it to the list
	let schemaNode = schema.getNodeDefinition(name);

	if (!schemaNode) {
		// New one
		const type = cl.getType() ?? "INLINE";

		// At this point the schema already holds both the previous definitions, already closed,
		// and the open ancestors, so a reference that does not resolve here resolves to
		// nothing (STXT-TEMPLATE-SPEC 6.4 and 14.11)
		if (type.startsWith("@")) {
			throw new ValidationException(node.getLine(), "REFERENCE_NOT_FOUND", `Reference '${type}' does not point to a previous definition or an open ancestor`);
		}

		schemaNode = new NodeDefinition(node.getName(), type, node.getLine(), undefined);
		schema.addNodeDefinition(schemaNode);

		if (!TypeRegistry.get(type)) {
			throw new ValidationException(node.getLine(), "TYPE_NOT_VALID", `Type not valid: ${type}`);
		}

		const values = cl.getValues();
		if (values) {
			if (type !== "ENUM") {
				// Same code as SchemaParser: a template is sugar equivalent to a schema
				// (STXT-TEMPLATE-SPEC 13), so the same condition must not change its code
				// depending on the entry point
				throw new ValidationException(node.getLine(), "VALUES_NOT_ALLOWED_FOR_TYPE", `Values only supported for type ENUM, not for type ${type}`);
			}
			for (const v of values) {
				schemaNode.addValue(v, node.getLine());
			}
		}

		// An ENUM with no list of values is an invalid template (STXT-TEMPLATE-SPEC 9 and 13.7)
		if (type === "ENUM" && (!values || values.length === 0)) {
			throw new ValidationException(node.getLine(), "VALUES_REQUIRED", "ENUM Type must include values");
		}
	} else {
		const type = cl.getType();
		if (!type || !type.startsWith("@")) {
			throw new ValidationException(node.getLine(), "REFERENCE_REQUIRED", `Multiple node reference must start with @: ${node.getName()}`);
		}

		const reference = StringUtils.trim(type.substring(1));

		// Reference and explicit type on the same line (STXT-TEMPLATE-SPEC 14.13)
		const explicitType = referenceType(reference, node.getCanonicalName());
		if (explicitType) {
			throw new ValidationException(node.getLine(), "REFERENCE_WITH_TYPE_NOT_ALLOWED", `Reference '@${node.getName()}' can not declare a type: ${explicitType}`);
		}

		if (StringUtils.normalize(reference) !== node.getCanonicalName()) {
			throw new ValidationException(node.getLine(), "REFERENCE_NAME_NOT_VALID", `Reference must be '@${node.getName()}', not '${reference}'`);
		}

		// A reference may override the cardinality, but it may redefine neither the ENUM
		// values nor the children (STXT-TEMPLATE-SPEC 6.4)
		const values = cl.getValues();
		if (values) {
			throw new ValidationException(node.getLine(), "VALUES_NOT_ALLOWED_IN_REFERENCE", `Reference '@${node.getName()}' can not redefine ENUM values`);
		}

		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_IN_REFERENCE", `Reference '@${node.getName()}' can not redefine children`);
		}

		return; // OK Definition
	}

	// Once it exists, try to create its children if it has any.
	const childrenNode = node.getChildren();

	// Template error 14.9: node with children and an effective type that does not admit children
	if (childrenNode.length > 0 && !TypeRegistry.admitsChildren(schemaNode.getType())) {
		throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_FOR_TYPE", `Type ${schemaNode.getType()} does not allow children (node ${node.getName()})`);
	}

	// Add the children
	for (const child of childrenNode) {
		// STXT-TEMPLATE-SPEC 6.3: every Structure line uses ':', so a child is inline too
		if (!(child instanceof InlineNode)) {
			throw new ValidationException(child.getLine(), "STRUCTURE_LINE_NOT_VALID", "Template Structure lines must use ':'");
		}
		cl = ChildLineParser.parse(child.getValue(), child.getLine());

		const childName = child.getName();
		let childNamespace = child.getNamespace();
		if (!childNamespace || childNamespace === "") {
			childNamespace = schema.getNamespace();
		}

		const schChild = new ChildDefinition(childName, childNamespace, cl.getMin(), cl.getMax(), child.getLine());
		schemaNode.addChildDefinition(schChild);

		addToSchema(schema, child);
	}
}

/**
 * Tells `@Node Name TYPE` (reference + type, error 14.13) apart from `@Another Name`
 * (reference with a different name, error 14.12). Since node names may contain spaces,
 * the only reliable reading is: if the last token is a known type and what comes before
 * it is the name of the node itself, the line is declaring both things.
 * Returns the declared type, or null when the reference carries no type.
 */
function referenceType(reference: string, normalizedName: string): string | null {
	const cut = reference.lastIndexOf(" ");
	if (cut < 0) {
		return null;
	}

	const candidate = StringUtils.trim(reference.substring(cut + 1));
	const rest = reference.substring(0, cut);

	if (TypeRegistry.get(candidate) && StringUtils.normalize(rest) === normalizedName) {
		return candidate;
	}

	return null;
}

/** Attaches to the node definitions the descriptions declared in the `Description >>` block. */
function addDescriptions(schema: Schema, nodes: Node[]) {
	nodes.forEach((node) => {
		// Get the namespace
		let namespace = node.getNamespace();
		if (!namespace || namespace === "") {
			namespace = schema.getNamespace();
		}

		// No external descriptions
		if (namespace !== schema.getNamespace()) {
			throw new ValidationException(node.getLine(), "DESCRIPTION_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", "Not allowed description in external namespaces");
		}

		// No children either
		if (node instanceof InlineNode && node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "DESCRIPTION_CHILDREN_NOT_ALLOWED", "Not allowed children in description");
		}

		// Look for the node in the schema
		const nodeDef = schema.getNodeDefinition(node.getName());
		if (!nodeDef) {
			throw new ValidationException(node.getLine(), "DESCRIPTION_NODE_NOT_FOUND", `Not found node with name: ${node.getName()}`);
		}

		// No more than one entry per node is allowed (STXT-TEMPLATE-SPEC 12)
		if (nodeDef.getDescription() !== undefined) {
			throw new ValidationException(node.getLine(), "DESCRIPTION_DUPLICATED", `Exists a previous description for node: ${node.getName()}`);
		}
		nodeDef.setDescription(node.getText());
	});
}
