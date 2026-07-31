import { regexType } from "./regexType";

/** `UUID` type: checks the standard UUID format (`8-4-4-4-12` hexadecimal). */
export const UUID = regexType(
	"UUID",
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
	"Invalid UUID"
);
