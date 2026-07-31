import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

/** `BINARY` type: checks that the content is a string of zeros and ones (`[01]+`). */
export const BINARY: Type = {
	getName(): string {
		return "BINARY";
	},

	// STXT-SCHEMA-SPEC 9.5: [01]+ string
	validate(ndef: NodeDefinition, n: Node): void {
		const value = binaryValue(n);

		if (!/^[01]+$/.test(value)) {
			throw new ValidationException(n.getLine(), "INVALID_VALUE", `${n.getName()}: Invalid binary (${value})`);
		}
	},
};
