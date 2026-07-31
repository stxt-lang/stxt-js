import { Node } from "../core/Node";
import { ValidationException } from "../exceptions/ValidationException";

/** Process hook invoked by the {@link Parser} when each node is closed, to validate in streaming. */
export interface Validator {
	/**
	 * Validates a node and returns every error found (without throwing), letting the caller
	 * collect errors from several nodes instead of bailing out on the first one. An empty array
	 * means the node is valid.
	 *
	 * @param node already closed node to validate.
	 * @returns the validation errors found, or an empty array if the node is valid.
	 */
	validate(node: Node): ValidationException[];
}
