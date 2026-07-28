import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

// STXT-SCHEMA-SPEC 9.7: a efectos de validación equivale a TEXT
// (cualquier contenido es válido; solo se prohíben hijos)
export const MARKDOWN: Type = {
	getName(): string {
		return "MARKDOWN";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		if (node.getChildren().length > 0) {
			throw new ValidationException(node.getLine(), "NOT_ALLOWED_CHILDREN_TEXT", `Not allowed children nodes in node ${node.getQualifiedName()}`);
		}
	},
};
