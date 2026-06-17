import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { StringUtils } from "../../core/StringUtils";

export const HEXADECIMAL: Type = {
	getName(): string {
		return "HEXADECIMAL";
	},

	validate(ndef: NodeDefinition, n: Node): void {
		// Elimina espacios, tabs y saltos de línea
		let value = StringUtils.cleanSpaces(n.getText());

		if (value.length === 0) {
			throw invalid(n, "Invalid hexadecimal (empty)");
		}

		// Permitir prefijo '#'
		if (value.startsWith("#")) {
			value = value.substring(1);
		}

		if (value.length === 0) {
			throw invalid(n, "Invalid hexadecimal (only '#')");
		}

		// Longitud par (hexadecimal por bytes)
		if ((value.length & 1) !== 0) {
			throw invalid(n, "Invalid hexadecimal length (must be even)");
		}

		// Validar caracteres hexadecimales
		for (let i = 0; i < value.length; i++) {
			const c = value.charAt(i);
			// Equivalente a Character.digit(c, 16) == -1
			if (!/^[0-9a-fA-F]$/.test(c)) {
				throw invalid(n, `Invalid hexadecimal character '${c}'`);
			}
		}
	},
};

function invalid(n: Node, msg: string): ValidationException {
	return new ValidationException(n.getLine(), "INVALID_VALUE", `${n.getName()}: ${msg}`);
}
