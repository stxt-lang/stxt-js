import { regexType } from "./regexType";

export const NATURAL = regexType(
	"NATURAL",
	/^\d+$/,
	"Invalid natural"
);
