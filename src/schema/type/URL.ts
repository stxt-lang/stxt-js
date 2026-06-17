import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";

export const URL: Type = {
	getName(): string {
		return "URL";
	},

	validate(ndef: NodeDefinition, n: Node): void {
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
