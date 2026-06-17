import { regexType } from "./regexType";

export const INTEGER = regexType(
	"INTEGER",
	/^[-+]?\d+$/,
	"Invalid integer"
);
