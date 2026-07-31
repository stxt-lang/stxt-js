import { regexType } from "./regexType";

/** `DATE` type: checks the `YYYY-MM-DD` format. */
export const DATE = regexType("DATE",/^\d{4}-\d{2}-\d{2}$/,"Invalid date");
