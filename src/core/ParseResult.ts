import { Node } from "./Node";
import { ParseException } from "../exceptions/ParseException";

/**
 * Result of a parse in multi-error mode: it collects the root nodes obtained and every error
 * found (both syntax and validation ones), without bailing out on the first one.
 *
 * See {@link Parser.parseResult}. For the traditional fail-fast mode use {@link Parser.parse},
 * which internally uses this result and throws the first error.
 */
export class ParseResult {
	private readonly nodes: Node[];
	private readonly errors: ParseException[];

	/**
	 * Creates a result, empty by default.
	 *
	 * @param nodes root nodes to start from.
	 * @param errors errors to start from.
	 */
	constructor(nodes: Node[] = [], errors: ParseException[] = []) {
		this.nodes = nodes;
		this.errors = errors;
	}

	/** @returns the root nodes collected so far. */
	public getNodes(): Node[] {
		return this.nodes;
	}

	/** @returns the syntax or validation errors collected so far, in order of appearance. */
	public getErrors(): ParseException[] {
		return this.errors;
	}

	/** @returns true if at least one error has been collected. */
	public hasErrors(): boolean {
		return this.errors.length > 0;
	}

	/**
	 * Adds an error found while parsing.
	 *
	 * @param error error found while parsing, without aborting the traversal.
	 */
	public addError(error: ParseException): void {
		this.errors.push(error);
	}

	/**
	 * Adds a root node to the result.
	 *
	 * @param node already closed root node to add to the result.
	 */
	public addNode(node: Node): void {
		this.nodes.push(node);
	}
}
