/**
 * Syntax error detected while parsing (lexical/structural phase, not schema). Every exception
 * carries an UPPERCASE code and the line of the document where it was detected.
 */
export class ParseException extends Error {
	/** Line number of the document where the error was detected. */
	public readonly line: number;
	/** Error code in UPPERCASE (e.g. `INVALID_LINE`). */
	public readonly code: string;

	/**
	 * Creates a syntax error located at a line of the document.
	 *
	 * @param line line number where the error was detected.
	 * @param code error code in UPPERCASE.
	 * @param message descriptive message.
	 */
	constructor(line: number, code: string, message: string) {
		super(message);

		this.name = "ParseException";
		this.line = line;
		this.code = code;

		Object.setPrototypeOf(this, ParseException.prototype);
	}

	/** @returns a readable representation of the error, with its line and its code. */
	toString(): string {
		return `${this.name} [line=${this.line}, code=${this.code}]: ${this.message}`;
	}
}
