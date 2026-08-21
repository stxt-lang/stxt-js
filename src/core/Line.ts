import { StringUtils } from "./StringUtils";
/**
 * A source line already split into its indentation and its content, as produced by
 * {@link parseLine}. It is what tells the {@link Parser} whether the line opens a node, continues
 * a text block or is just a comment.
 */
export class Line {
	// Same as in Java: public and immutable fields
	/** Indentation level of the line (one level per tab or per {@link Constants.TAB_SPACES} spaces). */
	public readonly level: number;
	/** Content of the line with the indentation already removed. */
	public readonly content: string;
	/**
	 * True if the line is a comment (`#`). Its indentation has already been validated like a
	 * node's (spec 9), but it produces no node and never moves the hierarchy.
	 */
	public readonly isComment: boolean;
	/** True if the line is a text line belonging to an open BLOCK node (`>>`). */
	public readonly isBlock: boolean;
	/** Number of characters the indentation took up. */
	public readonly indentLength: number;

	/**
	 * Creates a line already split into indentation and content.
	 *
	 * @param level indentation level of the line.
	 * @param content content of the line without its indentation.
	 * @param isComment true if the line is a comment.
	 * @param isBlock true if the line belongs to an open text block.
	 * @param indentLength number of characters the indentation took up.
	 */
	constructor(level: number, content: string, isComment: boolean, isBlock: boolean, indentLength: number) {
		this.level = level;
		this.content = content;
		this.isComment = isComment;
		this.isBlock = isBlock;
		this.indentLength = indentLength;

	}
	/** @returns true if the line has no content beyond blanks (space/tab only, spec 4). */
	isEmpty(): boolean {
		return StringUtils.trim(this.content) === "";
	}
}

