import { ParseException } from "../exceptions/ParseException";

/** Validates the format of STXT `(a.b.c)` namespaces. */
export class NamespaceValidator {

	/**
	 * Tells whether a namespace matches the format, without throwing.
	 *
	 * Format of the logical namespace (STXT-SPEC 7): lower-case ASCII letters, digits and dot
	 * only; an optional leading `@` (reserved namespaces); two or more domain-style labels
	 * `[a-z0-9]+` separated by `.`. Valid examples: "a.b", "com.example.docs", "@stxt.schema".
	 * Checked by a hand-written scan rather than the regex `^@?[a-z0-9]+(\.[a-z0-9]+)+$`, which
	 * in engines that implement a repeated group by recursion (Java) overflowed the stack with
	 * ~2 000 labels; the scan is linear and identical in every port.
	 *
	 * @param namespace already normalized namespace to check.
	 * @returns true if it matches the format; false when it is null, empty or malformed.
	 */
	static isValid(namespace: string | null | undefined): boolean {
		if (!namespace) {
			return false;
		}
		const n = namespace.length;
		let i = namespace[0] === "@" ? 1 : 0;
		let labels = 0;
		for (;;) {
			const start = i;
			while (i < n && NamespaceValidator.isLabelChar(namespace.charCodeAt(i))) {
				i++;
			}
			if (i === start) {
				return false;		// empty label: "", "@", "a.", ".a", "a..b"
			}
			labels++;
			if (i === n) {
				return labels >= 2;
			}
			if (namespace[i] !== ".") {
				return false;
			}
			i++;
		}
	}

	// [a-z0-9], ASCII only
	private static isLabelChar(c: number): boolean {
		return (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39);
	}

	/**
	 * Validates the format of a namespace.
	 *
	 * @param namespace already normalized namespace to validate; ignored when null or empty.
	 * @param lineNumber line number, for the error message.
	 * @throws ParseException with code `INVALID_NAMESPACE` if it does not match the format.
	 */
	static validateNamespaceFormat(namespace: string | null | undefined, lineNumber: number): void {
		if (!namespace) {
			return;
		}

		if (!NamespaceValidator.isValid(namespace)) {
			throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Namespace not valid: ${namespace}`);
		}
	}
}
