import { Node } from "../core/Node";
import { ValidationException } from "../exceptions/ValidationException";

export interface Validator {
	validate(node: Node): ValidationException[];
}
