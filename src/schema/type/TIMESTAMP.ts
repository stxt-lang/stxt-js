import { regexType } from "./regexType";

export const TIMESTAMP = regexType(
	"TIMESTAMP",
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})?$/,
	"Invalid timestamp"
);
