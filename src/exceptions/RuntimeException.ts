/**
 * Error that is not tied to a line of the document: a wrong use of the API or an inconsistency
 * found at runtime (e.g. an ambiguous child, a type registered twice). It carries an UPPERCASE
 * code, like the rest of the STXT exceptions.
 */
export class RuntimeException extends Error {
	/** Error code in UPPERCASE (e.g. `AMBIGUOUS_CHILD`). */
	public readonly code: string;

	/**
	 * Creates an error with an error code and a message.
	 *
	 * @param code error code in UPPERCASE.
	 * @param message descriptive message.
	 */
	constructor(code: string, message: string) {
		super(message);
		this.name = "RuntimeException";
		this.code = code;

		Object.setPrototypeOf(this, RuntimeException.prototype);
	}

	/** @returns the error code in UPPERCASE. */
	getCode(): string {
		return this.code;
	}

	/** @returns a readable representation of the error, with its code. */
	toString(): string {
		const message = this.message;
		return `${this.name}[${this.code}]${message ? `: ${message}` : ""}`;
	}
}
