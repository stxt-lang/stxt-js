import { Line } from "../core/Line";
import { Node } from "../core/Node";

export interface Observer {
	onCreate(node: Node, line:string): void;
	onFinish(node: Node): void;
	onComment(lineNumber: number, line: string): void;
	onTextLine(node: Node, lineNumber: number, lineString: string, line: Line): void;
}
