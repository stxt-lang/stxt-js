import { Line } from "../core/Line";
import { InlineNode } from "../core/InlineNode";
import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { TextNode } from "../core/TextNode";
import { ParseException } from "../exceptions/ParseException";
import { Observer } from "../processors/Observer";
import { IndentStyle } from "./NodeWriter";

/** The outcome of {@link Formatter.format}. */
export interface FormatResult {
	/**
	 * The formatted document: the same lines as the source, in the same order, with the same
	 * line ending (CRLF is kept) and with a final newline only where the source had one.
	 */
	text: string;
	/**
	 * Syntax errors found while parsing, in line order; empty when the document parses. A line
	 * the parse tree does not describe because of an error is only converted by indentation
	 * units and right-trimmed (see {@link Formatter}): formatting never repairs a document, and
	 * whether a document with errors should be reformatted at all is the caller's decision.
	 */
	errors: ParseException[];
}

/**
 * Reformats an STXT document **line by line, over the original text**, so that nothing the
 * parse tree does not hold — comments, blank lines, the exact content of text blocks — is lost.
 * This is what distinguishes it from {@link NodeWriter}, which re-serializes the tree and
 * therefore drops comments and blank lines.
 *
 * The rules, the same for every tool of the ecosystem (the CLI's `stxt format`, the VS Code
 * extension's formatter and the playground's re-indentation all delegate here):
 *
 * - A line that **opens a node** is rendered in canonical form: the indentation of its level in
 *   the requested style, the name as parsed, the namespace only where the source wrote it (a
 *   child repeating its parent's namespace is redundant but legal, and dropping it would be an
 *   edit, not a reformat), `: value` with exactly one space — or a bare `:` when there is no
 *   value, so container nodes do not end in a stray space — or ` >>` for a block.
 * - A **text line of a block** gets the indentation of the block (its level plus one) in the
 *   requested style, followed by its content; any indentation the line had beyond the block's
 *   is content (STXT-SPEC §10.2, relative indentation is preserved) and is kept exactly. A
 *   blank line of the block is `""` in the content whatever it looks like in the source
 *   (STXT-SPEC §10.3), so it is written with the indentation of the block too: the block reads
 *   as one piece and, at the end of the file, the line is not lost — an empty last line would
 *   be indistinguishable from the final line ending.
 * - Every **other line** — a comment, a blank line outside a block, or a line the parse tree
 *   does not describe because of a syntax error — is kept as the author wrote it, except that
 *   its trailing blanks are removed and the whole indentation units at its start are converted
 *   one for one to the requested style (a tab or four spaces in either style count as a unit;
 *   whatever follows the last whole unit, including a remainder that is not a whole unit, is
 *   kept as it is). STXT-SPEC §9 validates the indentation of a comment like a node's, so in a
 *   document that parses every comment has a whole number of units and comes out fully in the
 *   new style; the remainder only survives in documents with errors, which this conversion
 *   neither repairs nor hides.
 *
 * These are the rules of STXT-TREE-SPEC 12 (`stxt-impl/core/formatter.txt`). The result is
 * idempotent, round-trips between the two styles, and produces the same canonical tree as the
 * source; an initial BOM is removed. The document is parsed without any schema: formatting
 * has nothing to do with validation.
 */
export class Formatter {
	private constructor() { }

	/**
	 * Formats a document.
	 *
	 * @param text the document.
	 * @param style indentation style to format with; tabs by default.
	 * @returns the formatted text and the syntax errors found; see {@link FormatResult}.
	 */
	static format(text: string, style: IndentStyle = IndentStyle.TABS): FormatResult {
		// STXT-TREE-SPEC 12.1: an initial BOM is not kept
		if (text.startsWith("\uFEFF")) {
			text = text.substring(1);
		}
		const sourceLines = new SourceLines();
		const parser = new Parser();
		parser.registerObserver(sourceLines);
		const result = parser.parseResult(text);

		const eol = text.includes("\r\n") ? "\r\n" : "\n";
		const formatted = text
			.split(/\r?\n/)
			.map((line, index) => Formatter.formatLine(line, index + 1, style, sourceLines))
			.join(eol);

		return { text: formatted, errors: result.getErrors() };
	}

