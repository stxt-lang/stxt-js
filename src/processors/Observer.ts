import { Line } from "../core/Line";
import { Node } from "../core/Node";

/**
 * Process hook notified by the {@link Parser} while parsing: when each node is opened and closed,
 * and for every comment and text line it reads. Register it with {@link Parser.registerObserver}.
 */
export interface Observer {
	/**
	 * Called when a node is opened.
	 *
	 * @param node node just opened (its children and its text lines are not complete yet).
	 * @param line source line that opened the node, as it appears in the document.
	 */
	onCreate(node: Node, line:string): void;
	/**
	 * Called when a node is closed.
	 *
	 * @param node node just closed, with all its children and its value already complete.
	 */
	onFinish(node: Node): void;
	/**
	 * Called for every comment line, which produces no node.
	 *
	 * @param lineNumber line number of the comment.
	 * @param line source line of the comment, as it appears in the document.
	 */
	onComment(lineNumber: number, line: string): void;
	/**
	 * Called for every text line appended to an open BLOCK node.
	 *
	 * @param node BLOCK node the line was appended to.
	 * @param lineNumber line number of the text line.
	 * @param lineString source line, as it appears in the document.
	 * @param line the same line already split into indentation and content.
	 */
	onTextLine(node: Node, lineNumber: number, lineString: string, line: Line): void;
}
