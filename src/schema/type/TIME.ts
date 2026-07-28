import { regexType } from "./regexType";

export const TIME = regexType(
	"TIME",
	/^\d{2}:\d{2}:\d{2}$/,
	"Invalid time"
);
