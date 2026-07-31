import { ParseException } from "./ParseException";

/** Semantic validation error (schema, type or cardinality), detected when a node is closed. */
export class ValidationException extends ParseException {
    /**
     * Creates a validation error located at a line of the document.
     *
     * @param line line number where the error was detected.
     * @param code error code in UPPERCASE.
     * @param message descriptive message.
     */
    constructor(line: number, code: string, message: string) {
        super(line, code, message);
        this.name = "ValidationException";

        Object.setPrototypeOf(this, ValidationException.prototype);
    }
}
