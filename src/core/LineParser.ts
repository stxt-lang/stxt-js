import { Constants } from "./Constants";
import { StringUtils } from "./StringUtils";
import { ParseException } from "../exceptions/ParseException";
import { Line } from "./Line";

/**
 * Splits a source line into its indentation and its content, and classifies it as a comment, a
 * text line of an open block or a regular line.
 *
 * Indentation is one level per tab or per {@link Constants.TAB_SPACES} spaces; mixing both, using
 * a number of spaces that is not a multiple of four or going more than one level deeper than the
 * previous node are errors (spec 8.1 and 8.3).
 *
 * @param line source line, with its indentation.
 * @param lastNodeBlock true if the node currently open is a BLOCK text node.
 * @param lastLevel indentation level of the node currently open.
 * @param numLine line number, for the error messages.
 * @param validate false to split the line without enforcing the indentation rules.
 * @returns the line already split into indentation and content.
 * @throws ParseException with code `MIXED_INDENTATION`, `INVALID_NUMBER_SPACES` or
 *         `INDENTATION_LEVEL_NOT_VALID` if the indentation is not valid.
 */
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
			// First character that is not space/tab/comment => end of indentation
			break;
		}

		// Inside the text block
		if (lastNodeBlock && level > lastLevel) {
			const text = StringUtils.rightTrim(line.substring(pointer + 1));
			// The prefix covering the block level must be homogeneous (spec 10.2, rule 2);
			// empty lines are always preserved and are exempt from it (spec 10.3)
			if (validate && sawSpace && sawTab && text.length > 0) {
				throw new ParseException(numLine, "MIXED_INDENTATION", `Mixed tabs and spaces in indentation`);
			}
			return new Line(level, text, false, true, pointer);
		}

		// Move the pointer forward
		pointer++;
	}

	// From here on we are outside the text block (if there was one)

	// Empty
	if (pointer === line.length) {
		if (lastNodeBlock) {
			return new Line(level, "", false, true, pointer);
		}
		return new Line(level, "", false, false, pointer);
	}

	// Tabs and spaces mixed in the indentation (spec 8.1 and 8.3)
	if (validate && sawSpace && sawTab) {
		throw new ParseException(numLine, "MIXED_INDENTATION", `Mixed tabs and spaces in indentation`);
	}

	// Indentation with spaces that is not a multiple of 4
	if (validate && spaces > 0) {
		throw new ParseException(numLine, "INVALID_NUMBER_SPACES", `There are ${spaces} spaces before node`);
	}

	// Validate the level
	if (validate && level > lastLevel + 1) {
		throw new ParseException(numLine, "INDENTATION_LEVEL_NOT_VALID", `Level of indent incorrect: ${level}`);
	}

	// General case: return the line without the indentation already consumed
	// Blank-only trim (spec 4): an NBSP after the value is part of it
	return new Line(level, StringUtils.trim(line.substring(pointer)), false, false, pointer);
}