	/**
	 * Formats one source line.
	 *
	 * @param line the line, without its line ending.
	 * @param lineNumber its line number, 1-indexed as the parser counts them.
	 * @param style indentation style to format with.
	 * @param sourceLines the parse of the document seen as source lines.
	 * @returns the formatted line.
	 */
	private static formatLine(line: string, lineNumber: number, style: IndentStyle, sourceLines: SourceLines): string {
		const node = sourceLines.nodeAt(lineNumber);
		if (node) {
			return Formatter.renderNode(node, line, style);
		}

		const text = sourceLines.textAt(lineNumber);
		if (text) {
			return Formatter.indent(text.node.getLevel() + 1, style) + text.line.content;
		}

		return Formatter.convertUnits(StringUtils.rightTrim(line), style);
	}

	/**
	 * Renders the line that opens a node in its canonical form.
	 *
	 * @param node the node the line opens.
	 * @param line the source line, used only to tell whether it spelled the namespace out.
	 * @param style indentation style to format with.
	 * @returns the formatted line.
	 */
	private static renderNode(node: Node, line: string, style: IndentStyle): string {
		const indent = Formatter.indent(node.getLevel(), style);
		const head = node instanceof InlineNode ? line.substring(0, line.indexOf(":")) : line;
		const name = head.includes("(")
			? `${node.getName()} (${node.getNamespace()})`
			: node.getName();

		if (node instanceof TextNode) {
			return `${indent}${name} >>`;
		}

		const value = (node as InlineNode).getValue();
		return value.length > 0 ? `${indent}${name}: ${value}` : `${indent}${name}:`;
	}

	/**
	 * Converts the whole indentation units at the start of a line to the requested style and
	 * keeps the rest of the line, remainder included.
	 *
	 * @param line the line, without trailing blanks.
	 * @param style indentation style to convert to.
	 * @returns the line with its indentation units converted.
	 */
	private static convertUnits(line: string, style: IndentStyle): string {
		let consumed = 0;
		let units = 0;
		let unit = Formatter.unitAt(line, consumed);
		while (unit > 0) {
			consumed += unit;
			units++;
			unit = Formatter.unitAt(line, consumed);
		}
		return units === 0 ? line : Formatter.indent(units, style) + line.substring(consumed);
	}

	/**
	 * @param line a line.
	 * @param position a position in it.
	 * @returns the length of the whole indentation unit — a tab or four spaces — that starts at
	 *          `position`, or 0 if none does.
	 */
	private static unitAt(line: string, position: number): number {
		if (line.startsWith("\t", position)) {
			return 1;
		}
		return line.startsWith("    ", position) ? 4 : 0;
	}

	/**
	 * @param level indentation level to produce.
	 * @param style indentation style to produce it in.
	 * @returns the indentation of that level.
	 */
	private static indent(level: number, style: IndentStyle): string {
		return (style === IndentStyle.SPACES_4 ? "    " : "\t").repeat(level);
	}
}

/**
 * The parse of a document seen as source lines: which line opened which node, and which line is
 * a text line of which block. It is what lets the formatter rewrite the lines the parse tree
 * describes and leave every other line as the author wrote it.
 */
class SourceLines implements Observer {
	private readonly nodeByLine = new Map<number, Node>();
	private readonly textByLine = new Map<number, { node: TextNode; line: Line }>();

	onCreate(node: Node): void {
		this.nodeByLine.set(node.getLine(), node);
	}

	onFinish(): void {
		// Formatting only needs to know where each node started.
	}

	onComment(): void {
		// Comment lines need no bookkeeping: every line that opens no node is treated alike.
	}

	onTextLine(node: TextNode, lineNumber: number, lineString: string, line: Line): void {
		this.textByLine.set(lineNumber, { node, line });
	}

	/**
	 * @param lineNumber line number, 1-indexed.
	 * @returns the node this line opened, or undefined if it opened none.
	 */
	nodeAt(lineNumber: number): Node | undefined {
		return this.nodeByLine.get(lineNumber);
	}

	/**
	 * @param lineNumber line number, 1-indexed.
	 * @returns the block node this line is text of and the line already split into indentation
	 *          and content, or undefined if the line is not text of a block.
	 */
	textAt(lineNumber: number): { node: TextNode; line: Line } | undefined {
		return this.textByLine.get(lineNumber);
	}
}
