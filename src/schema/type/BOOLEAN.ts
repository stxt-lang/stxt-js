import { regexType } from "./regexType";

/** `BOOLEAN` type: checks that the value is `true` or `false`. */
export const BOOLEAN = regexType("BOOLEAN", /^(true|false)$/, "Invalid boolean");
