import { rangeType } from "./rangeType";
import { isValidDate } from "./dateTime";

/** `DATE` type: `YYYY-MM-DD`, an existing date of the proleptic Gregorian calendar (STXT-SCHEMA-SPEC 9.4). */
export const DATE = rangeType(
	"DATE",
	/^(\d{4})-(\d{2})-(\d{2})$/,
	m => isValidDate(Number(m[1]), Number(m[2]), Number(m[3])),
	"Invalid date"
);
