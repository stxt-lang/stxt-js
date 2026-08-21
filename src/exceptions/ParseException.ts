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

	/**
	 * The string form carries the frame that `message` deliberately leaves out: `message` is only
	 * the description, and the code and the line are separate fields that whoever formats output
	 * composes. Same framing in every port since 0.10.0.
	 *
	 * @returns `[CODE] line N: message`.
	 */
	toString(): string {
		return `[${this.code}] line ${this.line}: ${this.message}`;
	}
}
