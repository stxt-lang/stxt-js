import { Constants } from "./Constants";
import { StringUtils } from "./StringUtils";
import { ParseException } from "../exceptions/ParseException";
import { Line } from "./Line";

export function parseLine(line: string, lastNodeBlock: boolean, lastLevel: number, numLine: number, validate: boolean = true): Line {
	let level = 0;
	let spaces = 0;
	let pointer = 0;
	let sawSpace = false;
	let sawTab = false;

	while (pointer < line.length) {
		const c = line.charAt(pointer);

		if (c === Constants.SPACE) {
			sawSpace = true;
			spaces++;
			if (spaces === Constants.TAB_SPACES) {
				level++;
				spaces = 0;
			}
		} else if (c === Constants.TAB) {
			sawTab = true;
			level++;
			spaces = 0;
		} else if (c === Constants.COMMENT_CHAR) {
			return new Line(level, line.substring(pointer + 1), true, false, pointer);
		} else {
			// Primer carácter no espacio/tab/comentario => fin de indentación
			break;
		}

		// Dentro del bloque de texto
		if (lastNodeBlock && level > lastLevel) {
			const text = StringUtils.rightTrim(line.substring(pointer + 1));
			// El prefijo que cubre el nivel de bloque debe ser homogéneo (spec 10.2, regla 2);
			// las líneas vacías se preservan siempre y quedan exentas (spec 10.3)
			if (validate && sawSpace && sawTab && text.length > 0) {
				throw new ParseException(numLine, "MIXED_INDENTATION", `Mixed tabs and spaces in indentation`);
			}
			return new Line(level, text, false, true, pointer);
		}

		// Aumentamos pointer
		pointer++;
	}

	// En este punto ya estamos fuera de bloque de texto (si existía)

	// Empty
	if (pointer === line.length) {
		if (lastNodeBlock) {
			return new Line(level, "", false, true, pointer);
		}
		return new Line(level, "", false, false, pointer);
	}

	// Mezcla de espacios y tabuladores en la indentación (spec 8.1 y 8.3)
	if (validate && sawSpace && sawTab) {
		throw new ParseException(numLine, "MIXED_INDENTATION", `Mixed tabs and spaces in indentation`);
	}

	// Indentación no es múltiplo de 4 con espacios
	if (validate && spaces > 0) {
		throw new ParseException(numLine, "INVALID_NUMBER_SPACES", `There are ${spaces} spaces before node`);
	}

	// Validamos level
	if (validate && level > lastLevel + 1) {
		throw new ParseException(numLine, "INDENTATION_LEVEL_NOT_VALID", `Level of indent incorrect: ${level}`);
	}

	// Caso general: devolver la línea sin la indentación consumida
	return new Line(level, line.substring(pointer).trim(), false, false, pointer);
}
