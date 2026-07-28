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
		// ValidationException extiende ParseException: comprobar primero para no degradar
		// la severidad (la extensión pinta ValidationException como Warning)
		if (e instanceof ValidationException) {
			throw new ValidationException(e.line + offset, e.code, e.message);
		}
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
		// Un nodo externo solo puede declarar cardinalidad: ni tipo, ni valores ENUM,
		// ni hijos (STXT-TEMPLATE-SPEC 6.4, 10 y 14.15)
		const type = cl.getType();
		if (type && type.trim().length > 0) {
			throw new ValidationException(node.getLine(), "TYPE_DEFINITION_NOT_ALLOWED", "Not allowed type definition in external namespaces");
		}

		const values = cl.getValues();
		if (values) {
			throw new ValidationException(node.getLine(), "VALUES_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", `Not allowed values in external namespaces (node ${node.getName()})`);
		}

		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_IN_EXTERNAL_NAMESPACE", `Not allowed children in external namespaces (node ${node.getName()})`);
		}

		// No hacemos nada con creación de nodos que no son de @stxt.template!!
		return;
	}

	// Miramos si es nuevo y añadimos en listado
	let schemaNode = schema.getNodeDefinition(name);

	if (!schemaNode) {
		// Nuevo
		const type = cl.getType() ?? "INLINE";

		// En este punto el schema ya contiene tanto las definiciones previas ya cerradas
		// como los ancestros abiertos, así que una referencia que no resuelve aquí no
		// resuelve a nada (STXT-TEMPLATE-SPEC 6.4 y 14.11)
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
				// Mismo código que SchemaParser: un template es azúcar equivalente a un schema
				// (STXT-TEMPLATE-SPEC 13), así que la misma condición no debe cambiar de código
				// según la puerta de entrada
				throw new ValidationException(node.getLine(), "VALUES_ONLY_SUPPORTED_BY_ENUM", `Values only supported for type ENUM, not for type ${type}`);
			}
			for (const v of values) {
				schemaNode.addValue(v, node.getLine());
			}
		}

		// Un ENUM sin lista de valores es un template inválido (STXT-TEMPLATE-SPEC 9 y 13.7)
		if (type === "ENUM" && (!values || values.length === 0)) {
			throw new ValidationException(node.getLine(), "VALUES_EMPTY_FOR_ENUM", "ENUM Type must include values");
		}
	} else {
		const type = cl.getType();
		if (!type || !type.startsWith("@")) {
			throw new ValidationException(node.getLine(), "NODE_DEFINED_MULTIPLE_TIMES", `Multiple node reference must start with @: ${node.getName()}`);
		}

		const reference = type.substring(1).trim();

		// Referencia y tipo explícito en la misma línea (STXT-TEMPLATE-SPEC 14.13)
		const explicitType = referenceType(reference, node.getNormalizedName());
		if (explicitType) {
			throw new ValidationException(node.getLine(), "REFERENCE_WITH_TYPE_NOT_ALLOWED", `Reference '@${node.getName()}' can not declare a type: ${explicitType}`);
		}

		if (StringUtils.normalize(reference) !== node.getNormalizedName()) {
			throw new ValidationException(node.getLine(), "NODE_REFERENCE_NOT_VALID", `Reference must be '@${node.getName()}', not '${reference}'`);
		}

		// La referencia puede sobrescribir la cardinalidad, pero no redefinir valores
		// ENUM ni hijos (STXT-TEMPLATE-SPEC 6.4)
		const values = cl.getValues();
		if (values) {
			throw new ValidationException(node.getLine(), "VALUES_NOT_ALLOWED_IN_REFERENCE", `Reference '@${node.getName()}' can not redefine ENUM values`);
		}

		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_IN_REFERENCE", `Reference '@${node.getName()}' can not redefine children`);
		}

		return; // OK Definition
	}

	// Una vez ya existe, si tiene hijos los intentamos crear.
	const childrenNode = node.getChildren();

	// Error de template 14.9: nodo con hijos y tipo efectivo que no admite hijos
	if (childrenNode.length > 0 && !TypeRegistry.admitsChildren(schemaNode.getType())) {
		throw new ValidationException(node.getLine(), "CHILDREN_NOT_ALLOWED_FOR_TYPE", `Type ${schemaNode.getType()} does not allow children (node ${node.getName()})`);
	}

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

/**
 * Distingue `@Nombre Nodo TIPO` (referencia + tipo, error 14.13) de `@Otro Nombre`
 * (referencia con nombre distinto, error 14.12). Como los nombres de nodo admiten
 * espacios, la única lectura fiable es: si el último token es un tipo conocido y lo
 * que queda delante es el nombre del propio nodo, la línea declara ambas cosas.
 * Devuelve el tipo declarado, o null si la referencia no lleva tipo.
 */
function referenceType(reference: string, normalizedName: string): string | null {
	const cut = reference.lastIndexOf(" ");
	if (cut < 0) {
		return null;
	}

	const candidate = reference.substring(cut + 1).trim();
	const rest = reference.substring(0, cut);

	if (TypeRegistry.get(candidate) && StringUtils.normalize(rest) === normalizedName) {
		return candidate;
	}

	return null;
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

		// No se permite más de una entrada por nodo (STXT-TEMPLATE-SPEC 12)
		if (nodeDef.getDescription() !== undefined) {
			throw new ValidationException(node.getLine(), "DESCRIPTION_ALREADY_DEFINED", `Exists a previous description for node: ${node.getName()}`);
		}
		nodeDef.setDescription(node.getText());
	});
}
