import { ValidationException } from "../exceptions/ValidationException";
import { ChildLine } from "./ChildLine";

export class ChildLineParser {
    private constructor() { }

    private static readonly CHILD_LINE_PATTERN =
        /^\s*(?:\(\s*([^()\s][^)]*?)\s*\)\s*)?([^()[\]]*)?(?:\[\s*([^]*?)\s*\]\s*)?\s*$/;

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
            const expectedNum = parseInt(count.substring(0, count.length - 1), 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = expectedNum;
            max = null;
        } else if (count.endsWith("-")) {
            const expectedNum = parseInt(count.substring(0, count.length - 1), 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = null;
            max = expectedNum;
        } else if (count.includes(",")) {
            try {
                const [a, b] = count.split(",", 2);
                const aNum = parseInt(a.trim(), 10);
                const bNum = parseInt(b.trim(), 10);
                if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
                    throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
                }
                min = aNum;
                max = bNum;
            } catch {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
        } else {
            const expectedNum = parseInt(count, 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = expectedNum;
            max = expectedNum;
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

            if (list.length > 0) {
                values = list;
            }
        }

        // type es string|null en nuestra clase
        return new ChildLine(type ?? null, min, max, values);
    }
}
