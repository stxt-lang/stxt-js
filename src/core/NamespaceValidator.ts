import { ParseException } from "../exceptions/ParseException";

/** Validates the format of STXT `(a.b.c)` namespaces. */
export class NamespaceValidator {

	/**
	 * Format of the logical namespace.
	 *
	 * Rules:
	 * - Lower-case letters, digits and dot only.
	 * - It may optionally start with '@'.
	 * - It must be one or more domain-style labels separated by '.':
	 *   label := [a-z0-9]+
	 * valid examples: "xxx", "xxx.ddd", "zzz.ttt.ooo", "@xxx", "@xxx.ddd".
	 */
	private static readonly NAMESPACE_FORMAT: RegExp = /^@?[a-z0-9]+(\.[a-z0-9]+)+$/;

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

		if (!NamespaceValidator.NAMESPACE_FORMAT.test(namespace)) {
			throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Namespace not valid: ${namespace}`);
		}
	}
}
