import { Type } from "../Type";
import { Node } from "../../core/Node";
import { NodeDefinition } from "../NodeDefinition";
import { ValidationException } from "../../exceptions/ValidationException";

/**
 * Base builder for the simple value types, those checked with a regular expression.
 *
 * @param name name of the type, as used in the schemas (e.g. `"DATE"`).
 * @param pattern regular expression the value has to match.
 * @param error message of the error thrown when the value does not match.
 * @returns the {@link Type} that validates the value against that pattern.
 */
export function regexType(name: string, pattern: RegExp, error: string): Type {
	return {
		getName: () => name,

		validate(nodeDef: NodeDefinition, node: Node): void {
			// INLINE value form (STXT-SCHEMA-SPEC 9.3/9.4): the block '>>' form is not allowed
			if (node.isTextNode()) {
				throw new ValidationException(node.getLine(), "BLOCK_FORM_NOT_ALLOWED", `Not allowed text in node ${node.getQualifiedName()}`);
			}

			const value = node.getText();
			if (!pattern.test(value)) {
				throw new ValidationException(node.getLine(),"INVALID_VALUE",`${node.getName()}: ${error} (${value})`);
			}
		},
	};
}
