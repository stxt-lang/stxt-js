import { regexType } from "./regexType";

export const UUID = regexType(
	"UUID",
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
	"Invalid UUID"
);
