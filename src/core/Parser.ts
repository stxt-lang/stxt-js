import { Node } from "./Node";
import { InlineNode } from "./InlineNode";
import { TextNode } from "./TextNode";
import { parseLine } from "./LineParser";
import { Line } from "./Line";
import { createNode } from "./NodeCreator";
import { Observer } from "../processors/Observer";
import { Validator } from "../processors/Validator";
import { ParseResult } from "./ParseResult";
import { ParseException } from "../exceptions/ParseException";

/**
 * Line-by-line STXT parsing engine. It knows nothing about schemas: semantic validation is
 * plugged in through {@link Parser.registerValidator} and {@link Parser.registerObserver}.
 * See {@link UnifiedSchemaProvider} for the usual way of building the validators to register.
 */
export class Parser {
	private observers: Observer[] = [];
	private validators: Validator[] = [];

	/**
	 * Registers an observer, notified when each node is opened and closed.
	 *
	 * @param observer the {@link Observer} to register, notified while parsing.
	 */
	public registerObserver(observer: Observer): void {
		this.observers.push(observer);
	}

	/**
	 * Registers a validator, invoked when each node is closed.
	 *
	 * @param validator the {@link Validator} to register, invoked when each node is closed during parsing.
	 */
	public registerValidator(validator: Validator): void {
		this.validators.push(validator);
	}

	/**
	 * Traditional fail-fast mode: throws the first error found (either syntax or validation).
	 * Internally it reuses the same traversal as {@link Parser.parseResult}, and throws the first
	 * error it collected.
	 *
	 * @param content the whole STXT document to parse.
	 * @returns the root nodes of the document.
	 * @throws ParseException the first error found, be it syntax or validation.
	 */
	parse(content: string): Node[] {
		const result = this.parseResult(content);
		if (result.hasErrors()) {
			const error: ParseException = result.getErrors()[0];
			throw error;
		}
		return result.getNodes();
	}

	/**
	 * Multi-error mode: parses the whole content collecting every error found (both syntax and
	 * validation) without bailing out on the first one. See {@link ParseResult}.
	 *
	 * @param content the whole STXT document to parse.
	 * @returns the collected result, with the root nodes obtained and every error found.
	 */
	parseResult(content: string): ParseResult {
		content = this.removeUTF8BOM(content);

		const result = new ParseResult();
		const stack: Node[] = [];
		const documents: Node[] = [];

		let lineNumber = 0;

		const lines = content.split(/\r?\n/);

		// The final line break terminates the last line, it is not an extra empty line
		// (this avoids adding a spurious line to a >> block at EOF, spec 10.3)
		if (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop();
		}

		for (const line of lines) {
			lineNumber++;
			this.processLine(line, lineNumber, stack, documents, result);
		}

		// Close every node still open at EOF
		this.closeToLevel(stack, 0, result);

		// Add the nodes to the result
		for (const doc of documents) {
			result.addNode(doc);
		}

		// Return the result
		return result;
	}

	private processLine(lineString: string, lineNumber: number, stack: Node[], documents: Node[], result: ParseResult): void {
		try {
			const lastNode: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			// The stack holds the open nodes, one per level: its size is the level of the next line's parent
			const lastLevel = lastNode ? stack.length - 1 : 0;
			const lastNodeText = lastNode instanceof TextNode;

			// Parse the line
			const line: Line = parseLine(lineString, lastNodeText, lastLevel, lineNumber);

			if (line.isComment) {
				// A comment at the level of an open block node (or shallower) closes the block
				// (spec 6.1 and 9.1): a block is a literal and cannot be commented from inside.
				// Only the block closes; the comment does not touch the rest of the hierarchy.
				if (lastNodeText) {
					this.closeToLevel(stack, stack.length - 1, result);
				}

				// Hand it over to the observers
				this.observers.forEach(observer => {
					observer.onComment(lineNumber, lineString);
				});
				return;
			}

			const currentLevel = line.level;

			// When we are inside a text node and the level says it is still text,
			// append the text line instead of creating a node.
			if (line.isBlock) {
				const textNode = lastNode as TextNode;
				textNode.addTextLine(line.content);

				// Notify the observers about the text line
				this.observers.forEach(observer => {
					observer.onTextLine(textNode, lineNumber, lineString, line);
				});

				return;
			}

			// Empty lines are ignored
			if (line.isEmpty()) {
				return;
			}

			// Close the nodes down to the current level (this "finishes" them: validators and observers run)
			this.closeToLevel(stack, currentLevel, result);

			// Create the new node, attach it to its parent (or to the documents if it is a root)
			// and leave it "open" on the stack. Attaching links both ends: the node already knows
			// its parent, and so its effective namespace and its level, when the observers see it.
			// The parent is always an InlineNode: a TextNode on top of the stack only takes text lines.
			const parent: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			const node = createNode(line, lineNumber);
			if (parent === null) {
				documents.push(node);
			} else {
				(parent as InlineNode).addChild(node);
			}

			// Hand it over to the observers
			this.observers.forEach(observer => {
				observer.onCreate(node, lineString);
			});

			// Push it onto the stack
			stack.push(node);
		} catch (e: unknown) {
			this.handleError(e, lineNumber, result);
		}
	}

	private handleError(e: unknown, line: number, result: ParseResult, errorCode: string = "UNEXPECTED_ERROR", unknownErrorCode: string = "UNKNOWN_ERROR"): void {
		if (e instanceof ParseException) {
			result.addError(e);
		} else if (e instanceof Error) {
			// Turn generic errors into a ParseException
			result.addError(new ParseException(line, errorCode, e.message));
		} else {
			// Unknown error
			result.addError(new ParseException(line, unknownErrorCode, String(e)));
		}
	}

	private closeToLevel(stack: Node[], targetLevel: number, result: ParseResult): void {
		while (stack.length > targetLevel) {
			const completed = stack.pop()!;

			// Hand it over to the validators
			this.validators.forEach(validator => {
				try {
					const errors = validator.validate(completed);
					errors.forEach(error => {
						result.addError(error);
					});
				} catch (e: unknown) {
					this.handleError(e, completed.getLine(), result, "VALIDATION_ERROR", "UNKNOWN_VALIDATION_ERROR");
				}
			});

			// Hand it over to the observers
			this.observers.forEach(observer => {
				observer.onFinish(completed);
			});
		}
	}
	private removeUTF8BOM(content: string): string {
		return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
	}
}


