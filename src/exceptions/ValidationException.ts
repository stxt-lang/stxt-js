import { ParseException } from "./ParseException";

export class ValidationException extends ParseException {
    constructor(line: number, code: string, message: string) {
        super(line, code, message);
        this.name = "ValidationException";
        
        Object.setPrototypeOf(this, ValidationException.prototype);
    }
}
