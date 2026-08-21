import { rangeType } from "./rangeType";
import { isValidDate, isValidTime } from "./dateTime";

/**
 * `TIMESTAMP` type: `DATE "T" hh:mm [":" ss ["." digits]] ["Z" | sign hh:mm]` (STXT-SCHEMA-SPEC
 * 9.4). Date, time and offset in range; seconds, fraction (one or more digits) and zone optional.
 */
export const TIMESTAMP = rangeType(
	"TIMESTAMP",
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))?$/,
	m => isValidDate(Number(m[1]), Number(m[2]), Number(m[3]))
		&& isValidTime(Number(m[4]), Number(m[5]), m[6] === undefined ? 0 : Number(m[6]))
		&& (m[7] === undefined || isValidTime(Number(m[7]), Number(m[8]), 0)),
	"Invalid timestamp"
);
