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
            // Cardinalidad inválida si min > max (STXT-TEMPLATE-SPEC 7.1)
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

            // Los corchetes presentes (aunque vengan vacíos, "[]") cuentan como una definición
            // explícita de valores: se devuelve un array no-nulo (posiblemente vacío) para
            // distinguirlo de la ausencia total de corchetes (valuesStr null/undefined, values
            // permanece null). Así "[]" se trata como redefinición/definición real (ported
            // from stxt-java).
            values = list;
        }

        // type es string|null en nuestra clase
        return new ChildLine(type ?? null, min, max, values);
    }

    // num, min y max deben ser enteros no negativos, sin texto sobrante (STXT-TEMPLATE-SPEC 7.1)
    private static parseCount(num: string, count: string, rawLine: string, lineNumber: number): number {
        if (!/^\d+$/.test(num)) {
            throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
        }
        return parseInt(num, 10);
    }
}
