import { ValidationException } from "../exceptions/ValidationException";
import { ChildLine } from "./ChildLine";

/** Parses the inline value of a child node inside an `@stxt.template`, shaped as `(min,max) TYPE [values]`. */
export class ChildLineParser {
    private constructor() { }

    private static readonly CHILD_LINE_PATTERN =
        /^\s*(?:\(\s*([^()\s][^)]*?)\s*\)\s*)?([^()[\]]*)?(?:\[\s*([^]*?)\s*\]\s*)?\s*$/;

    /**
     * Parses a definition line into its type, its cardinality and its allowed values.
     *
     * @param rawLine inline value of the node, `(min,max) TYPE [values]`.
     * @param lineNumber line number, for the error messages.
     * @returns the line already split into type, cardinality and values.
     * @throws ValidationException with code `INVALID_CHILD_LINE`, `INVALID_CHILD_COUNT`,
     *         `MIN_GREATER_THAN_MAX` or `VALUE_DUPLICATED` if the line is not valid.
     */
    static parse(rawLine: string, lineNumber: number): ChildLine {
        if (rawLine.trim().length === 0) {
            return new ChildLine(null, null, null, null);
        }

        const m = ChildLineParser.CHILD_LINE_PATTERN.exec(rawLine);
        if (!m) {
            throw new ValidationException(lineNumber, "INVALID_CHILD_LINE", `Line not valid: ${rawLine}`);
        }

        // m[1]=count, m[2]=type, m[3]=values
        let type = m[2]?.trim() ?? "";
        if (type.length === 0) {
            type = null as any;
        }

        const count = (m[1] ?? "").trim();
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
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            const aNum = ChildLineParser.parseCount(parts[0].trim(), count, rawLine, lineNumber);
            const bNum = ChildLineParser.parseCount(parts[1].trim(), count, rawLine, lineNumber);
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
        const valuesStr = m[3];

        if (valuesStr !== null && valuesStr !== undefined) {
            const parts = valuesStr.split(",");
            const list: string[] = [];

            for (let part of parts) {
                part = part.trim();
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

        // type is string|null in our class
        return new ChildLine(type ?? null, min, max, values);
    }

    // num, min and max must be non-negative integers, with no trailing text (STXT-TEMPLATE-SPEC 7.1)
    private static parseCount(num: string, count: string, rawLine: string, lineNumber: number): number {
        if (!/^\d+$/.test(num)) {
            throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
        }
        return parseInt(num, 10);
    }
}
