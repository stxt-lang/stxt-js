import { Type } from "../Type";
import { Node } from "../../core/Node";
import { NodeDefinition } from "../NodeDefinition";
import { ValidationException } from "../../exceptions/ValidationException";

/**
 * A type whose value must match a regular expression and whose captured groups must then pass
 * a range check (the calendar and clock types of STXT-SCHEMA-SPEC 9.4). INLINE value form only.
 *
 * @param name name of the type.
 * @param pattern shape of the value, with the groups `inRange` reads.
 * @param inRange true if the captured groups are in range.
 * @param error text of the `INVALID_VALUE` message.
 */
export function rangeType(name: string, pattern: RegExp, inRange: (m: RegExpExecArray) => boolean, error: string): Type {
	return {
		getName: () => name,

		validate(nodeDef: NodeDefinition, node: Node): void {
			// INLINE value form (STXT-SCHEMA-SPEC 9.4): the block '>>' form is not allowed
			if (node.isTextNode()) {
				throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
			}

			const value = node.getText();
			const m = pattern.exec(value);
			if (m === null || !inRange(m)) {
				throw new ValidationException(node.getLine(), "INVALID_VALUE", `${node.getName()}: ${error} (${value})`);
			}
		},
	};
}
