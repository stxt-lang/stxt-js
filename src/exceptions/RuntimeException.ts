export class RuntimeException extends Error {
	public readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "RuntimeException";
		this.code = code;

		Object.setPrototypeOf(this, RuntimeException.prototype);
	}

	getCode(): string {
		return this.code;
	}

	toString(): string {
		const message = this.message;
		return `${this.name}[${this.code}]${message ? `: ${message}` : ""}`;
	}
}
