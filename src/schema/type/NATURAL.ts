import { regexType } from "./regexType";

/** `NATURAL` type: checks an unsigned integer. */
export const NATURAL = regexType(
	"NATURAL",
	/^\d+$/,
	"Invalid natural"
);
