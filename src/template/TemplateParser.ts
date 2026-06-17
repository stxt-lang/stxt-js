import { Node } from "../core/Node";
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

export function transformTemplateNodeToSchema(node: Node): Schema {
	// Insertamos namespace
	const result = new Schema(node.getValue(), node.getLine(), undefined);

	// Buscamos nodo structure
	const structure = node.getChild("structure");
	if (!structure) {
		throw new ValidationException(node.getLine(), "TEMPLATE_STRUCTURE_REQUIRED", "Template must define 'Structure >>'");
	}

	const text = structure.getText();
	const offset = structure.getLine();

	// Creamos un parser simple
	const parser = new Parser();

	// Parseamos para los nodos
	try {
		const nodes = parser.parse(text);
		// Vamos iterando todos los nodos insertando
		for (const n of nodes) {
			addToSchema(result, n);
		}
	} catch (e) {
		if (e instanceof ParseException) {
			throw new ParseException(e.line + offset, e.code, e.message);
		}
		throw e;
	}

	// Buscamos descripciones
	const description = node.getChild("description");
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

	// Retornamos resultado
	return result;
}


function addToSchema(schema: Schema, node: Node): void {
	// Obtenemos nombre qualificado
	let namespace = node.getNamespace();
	const name = node.getName();

	// Miramos datos
	let cl: ChildLine = ChildLineParser.parse(node.getValue(), node.getLine());

	if (!namespace || namespace === "") {
		namespace = schema.getNamespace();
	}

	if (namespace !== schema.getNamespace()) {
		// Validamos type vacío
		const type = cl.getType();
		if (type != null && type.trim().length > 0) {
			throw new ValidationException(node.getLine(), "TYPE_DEFINITION_NOT_ALLOWED", "Not allowed type definition in external namespaces");
		}

		// No hacemos nada con creación de nodos que no son de @stxt.template!!
		return;
	}

	// Miramos si es nuevo y añadimos en listado
	let schemaNode = schema.getNodeDefinition(name);

	if (!schemaNode) {
		// Nuevo
		const type = cl.getType() == null ? "INLINE" : cl.getType()!;
		schemaNode = new NodeDefinition(node.getName(), type, node.getLine(), undefined);
		schema.addNodeDefinition(schemaNode);

		if (!TypeRegistry.get(type)) {
			throw new ValidationException(node.getLine(), "TYPE_NOT_VALID", `Type not valid: ${type}`);
		}

		const values = cl.getValues();
		if (values) {
			if (type !== "ENUM") {
				throw new ValidationException(node.getLine(), "VALUES_NOT_IN_ENUM", `Values only allowed with type ENUM`);
			}
			for (const v of values) {
				schemaNode.addValue(v, node.getLine());
			}
		}
	} else {
		let type = cl.getType();
		if (!type || !type.startsWith("@")) {
			throw new ValidationException(node.getLine(), "NODE_DEFINED_MULTIPLE_TIMES", `Multiple node reference must start with @: ${node.getName()}`);
		}

		type = type.substring(1);
		type = StringUtils.normalize(type);

		if (type === node.getNormalizedName()) {
			return; // OK Definition
		}

		throw new ValidationException(node.getLine(), "NODE_REFERENCE_NOT_VALID", `Reference must be '@${node.getName()}', not '${type}'`);
	}

	// Una vez ya existe, si tiene hijos los intentamos crear.
	const childrenNode = node.getChildren();

	// Insertamos childs
	for (const child of childrenNode) {
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

function addDescriptions(schema: Schema, nodes: Node[]) {
	nodes.forEach((node) => {
		// Obtenemos namespace
		let namespace = node.getNamespace();
		if (!namespace || namespace === "") {
			namespace = schema.getNamespace();
		}

		// Validamos no external description
		if (namespace !== schema.getNamespace()) {
			throw new ValidationException(node.getLine(), "EXTERNAL_DESCRIPTION_NOT_ALLOWED", "Not allowed description in external namespaces");
		}

		// Validamos sin hijos
		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_DESCRIPTION_NOT_ALLOWED", "Not allowed children in description");
		}

		// Buscamos nodo de esquema
		const nodeDef = schema.getNodeDefinition(node.getName());
		if (!nodeDef) {
			throw new ValidationException(node.getLine(), "NODE_NOT_FOUND", `Not found node with name: ${node.getName()}`);
		}
		nodeDef.setDescription(node.getText());
	});
}
