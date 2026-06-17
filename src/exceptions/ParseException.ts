export class ParseException extends Error {
	public readonly line: number;
	public readonly code: string;

	constructor(line: number, code: string, message: string) {
		super(message);

		this.name = "ParseException";
		this.line = line;
		this.code = code;

		Object.setPrototypeOf(this, ParseException.prototype);
	}

	toString(): string {
		return `${this.name} [line=${this.line}, code=${this.code}]: ${this.message}`;
	}
}
