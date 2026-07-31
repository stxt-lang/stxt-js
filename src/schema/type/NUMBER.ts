import { regexType } from "./regexType";

/** `NUMBER` type: checks a decimal number, with optional sign and exponent notation. */
export const NUMBER = regexType(
	"NUMBER",
	/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/,
	"Invalid number"
);
