import { regexType } from "./regexType";

/** `TIME` type: checks the `HH:MM:SS` format. */
export const TIME = regexType(
	"TIME",
	/^\d{2}:\d{2}:\d{2}$/,
	"Invalid time"
);
