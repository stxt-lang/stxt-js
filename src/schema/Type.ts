import { Node } from "../core/Node";
import { NodeDefinition } from "./NodeDefinition";

/** Value type of a node (TEXT, INTEGER, URL...). Each type lives in `src/schema/type` as a singleton. */
export interface Type {
	/**
	 * Validates the value of a node against this type.
	 *
	 * @param nodeDef definition of the node in the schema.
	 * @param node node to validate.
	 * @throws ValidationException if the value of the node does not match the type.
	 */
	validate(nodeDef: NodeDefinition, node: Node): void;
	/** @returns the name of the type, as used in the schemas (e.g. `"TEXT"`). */
	getName(): string;
}
