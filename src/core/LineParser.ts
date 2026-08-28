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
 * previous node are errors (spec 8.1 and 8.3). Comment lines are validated exactly like node lines
 * (spec 9 and 11): they produce no node and never move the hierarchy, but their indentation must
 * be homogeneous, a multiple of four when spaces, and at most one level deeper than the last node.
 * Only empty lines are exempt.
 *
 * @param line source line, with its indentation.
 * @param lastNodeBlock true if the node currently open is a BLOCK text node.
 * @param lastLevel indentation level of the node currently open, -1 when there is none.
 * @param numLine line number, for the error messages.
 * @param validate false to split the line without enforcing the indentation rules.
 * @returns the line already split into indentation and content.
 * @throws ParseException with code `INDENTATION_MIXED`, `INDENTATION_SPACES_NOT_VALID` or
 *         `INDENTATION_LEVEL_NOT_VALID` if the indentation is not valid.
 */
export function parseLine(line: string, lastNodeBlock: boolean, lastLevel: number, numLine: number, validate: boolean = true): Line {
	let level = 0;
	let spaces = 0;
	let pointer = 0;
	let sawSpace = false;
	let sawTab = false;
	let isComment = false;

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
			// Comment line: produces no node, but its indentation is validated below exactly like
			// a node's (spec 9). Reached only when the line is not block text (a '#' deeper than an
			// open block is caught as text by the check below, before getting here), so inside an
			// open block a comment always has indent <= the block node: the Parser closes the block
			// (spec 9.1) and hands the comment over to the observers.
			isComment = true;
			break;
		} else {
			// First character that is not space/tab/comment => end of indentation
			break;
		}

		// Inside the text block
		if (lastNodeBlock && level > lastLevel) {
			const text = StringUtils.rightTrim(line.substring(pointer + 1));
			// The prefix covering the block level must be homogeneous (spec 10.2, rule 2);
			// empty lines are never an error and are exempt from it (spec 10.3)
			if (validate && sawSpace && sawTab && text.length > 0) {
				throw new ParseException(numLine, "INDENTATION_MIXED", `Mixed tabs and spaces in indentation`);
			}
			// pointer is the index of the indentation character that crossed the block level;
			// the indentation took pointer + 1 characters
			return new Line(level, text, false, true, pointer + 1);
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
		throw new ParseException(numLine, "INDENTATION_MIXED", `Mixed tabs and spaces in indentation`);
	}

	// Indentation with spaces that is not a multiple of 4
	if (validate && spaces > 0) {
		throw new ParseException(numLine, "INDENTATION_SPACES_NOT_VALID", `There are ${spaces} spaces before node`);
	}

	// Validate the level (spec 11.3). Comments included (spec 9): lastLevel is the level of the
	// last NODE, a comment never becomes the reference.
	if (validate && level > lastLevel + 1) {
		throw new ParseException(numLine, "INDENTATION_LEVEL_NOT_VALID", `Level of indent incorrect: ${level}`);
	}

	// Comment: the text after '#', verbatim
	if (isComment) {
		return new Line(level, line.substring(pointer + 1), true, false, pointer);
	}

	// General case: return the line without the indentation already consumed
	// Blank-only trim (spec 4): an NBSP after the value is part of it
	return new Line(level, StringUtils.trim(line.substring(pointer)), false, false, pointer);
}
