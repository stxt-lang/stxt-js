import { regexType } from "./regexType";

export const NUMBER = regexType(
	"NUMBER",
	/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/,
	"Invalid number"
);
