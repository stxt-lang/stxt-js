import { ParseException } from "../exceptions/ParseException";
import { NameNamespace } from "./NameNamespace";

export class NameNamespaceParser {
	private constructor() {
	}

	static parse(rawName: string | null | undefined, inheritedNs: string | null | undefined, lineNumber: number, fullLine: string): NameNamespace {
		if (rawName == null) {
			throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${fullLine}`);
		}

		rawName = rawName.trim();

		const startIndex = rawName.indexOf("(");
		const endIndex = rawName.indexOf(")");

		let name: string;
		let namespace: string = inheritedNs ?? "";

		// Encontrados los dos
		if (startIndex !== -1 && endIndex !== -1) {
			if (startIndex > endIndex || endIndex !== rawName.length - 1) {
				throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
			}

			name = rawName.substring(0, startIndex).trim();
			namespace = rawName.substring(startIndex + 1, endIndex).trim();

			if (namespace.length === 0) {
				throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
			}
		}
		// Ninguno de los dos
		else if (startIndex === -1 && endIndex === -1) {
			name = rawName;
		}
		// Solo uno de los dos
		else {
			throw new ParseException(lineNumber,"INVALID_NAMESPACE",`Line not valid: ${fullLine}`);
		}

		// Retorno
		return new NameNamespace(name, namespace.toLowerCase());
	}
}
