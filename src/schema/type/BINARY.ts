import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

export const BINARY: Type = {
	getName(): string {
		return "BINARY";
	},

	// STXT-SCHEMA-SPEC 9.5: cadena [01]+
	validate(ndef: NodeDefinition, n: Node): void {
		const value = binaryValue(n);

		if (!/^[01]+$/.test(value)) {
			throw new ValidationException(n.getLine(), "INVALID_VALUE", `${n.getName()}: Invalid binary (${value})`);
		}
	},
};
