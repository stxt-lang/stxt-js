import { ParseException } from "../exceptions/ParseException";
import { NameNamespace } from "./NameNamespace";

/** Extracts the name and the namespace `(a.b.c)` from the left-hand side of an STXT line. */
export class NameNamespaceParser {
	private constructor() {
	}

	/**
	 * Splits a raw node name into its name and its namespace.
	 *
	 * @param rawName raw name, with the namespace in parentheses if it carries one.
	 * @param inheritedNs namespace inherited from the parent, used when `rawName` brings none of its own.
	 * @param lineNumber line number, for the error messages.
	 * @param fullLine original full line, for the error messages.
	 * @returns the name and the namespace, already split apart and resolved.
	 * @throws ParseException if the name or the namespace are not well formed.
	 */
	static parse(rawName: string | null | undefined, inheritedNs: string | null | undefined, lineNumber: number, fullLine: string): NameNamespace {
		if (rawName === null || rawName === undefined) {
			throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${fullLine}`);
		}

		rawName = rawName.trim();

		const startIndex = rawName.indexOf("(");
		const endIndex = rawName.indexOf(")");

		let name: string;
		let namespace: string = inheritedNs ?? "";

		// Both of them found
		if (startIndex !== -1 && endIndex !== -1) {
			if (startIndex > endIndex || endIndex !== rawName.length - 1) {
				throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
			}

			name = rawName.substring(0, startIndex).trim();
			// No trim: the grammar (STXT-SPEC 7/16) does not allow spaces inside '( )'
			namespace = rawName.substring(startIndex + 1, endIndex);

			if (namespace.length === 0) {
				throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
			}
		}
		// Neither of them
		else if (startIndex === -1 && endIndex === -1) {
			name = rawName;
		}
		// Only one of the two
		else {
			throw new ParseException(lineNumber,"INVALID_NAMESPACE",`Line not valid: ${fullLine}`);
		}

		// Return
		return new NameNamespace(name, namespace.toLowerCase());
	}
}
