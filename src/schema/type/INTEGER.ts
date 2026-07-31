import { regexType } from "./regexType";

/** `INTEGER` type: checks an integer with an optional sign. */
export const INTEGER = regexType(
	"INTEGER",
	/^[-+]?\d+$/,
	"Invalid integer"
);
