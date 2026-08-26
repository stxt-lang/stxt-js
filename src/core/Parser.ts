import { Node } from "./Node";
import { InlineNode } from "./InlineNode";
import { TextNode } from "./TextNode";
import { parseLine } from "./LineParser";
import { Line } from "./Line";
import { createNode } from "./NodeCreator";
import { Constants } from "./Constants";
import { Observer } from "../processors/Observer";
import { StreamObserver } from "../processors/StreamObserver";
import { Validator } from "../processors/Validator";
import { ParseResult } from "./ParseResult";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { LimitException } from "../exceptions/LimitException";

/**
 * Parser limits (STXT-SPEC §11.2), configurable per {@link Parser}. Every limit defaults to
 * the `DEFAULT_MAX_*` value of {@link Constants}, and -1 disables it. Lengths are measured in
 * UTF-16 units (`string.length`); for ASCII content they equal characters.
 */
export interface ParserOptions {
	/** Maximum open nesting levels; level 0 is the first. Default {@link Constants.DEFAULT_MAX_NESTING}; -1 disables. */
	maxNesting?: number;
	/** Maximum length of one input line, indentation included. Default {@link Constants.DEFAULT_MAX_LINE_LENGTH}; -1 disables. */
	maxLineLength?: number;
	/** Maximum total input consumed. Default {@link Constants.DEFAULT_MAX_INPUT_SIZE}; -1 disables. */
	maxInputSize?: number;
}

/**
 * Line-by-line STXT parsing engine. It knows nothing about schemas: semantic validation is
 * plugged in through {@link Parser.registerValidator}, process observation through
 * {@link Parser.registerObserver} and result observation through
 * {@link Parser.registerStreamObserver}. See {@link UnifiedSchemaProvider} for the usual way
 * of building the validators to register.
 *
 * Three entry points share one traversal: {@link Parser.parse} (fail-fast),
 * {@link Parser.parseResult} (multi-error) and {@link Parser.parseStream} (line iterator in,
 * nothing retained). Which callbacks fire never depends on the entry point, only on what is
 * registered.
 *
 * The parser aborts on inputs that exceed its limits (STXT-SPEC §11.2), set to the
 * `DEFAULT_MAX_*` values of {@link Constants} unless configured through {@link ParserOptions}.
 * A limit error is a {@link LimitException} and is in every case the last one emitted: the
 * nodes still open are not closed nor notified.
 */
export class Parser {
	private observers: Observer[] = [];
	private streamObservers: StreamObserver[] = [];
	private validators: Validator[] = [];

	private readonly maxNesting: number;
	private readonly maxLineLength: number;
	private readonly maxInputSize: number;

	/**
	 * Creates a parser, optionally with its own limits.
	 *
	 * @param options the {@link ParserOptions} limits; every omitted one takes its default.
	 */
	constructor(options?: ParserOptions) {
		this.maxNesting = options?.maxNesting ?? Constants.DEFAULT_MAX_NESTING;
		this.maxLineLength = options?.maxLineLength ?? Constants.DEFAULT_MAX_LINE_LENGTH;
		this.maxInputSize = options?.maxInputSize ?? Constants.DEFAULT_MAX_INPUT_SIZE;
	}

	/**
	 * Registers an observer, notified when each node is opened and closed.
	 *
	 * @param observer the {@link Observer} to register, notified while parsing.
	 */
	public registerObserver(observer: Observer): void {
		this.observers.push(observer);
	}

	/**
	 * Registers a stream observer, notified with each completed root node and each error, in
	 * every mode.
	 *
	 * @param streamObserver the {@link StreamObserver} to register.
	 */
	public registerStreamObserver(streamObserver: StreamObserver): void {
		this.streamObservers.push(streamObserver);
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
	 * validation) without bailing out on the first one — except a {@link LimitException}, which
	 * aborts and is in every case the last error collected. See {@link ParseResult}.
	 *
	 * @param content the whole STXT document to parse.
	 * @returns the collected result, with the root nodes obtained and every error found.
	 */
	parseResult(content: string): ParseResult {
		const result = new ParseResult();

		const lines = content.split(/\r?\n/);

		// The final line break terminates the last line, it is not an extra empty line
		// (this avoids adding a spurious line to a >> block at EOF, spec 10.3)
		if (lines.length > 0 && lines[lines.length - 1] === "") {
			lines.pop();
		}

		this.parseLines(lines, result);

		return result;
	}

	/**
	 * Streaming mode: input from a line iterable (each item one line, without its line break —
	 * e.g. a generator over a file read lazily), and nothing retained: no nodes, no errors.
	 * Results reach the program only through the registered {@link StreamObserver}s (each
	 * completed root by `onRootNode()`, each error by `onError()`), so memory holds one root
	 * tree at a time. This is the entry point for files that do not fit in memory.
	 *
	 * @param lines the input, line by line.
	 */
	parseStream(lines: Iterable<string>): void {
		this.parseLines(lines, null);
	}

