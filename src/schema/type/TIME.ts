import { rangeType } from "./rangeType";
import { isValidTime } from "./dateTime";

/** `TIME` type: `hh:mm:ss` in range (00-23, 00-59, 00-59); no fraction, no zone (STXT-SCHEMA-SPEC 9.4). */
export const TIME = rangeType(
	"TIME",
	/^(\d{2}):(\d{2}):(\d{2})$/,
	m => isValidTime(Number(m[1]), Number(m[2]), Number(m[3])),
	"Invalid time"
);
