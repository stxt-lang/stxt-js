import { Node } from "./Node";
import { ParseException } from "../exceptions/ParseException";

export class ParseResult {
	private readonly nodes: Node[];
	private readonly errors: ParseException[];

	constructor(nodes: Node[] = [], errors: ParseException[] = []) {
		this.nodes = nodes;
		this.errors = errors;
	}

	public getNodes(): Node[] {
		return this.nodes;
	}

	public getErrors(): ParseException[] {
		return this.errors;
	}

	public hasErrors(): boolean {
		return this.errors.length > 0;
	}

	public addError(error: ParseException): void {
		this.errors.push(error);
	}

	public addNode(node: Node): void {
		this.nodes.push(node);
	}
}
