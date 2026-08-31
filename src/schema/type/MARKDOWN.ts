import { Type } from "../Type";
import { TEXT } from "./TEXT";

/**
 * `MARKDOWN` type. STXT-SCHEMA-SPEC 9.7: for validation purposes it is equivalent to TEXT
 * (any content is valid Markdown; only children are forbidden), so it shares its validation
 * and only the name differs.
 */
export const MARKDOWN: Type = {
	getName(): string {
		return "MARKDOWN";
	},

	validate: TEXT.validate,
};
