import { ParseException } from "../exceptions/ParseException";
import { RuntimeException } from "../exceptions/RuntimeException";
import { NamespaceValidator } from "./NamespaceValidator";
import { StringUtils } from "./StringUtils";

/**
 * Node of the STXT tree. Mutable while parsing ({@link Node.addChild}/{@link Node.addTextLine}
 * are public); once the document is closed it must be treated as read-only. It represents both
 * INLINE nodes (with {@link Node.getValue}) and BLOCK text nodes (with {@link Node.getTextLines}),
 * as told apart by {@link Node.isTextNode}.
 */
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

	/**
	 * Creates a node with its full position in the document. This is the constructor the
	 * {@link Parser} uses while parsing.
	 *
	 * @param line line number of the document where the node opens.
	 * @param level indentation level of the node (0 for root nodes).
	 * @param name name of the node.
	 * @param namespace namespace of the node, or null/undefined if it has none.
	 * @param textNode true if it is a text block node (BLOCK); false if it is INLINE.
	 * @param value inline value of the node (INLINE node), ignored when it is BLOCK.
	 * @throws ParseException if the name or the namespace are not valid.
	 */
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

		if (!StringUtils.isValidNodeName(this.name)) {
			throw new ParseException(line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
		}
	}

	/**
	 * Appends a text line to a BLOCK node.
	 *
	 * @param line text line to append to a BLOCK node ({@link Node.isTextNode}).
	 */
	addTextLine(line: string): void {
		this.textLines.push(line);
	}

	/** @returns the original name of the node as it appears in the document (with spaces compacted). */
	getName(): string {
		return this.name;
	}

	/** @returns the canonical name of the node, used to compare/look up by structural identity. */
	getNormalizedName(): string {
		return this.normalizedName;
	}

	/** @returns the canonical name prefixed by its namespace (`namespace:name`), or just the name when there is no namespace. */
	getQualifiedName(): string {
		return this.namespace.length === 0
			? this.normalizedName
			: `${this.namespace}:${this.normalizedName}`;
	}

	/** @returns the effective namespace of the node (its own or inherited from the parent), lower-cased, or the empty string if it has none. */
	getNamespace(): string {
		return this.namespace;
	}

	/** @returns the children of the node in order of appearance, as a read-only view. */
	getChildren(): ReadonlyArray<Node> {
		return this.children;
	}

	/**
	 * Appends an already closed child to this node.
	 *
	 * @param node already closed child to append at the end of this node's list of children.
	 */
	addChild(node: Node): void {
		this.children.push(node);
	}

	/** @returns the inline value of the node (INLINE node), or the empty string if it is a BLOCK node. */
	getValue(): string {
		return this.value;
	}

	/** @returns the text lines of a BLOCK node ({@link Node.isTextNode}), in order of appearance. */
	getTextLines(): ReadonlyArray<string> {
		return this.textLines;
	}

	/** @returns the line number of the document where this node was opened. */
	getLine(): number {
		return this.line;
	}

	/** @returns the indentation level of the node (0 for root nodes). */
	getLevel(): number {
		return this.level;
	}

	/** @returns true if the node is a text block (BLOCK, `>>`); false if it is INLINE. */
	isTextNode(): boolean {
		return this.textNode;
	}

	/** @returns the textual content of the node: the text lines joined with '\n' if it is BLOCK, or the inline value otherwise. */
	getText(): string {
		return this.isTextNode() ? this.textLines.join("\n") : this.value;
	}

	/**
	 * Looks up the only direct child with that name.
	 *
	 * @param cname name of the child to look for.
	 * @param namespace namespace to search in; this node's own namespace when omitted.
	 * @returns the only direct child with that name, or null if there is none.
	 * @throws RuntimeException with code `AMBIGUOUS_CHILD` if there is more than one; use {@link Node.getChildrenByName} then.
	 */
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
	/**
	 * Looks up every direct child with that name.
	 *
	 * @param cname name of the child to look for.
	 * @param namespace namespace to search in; this node's own namespace when omitted.
	 * @returns every direct child with that name in the given namespace, in order of appearance.
	 */
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

	/** @returns a readable representation of the node, for debugging and error messages. */
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
