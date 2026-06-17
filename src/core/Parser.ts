import { Node } from "./Node";
import { parseLine } from "./LineParser";
import { Line } from "./Line";
import { createNode } from "./NodeCreator";
import { Observer } from "../processors/Observer";
import { Validator } from "../processors/Validator";
import { ParseResult } from "./ParseResult";
import { ParseException } from "../exceptions/ParseException";

export class Parser {
	private observers: Observer[] = [];
	private validators: Validator[] = [];

	public registerObserver(observer: Observer): void {
		this.observers.push(observer);
	}

	public registerValidator(validator: Validator): void {
		this.validators.push(validator);
	}

	parse(content: string): Node[] {
		const result = this.parseResult(content);
		if (result.hasErrors()) {
			const error: ParseException = result.getErrors()[0];
			throw error;
		}
		return result.getNodes();
	}

	parseResult(content: string): ParseResult {
		content = this.removeUTF8BOM(content);

		const result = new ParseResult();
		const stack: Node[] = [];
		const documents: Node[] = [];

		let lineNumber = 0;

		const lines = content.split(/\r?\n/);

		for (const line of lines) {
			lineNumber++;
			this.processLine(line, lineNumber, stack, documents, result);
		}

		// Cerrar todos los nodos pendientes al EOF
		this.closeToLevel(stack, documents, 0, result);

		// Agregar nodos al resultado
		for (const doc of documents) {
			result.addNode(doc);
		}

		// Retorno resultado
		return result;
	}

	private processLine(lineString: string, lineNumber: number, stack: Node[], documents: Node[], result: ParseResult): void {
		try {
			const lastNode: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			const lastLevel = lastNode ? lastNode.getLevel() : 0;
			const lastNodeText = lastNode ? lastNode.isTextNode() : false;

			// Parseamos línea
			const line: Line = parseLine(lineString, lastNodeText, lastLevel, lineNumber);

			if (line.isComment) {
				// Pasamos a observers
				this.observers.forEach(observer => {
					observer.onComment(lineNumber, lineString);
				});
				return;
			}

			const currentLevel = line.level;

			// Si estamos dentro de un nodo texto, y el nivel indica que sigue siendo texto,
			// añadimos línea de texto y no creamos nodo.
			if (line.isBlock) {
				lastNode!.addTextLine(line.content);
				
				// Notificar a observers sobre la línea de texto
				this.observers.forEach(observer => {
					observer.onTextLine(lastNode!, lineNumber, lineString, line);
				});
				
				return;
			}

			// Si es línea vacía no hacemos nada
			if (line.isEmpty()) {
				return;
			}

			// Cerramos nodos hasta el nivel actual (esto "finaliza" y adjunta al padre/documentos)
			this.closeToLevel(stack, documents, currentLevel, result);

			// Creamos el nuevo nodo y lo dejamos "abierto" en la pila (NO lo adjuntamos aún)
			const parent: Node | null = stack.length === 0 ? null : stack[stack.length - 1];
			const node = createNode(line, lineNumber, currentLevel, parent);

			// Pasamos a observers
			this.observers.forEach(observer => {
				observer.onCreate(node, lineString);
			});

			// Añadimos a stack
			stack.push(node);
		} catch (e: unknown) {
			this.handleError(e, lineNumber, result);
		}
	}

	private handleError(e: unknown, line: number, result: ParseResult, errorCode: string = "UNEXPECTED_ERROR", unknownErrorCode: string = "UNKNOWN_ERROR"): void {
		if (e instanceof ParseException) {
			result.addError(e);
		} else if (e instanceof Error) {
			// Convertir errores genéricos a ParseException
			result.addError(new ParseException(line, errorCode, e.message));
		} else {
			// Error desconocido
			result.addError(new ParseException(line, unknownErrorCode, String(e)));
		}
	}

	private closeToLevel(stack: Node[], documents: Node[], targetLevel: number, result: ParseResult): void {
		while (stack.length > targetLevel) {
			const completed = stack.pop()!;
			completed.freeze();

			// Pasamos validators
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

			if (stack.length === 0) {
				documents.push(completed);
			} else {
				stack[stack.length - 1].addChild(completed);
			}

			// Pasamos a observers
			this.observers.forEach(observer => {
				observer.onFinish(completed);
			});
		}
	}
	private removeUTF8BOM(content: string): string {
		return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
	}
}


