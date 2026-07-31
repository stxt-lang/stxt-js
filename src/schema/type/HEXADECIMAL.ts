import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

/** `HEXADECIMAL` type: checks a hexadecimal string (`[0-9A-Fa-f]+`), with no prefix and no mandatory even length. */
export const HEXADECIMAL: Type = {
	getName(): string {
		return "HEXADECIMAL";
	},

	// STXT-SCHEMA-SPEC 9.5: [0-9A-Fa-f]+ string, with no '#' prefix and no even-length requirement
	validate(ndef: NodeDefinition, n: Node): void {
		const value = binaryValue(n);

		if (!/^[0-9A-Fa-f]+$/.test(value)) {
			throw new ValidationException(n.getLine(), "INVALID_VALUE", `${n.getName()}: Invalid hexadecimal (${value})`);
		}
	},
};
