import { ParseException } from "../exceptions/ParseException";

export class NamespaceValidator {

	private static readonly NAMESPACE_FORMAT: RegExp = /^@?[a-z0-9]+(\.[a-z0-9]+)+$/;

	static validateNamespaceFormat(namespace: string | null | undefined, lineNumber: number): void {
		if (namespace == null || namespace.length === 0) {
			return;
		}

		if (!NamespaceValidator.NAMESPACE_FORMAT.test(namespace)) {
			throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Namespace not valid: ${namespace}`);
		}
	}
}
