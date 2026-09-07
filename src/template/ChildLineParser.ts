import { ValidationException } from "../exceptions/ValidationException";
import { StringUtils } from "../core/StringUtils";
import { Constants } from "../core/Constants";
import { ChildLine } from "./ChildLine";

/** Parses the inline value of a child node inside an `@stxt.template`, shaped as `(min,max) TYPE [values]`. */
export class ChildLineParser {
	private constructor() { }

	/**
	 * Splits a RuleSpec `(count) TYPE [values]` into its three optional parts by a hand-written
	 * scan, not a regular expression: the pattern used until 2026-09-06 backtracked in O(n³) on
	 * a line without the closing `]` (a 10 000-character Structure line took minutes). Blanks
	 * are U+0020/U+0009 only (STXT-TEMPLATE-SPEC 6.2/9), and the rules the pattern enforced
	 * are kept exactly: the count runs to the first `)` and, trimmed, is neither empty nor
	 * starts with `(`; the type may not contain `(`, `)` or `]`; the values run from the first
	 * `[` to the first `]` after it, and only blanks may follow that `]`.
	 *
	 * @returns the trimmed parts (null each when absent), or null if the line has not that shape.
	 */
	private static splitRuleSpec(rawLine: string): [string | null, string | null, string | null] | null {
		const n = rawLine.length;
		let i = 0;
		while (i < n && StringUtils.isBlank(rawLine[i])) {
			i++;
		}

		let count: string | null = null;
		if (i < n && rawLine[i] === "(") {
			const close = rawLine.indexOf(")", i + 1);
			if (close === -1) {
				return null;
			}
			count = StringUtils.trim(rawLine.substring(i + 1, close));
			if (count.length === 0 || count[0] === "(") {
				return null;
			}
			i = close + 1;
		}

		const open = rawLine.indexOf("[", i);
		let type: string | null = rawLine.substring(i, open === -1 ? n : open);
		if (type.includes("(") || type.includes(")") || type.includes("]")) {
			return null;
		}
		type = StringUtils.trim(type);
		if (type.length === 0) {
			type = null;
		}

		let values: string | null = null;
		if (open !== -1) {
			const close = rawLine.indexOf("]", open + 1);
			if (close === -1) {
				return null;
			}
			values = StringUtils.trim(rawLine.substring(open + 1, close));
			for (let j = close + 1; j < n; j++) {
				if (!StringUtils.isBlank(rawLine[j])) {
					return null;
				}
			}
		}

		return [count, type, values];
	}

	/**
	 * Parses a definition line into its type, its cardinality and its allowed values.
	 *
	 * @param rawLine inline value of the node, `(min,max) TYPE [values]`.
	 * @param lineNumber line number, for the error messages.
	 * @returns the line already split into type, cardinality and values.
	 * @throws ValidationException with code `STRUCTURE_LINE_NOT_VALID`, `CARDINALITY_NOT_VALID`,
	 *         `MIN_GREATER_THAN_MAX` or `VALUE_DUPLICATED` if the line is not valid.
	 */
	static parse(rawLine: string, lineNumber: number): ChildLine {
		if (StringUtils.trim(rawLine).length === 0) {
			return new ChildLine(null, null, null, null);
		}

		const parts = ChildLineParser.splitRuleSpec(rawLine);
		if (!parts) {
			throw new ValidationException(lineNumber, "STRUCTURE_LINE_NOT_VALID", `Line not valid: ${rawLine}`);
		}

		const [countPart, type, valuesStr] = parts;
		const count = countPart ?? "";
		let min: number | null = null;
		let max: number | null = null;

		if (count.length === 0 || count === "*") {
			min = null;
			max = null;
		} else if (count === "?") {
			min = null;
			max = 1;
		} else if (count === "+") {
			min = 1;
			max = null;
		} else if (count.endsWith("+")) {
			min = ChildLineParser.parseCount(count.substring(0, count.length - 1), count, rawLine, lineNumber);
			max = null;
		} else if (count.endsWith("-")) {
			min = null;
			max = ChildLineParser.parseCount(count.substring(0, count.length - 1), count, rawLine, lineNumber);
		} else if (count.includes(",")) {
			const parts = count.split(",");
			if (parts.length !== 2) {
				throw new ValidationException(lineNumber, "CARDINALITY_NOT_VALID", `Invalid count ${count} in line: ${rawLine}`);
			}
			const aNum = ChildLineParser.parseCount(StringUtils.trim(parts[0]), count, rawLine, lineNumber);
			const bNum = ChildLineParser.parseCount(StringUtils.trim(parts[1]), count, rawLine, lineNumber);
			// Invalid cardinality when min > max (STXT-TEMPLATE-SPEC 7.1)
			if (aNum > bNum) {
				throw new ValidationException(lineNumber, "MIN_GREATER_THAN_MAX", `Min ${aNum} greater than Max ${bNum} in line: ${rawLine}`);
			}
			min = aNum;
			max = bNum;
		} else {
			min = ChildLineParser.parseCount(count, count, rawLine, lineNumber);
			max = min;
		}

		// values
		let values: string[] | null = null;

		if (valuesStr !== null) {
			const parts = valuesStr.split(",");
			const list: string[] = [];

			for (let part of parts) {
				part = StringUtils.trim(part);
				// An empty item ("[a, , b]", "[a, b,]") is an error, as an empty Value: is in a
				// schema (STXT-TEMPLATE-SPEC 14.14). Only the whole list may be empty ("[]"),
				// which the template parser reports as VALUES_REQUIRED.
				if (part.length === 0 && parts.length > 1) {
					throw new ValidationException(lineNumber, "VALUE_EMPTY", `Empty ENUM value in ${valuesStr}`);
				}
				if (part.length === 0) {
					continue;
				}

				if (list.includes(part)) {
					throw new ValidationException(lineNumber, "VALUE_DUPLICATED", `The values ${part} is duplicated`);
				}
				list.push(part);
			}

			// Brackets being there (even empty ones, "[]") count as an explicit definition of
			// values: a non-null array is returned (possibly empty) to tell it apart from having
			// no brackets at all (valuesStr null/undefined, values stays null). That way "[]" is
			// treated as a real definition/redefinition (ported from stxt-java).
			values = list;
		}

		return new ChildLine(type, min, max, values);
	}

	// num, min and max must be non-negative integers, with no trailing text, bounded to
	// 2^32 - 1 like Min/Max in a schema (STXT-TEMPLATE-SPEC 7.1)
	private static parseCount(num: string, count: string, rawLine: string, lineNumber: number): number {
		if (!/^\d+$/.test(num)) {
			throw new ValidationException(lineNumber, "CARDINALITY_NOT_VALID", `Invalid count ${count} in line: ${rawLine}`);
		}
		const parsed = parseInt(num, 10);
		if (parsed > Constants.MAX_CARDINALITY) {
			throw new ValidationException(lineNumber, "CARDINALITY_NOT_VALID", `Invalid count ${count} in line: ${rawLine}`);
		}
		return parsed;
	}
}
