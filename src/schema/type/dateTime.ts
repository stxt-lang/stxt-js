/**
 * Calendar and clock ranges shared by `DATE`, `TIME` and `TIMESTAMP` (STXT-SCHEMA-SPEC 9.4):
 * the shape of a value is checked by each type's regular expression, the ranges by these
 * helpers. Never `Date.parse`, which rolls `2026-02-30` into March.
 */

/** True if the year-month-day exists in the proleptic Gregorian calendar (year 0000-9999). */
export function isValidDate(year: number, month: number, day: number): boolean {
	if (month < 1 || month > 12 || day < 1) {
		return false;
	}
	const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
	const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	return day <= daysInMonth[month - 1];
}

/** True if hour 00-23, minute 00-59, second 00-59 (no leap second). */
export function isValidTime(hour: number, minute: number, second: number): boolean {
	return hour <= 23 && minute <= 59 && second <= 59;
}
