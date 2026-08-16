import { Node } from "./Node";

/**
 * BLOCK text node of the STXT tree (`Name >>`): an ordered list of literal text lines. It has no
 * inline value and no children; its content is only text.
 *
 * Overloads with two strings always take the second one as the *content* (the text); the
 * namespace only exists in the three-argument forms.
 */
export class TextNode extends Node {
	private readonly lines: string[] = [];

	/**
	 * Creates an empty text node with no declared namespace and no known source line.
	 *
	 * @param name name of the node.
	 */
	constructor(name: string);
	/**
	 * Creates a text node with its text, no declared namespace and no known source line.
	 *
	 * @param name name of the node.
	 * @param text text of the node (split into lines at every line break), or its lines.
	 */
	constructor(name: string, text: string | ReadonlyArray<string> | null | undefined);
	/**
	 * Creates a text node with a declared namespace and its text; the source line is optional.
	 * This is the form the {@link Parser} uses (with no text yet: it appends the lines with
	 * {@link TextNode.addTextLine}).
	 *
	 * @param name name of the node.
	 * @param namespace namespace the node declares, or null/undefined/empty for none.
	 * @param text text of the node (split into lines at every line break), or its lines.
	 * @param line source line, or {@link Node.NO_LINE} (the default).
	 * @throws ParseException if the name or the namespace are not valid.
	 */
	constructor(name: string, namespace: string | null | undefined, text: string | ReadonlyArray<string> | null | undefined, line?: number);
	constructor(name: string, ...rest: (string | ReadonlyArray<string> | number | null | undefined)[]) {
		// With two arguments the second one is the text; the namespace only exists with three or more
		const [namespace, text, line] = rest.length <= 1
			? [null, rest[0] as string | ReadonlyArray<string> | null | undefined, Node.NO_LINE]
			: [rest[0] as string | null | undefined, rest[1] as string | ReadonlyArray<string> | null | undefined, (rest[2] as number | undefined) ?? Node.NO_LINE];
		super(name, namespace, line);
		this.setText(text);
	}

	// ----------------------------------------------------------------
	// Text
	// ----------------------------------------------------------------

	/** @returns the text lines of the node, in order, as a read-only view. */
	getTextLines(): ReadonlyArray<string> {
		return this.lines;
	}

	/**
	 * Replaces the whole text of the node.
	 *
	 * @param text new text, split into lines at every line break (LF or CRLF), or the lines
	 *        themselves; null/undefined empties the node.
	 */
	setText(text: string | ReadonlyArray<string> | null | undefined): void {
		this.lines.length = 0;
		if (typeof text === "string") {
			this.lines.push(...TextNode.splitLines(text));
		} else if (text) {
			this.lines.push(...text);
		}
	}

	/**
	 * Replaces the whole text of the node with the given lines.
	 *
	 * @param lines new text lines; null/undefined empties the node.
	 */
	setTextLines(lines: ReadonlyArray<string> | null | undefined): void {
		this.setText(lines);
	}

	/**
	 * Appends a text line.
	 *
	 * @param line text line to append.
	 */
	addTextLine(line: string): void {
		this.lines.push(line);
	}

	/** Removes every text line. */
	clearText(): void {
		this.lines.length = 0;
	}

	getText(): string {
		return this.lines.join("\n");
	}

	isTextNode(): boolean {
		return true;
	}

	// LF or CRLF; the trailing part after the last break is a line too (possibly empty)
	private static splitLines(text: string): string[] {
		return text.split(/\r?\n/);
	}

	protected describe(): string {
		return `, lines=${this.lines.length}`;
	}
}