	/**
	 * Shared traversal. With a result, roots and errors are collected into it
	 * (parse/parseResult); with null, nothing is retained (parseStream). Either way every
	 * registered callback fires the same.
	 */
	private parseLines(lines: Iterable<string>, result: ParseResult | null): void {
		const stack: Node[] = [];
		let lineNumber = 0;
		let consumed = 0;

		for (let line of lines) {
			lineNumber++;

			// A UTF-8 BOM only means anything at the very start of the input (spec 3)
			if (lineNumber === 1) {
				line = this.removeUTF8BOM(line);
			}

			// Limits first (spec 11.2): a limit error aborts, leaving the open nodes
			// unclosed and unnotified.
			if (this.maxLineLength !== -1 && line.length > this.maxLineLength) {
				this.emitError(new LimitException(lineNumber, "LIMIT_LINE_LENGTH_EXCEEDED",
					`Line longer than ${this.maxLineLength} characters`), result);
				return;
			}

			consumed += line.length + 1; // the line separator counts as one
			if (this.maxInputSize !== -1 && consumed > this.maxInputSize) {
				this.emitError(new LimitException(lineNumber, "LIMIT_INPUT_SIZE_EXCEEDED",
					`Input larger than ${this.maxInputSize} characters`), result);
				return;
			}

			try {
				this.processLine(line, lineNumber, stack, result);
			} catch (e: unknown) {
				if (e instanceof LimitException) {
					this.emitError(e, result);
					return;
				}
				throw e;
			}
		}

		// Close every node still open at EOF
		this.closeToLevel(stack, 0, result);
	}

	private processLine(lineString: string, lineNumber: number, stack: Node[], result: ParseResult | null): void {
		try {
			const lastNode: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			// The stack holds the open nodes, one per level: its size is the level of the next line's parent
			// With no open node the reference level is -1 (spec 8.3): the first line of the
			// document, and the first after every node has been closed, must be at level 0.
			const lastLevel = lastNode ? stack.length - 1 : -1;
			const lastNodeText = lastNode instanceof TextNode;

			// Parse the line
			const line: Line = parseLine(lineString, lastNodeText, lastLevel, lineNumber);

			if (line.isComment) {
				// Its indentation was validated by parseLine like a node's (spec 9), but it never
				// becomes the reference level: the stack (and so lastLevel) is only moved by nodes.
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

			// Nesting limit (spec 11.2): only a node line can open a new level. Comment and
			// block text lines returned above; with the consecutive-level rule this triggers
			// exactly when the first node at level maxNesting opens.
			if (this.maxNesting !== -1 && currentLevel >= this.maxNesting) {
				throw new LimitException(lineNumber, "LIMIT_NESTING_EXCEEDED",
					`Nesting deeper than ${this.maxNesting} levels`);
			}

			// Close the nodes down to the current level (this "finishes" them: validators and observers run)
			this.closeToLevel(stack, currentLevel, result);

			// Create the new node, attach it to its parent (or keep it as a root if the stack is
			// empty) and leave it "open" on the stack. Attaching links both ends: the node already
			// knows its parent, and so its effective namespace and its level, when the observers
			// see it. The parent is always an InlineNode: a TextNode on top of the stack only
			// takes text lines.
			const parent: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			const node = createNode(line, lineNumber);
			if (parent !== null) {
				(parent as InlineNode).addChild(node);
			}

			// Hand it over to the observers
			this.observers.forEach(observer => {
				observer.onCreate(node, lineString);
			});

			// Push it onto the stack
			stack.push(node);
		} catch (e: unknown) {
			if (e instanceof LimitException) {
				throw e;
			}
			this.handleError(e, lineNumber, result);
		}
	}

	/**
	 * Records an error raised while parsing or validating a line. Typed exceptions travel as they
	 * are; anything else is wrapped under the code `UNEXPECTED_ERROR` (as a ValidationException
	 * when it was raised by a validator, so that the subtype still tells the phase apart).
	 */
	private handleError(e: unknown, line: number, result: ParseResult | null, validating: boolean = false): void {
		if (e instanceof ParseException) {
			this.emitError(e, result);
		} else {
			const message = e instanceof Error ? e.message : String(e);
			this.emitError(validating
				? new ValidationException(line, "UNEXPECTED_ERROR", message)
				: new ParseException(line, "UNEXPECTED_ERROR", message), result);
		}
	}

	/**
	 * Every error goes through here: collected into the result when there is one, and notified
	 * to the stream observers always, in order of appearance.
	 */
	private emitError(error: ParseException, result: ParseResult | null): void {
		if (result !== null) {
			result.addError(error);
		}

		this.streamObservers.forEach(streamObserver => {
			streamObserver.onError(error);
		});
	}

	private closeToLevel(stack: Node[], targetLevel: number, result: ParseResult | null): void {
		while (stack.length > targetLevel) {
			const completed = stack.pop()!;

			// Hand it over to the validators
			this.validators.forEach(validator => {
				try {
					const errors = validator.validate(completed);
					errors.forEach(error => {
						this.emitError(error, result);
					});
				} catch (e: unknown) {
					this.handleError(e, completed.getLine(), result, true);
				}
			});

			// Hand it over to the observers
			this.observers.forEach(observer => {
				observer.onFinish(completed);
			});

			// A closed root: the stream observers receive it, the result collects it
			if (stack.length === 0) {
				this.streamObservers.forEach(streamObserver => {
					streamObserver.onRootNode(completed);
				});

				if (result !== null) {
					result.addNode(completed);
				}
			}
		}
	}

	private removeUTF8BOM(content: string): string {
		return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
	}
}
