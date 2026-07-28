import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const BLOCK: Type = {
	getName(): string {
		return "BLOCK";
	},

	validate(nodeDef: NodeDefinition, node: Node): void {
		// Forma del valor BLOCK (STXT-SCHEMA-SPEC 9.2): sólo bloque '>>', no forma inline
		if (!node.isTextNode()) {
			throw new ValidationException(node.getLine(),"BLOCK_FORM_REQUIRED",`Node ${node.getQualifiedName()} requires block form '>>'`);
		}
	},
};
