import { ParseException } from "./ParseException";

/**
 * A parser limit exceeded (STXT-SPEC §11.2): nesting depth, line length or input size. Unlike
 * any other parse error it aborts the parse: it is emitted and no further input is processed,
 * in every mode, so it is always the last error. Exceeding a limit does not make the document
 * invalid: the same document may parse under higher limits (see {@link ParserOptions}).
 */
export class LimitException extends ParseException {
	/**
	 * Creates a limit error located at a line of the document.
	 *
	 * @param line line number where the limit was exceeded.
	 * @param code error code in UPPERCASE (`LIMIT_*`).
	 * @param message descriptive message.
	 */
	constructor(line: number, code: string, message: string) {
		super(line, code, message);
		this.name = "LimitException";

		Object.setPrototypeOf(this, LimitException.prototype);
	}
}
