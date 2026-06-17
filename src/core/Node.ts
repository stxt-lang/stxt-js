import { ParseException } from "../exceptions/ParseException";
import { RuntimeException } from "../exceptions/RuntimeException";
import { NamespaceValidator } from "./NamespaceValidator";
import { StringUtils } from "./StringUtils";

export class Node {
	private readonly name: string;
	private readonly normalizedName: string;
	private readonly namespace: string;
	private readonly textNode: boolean;

	private readonly value: string;
	private textLines: string[] = [];
	private readonly line: number;
	private readonly level: number;
	private children: Node[] = [];
	private isFrozen = false;

	constructor(line: number,level: number,name: string,namespace: string | null | undefined,textNode: boolean,value: string | null | undefined) {
		this.level = level;
		this.line = line;

		this.name = StringUtils.compactSpaces(name);
		this.normalizedName = StringUtils.normalize(name);
		this.namespace = StringUtils.lowerCase(namespace);
		this.value = (value ?? "").trim();
		this.textNode = textNode;

		NamespaceValidator.validateNamespaceFormat(this.namespace, line);

		if (this.value.length > 0 && this.isTextNode()) {
			throw new RuntimeException("INLINE_VALUE_NOT_VALID", "Not empty value with textNode");
		}

		if (this.normalizedName.length === 0) {
			throw new ParseException(line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
		}
	}

	addTextLine(line: string): void {
		this.textLines.push(line);
	}

	getName(): string {
		return this.name;
	}

	getNormalizedName(): string {
		return this.normalizedName;
	}

	getQualifiedName(): string {
		return this.namespace.length === 0
			? this.normalizedName
			: `${this.namespace}:${this.normalizedName}`;
	}

	getNamespace(): string {
		return this.namespace;
	}

	getChildren(): ReadonlyArray<Node> {
		return this.children;
	}

	addChild(node: Node): void {
		if (this.isFrozen) {
			throw new RuntimeException("NODE_FROZEN", "Node is frozen");
		}
		this.children.push(node);
	}

	getValue(): string {
		return this.value;
	}

	getTextLines(): ReadonlyArray<string> {
		return this.textLines;
	}

	getLine(): number {
		return this.line;
	}

	getLevel(): number {
		return this.level;
	}

	isTextNode(): boolean {
		return this.textNode;
	}

	getText(): string {
		return this.isTextNode() ? this.textLines.join("\n") : this.value;
	}

	freeze(): void {
		if (this.isFrozen) {
			return;
		}

		for (const n of this.children) {
			n.freeze();
		}

		Object.freeze(this.children);
		Object.freeze(this.textLines);

		this.isFrozen = true;
	}

	getChild(cname: string, namespace?: string): Node | null {
		const result = this.getChildrenByName(cname, namespace);
		if (result.length > 1) {
			throw new RuntimeException("AMBIGUOUS_CHILD", "More than 1 child. Use getChildren");
		}
		if (result.length === 0) {
			return null;
		}
		return result[0];
	}

	// Fast access methods to children
	getChildrenByName(cname: string, namespace?: string): Node[] {
		const key = StringUtils.normalize(cname);
		const targetNamespace = namespace !== undefined ? namespace : this.namespace;
		const result: Node[] = [];

		for (const child of this.children) {
			if (child.getNormalizedName() === key && child.getNamespace() === targetNamespace) {
				result.push(child);
			}
		}
		return result;
	}

	toString(): string {
		let s = "Node{";
		s += `line=${this.line}`;
		s += `, level=${this.level}`;
		s += `, name='${this.name}'`;
		if (this.namespace.length > 0) {
			s += `, ns='${this.namespace}'`;
		}
		s += `, text=${this.textNode}`;
		if (!this.textNode && this.value.length > 0) {
			s += `, value='${this.value}'`;
		}
		if (this.textNode) {
			s += `, lines=${this.textLines.length}`;
		}
		s += `, children=${this.children.length}`;
		s += "}";
		return s;
	}
}
