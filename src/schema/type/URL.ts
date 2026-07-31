import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

/** `URL` type: checks that the value is a syntactically valid URI/URL. */
export const URL: Type = {
	getName(): string {
		return "URL";
	},

	validate(ndef: NodeDefinition, n: Node): void {
		// INLINE value form (STXT-SCHEMA-SPEC 9.4): the block '>>' form is not allowed
		if (n.isTextNode()) {
			throw new ValidationException(n.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${n.getQualifiedName()}`);
		}

		const url = n.getValue();

		try {
			const parsed = new globalThis.URL(url);
			const ok = !!parsed.protocol && !!parsed.hostname;

			if (!ok) {
				throw new ValidationException(n.getLine(), "INVALID_URL_STRUCTURE", `Invalid URL: ${url}`);
			}
		} catch {
			throw new ValidationException(n.getLine(),"INVALID_VALUE",`Invalid URL: ${url}`);
		}
	},
};
