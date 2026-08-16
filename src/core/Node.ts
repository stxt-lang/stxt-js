import { ParseException } from "../exceptions/ParseException";
import { NamespaceValidator } from "./NamespaceValidator";
import { StringUtils } from "./StringUtils";
import type { InlineNode } from "./InlineNode";

/**
 * Node of the STXT tree: what INLINE nodes ({@link InlineNode}) and BLOCK text nodes
 * ({@link TextNode}) have in common. Those two are the only forms, and each one owns what is
 * really its own — only an `InlineNode` has a value and children (and so the child lookups); only
 * a `TextNode` has text lines. Code that walks a tree asks for the form
 * (`node instanceof InlineNode`), the same way the canonical tree of STXT-TREE-SPEC has
 * `children` only for inline nodes.
 *
 * Nodes are mutable, and the tree keeps its own integrity: a node knows its
 * {@link Node.getParent | parent} (always an `InlineNode`), {@link InlineNode.addChild} links
 * both ends and refuses a node that already has a parent, and {@link InlineNode.removeChild} /
 * {@link Node.detach} undo it. The {@link Node.getLevel | level} is derived from the chain of
 * parents, never stored.
 *
 * The namespace a node *declares* ({@link Node.getDeclaredNamespace}) and the one that *applies*
 * to it ({@link Node.getNamespace}) are different things: the effective namespace is the declared
 * one or, failing that, the parent's effective namespace (STXT-SPEC: namespaces are inherited
 * vertically). Changing the declared namespace of a node therefore changes the effective
 * namespace of the whole subtree that inherited it, and so does moving a subtree.
 *
 * The source line ({@link Node.getLine}) is optional: the parser sets it, code that builds trees
 * usually does not ({@link Node.NO_LINE}).
 */
export abstract class Node {
	/** Value of {@link Node.getLine} when the node has no known position in a document. */
	static readonly NO_LINE = -1;

	private name!: string;
	private canonicalName!: string;
	private declaredNamespace!: string;
	private line: number;
	private parent: InlineNode | null = null;

	/**
	 * Common initialisation, for the two concrete forms.
	 *
	 * @param name name of the node.
	 * @param namespace namespace the node declares, or null/undefined/empty if it declares none.
	 * @param line source line, or {@link Node.NO_LINE}.
	 * @throws ParseException with code `INVALID_NODE_NAME` if the name is not a valid STXT node
	 *         name, or if the namespace does not have a valid format.
	 */
	protected constructor(name: string, namespace: string | null | undefined, line: number) {
		this.line = line;
		this.setName(name);
		this.setNamespace(namespace);
	}

	// ----------------------------------------------------------------
	// Name
	// ----------------------------------------------------------------

	/** @returns the original name of the node as it appears in the document (with spaces compacted). */
	getName(): string {
		return this.name;
	}

	/**
	 * Renames the node. The canonical name is recomputed.
	 *
	 * @param name new name of the node.
	 * @throws ParseException with code `INVALID_NODE_NAME` if it is not a valid STXT node name.
	 */
	setName(name: string): void {
		const compacted = StringUtils.compactSpaces(name);
		if (!StringUtils.isValidNodeName(compacted)) {
			throw new ParseException(this.line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
		}
		this.name = compacted;
		this.canonicalName = StringUtils.normalize(name);
	}

	/** @returns the canonical name of the node (STXT-SPEC §4.3), used to compare/look up by structural identity. */
	getCanonicalName(): string {
		return this.canonicalName;
	}

	/**
	 * @returns the canonical name of the node.
	 * @deprecated since 0.7.0, use {@link Node.getCanonicalName}; "canonical name" is the term of
	 *             the specifications. To be removed in a later version.
	 */
	getNormalizedName(): string {
		return this.canonicalName;
	}

	/** @returns the canonical name prefixed by the effective namespace (`namespace:name`), or just the canonical name when there is no namespace. */
	getQualifiedName(): string {
		const namespace = this.getNamespace();
		return namespace.length === 0 ? this.canonicalName : `${namespace}:${this.canonicalName}`;
	}

	// ----------------------------------------------------------------
	// Namespace
	// ----------------------------------------------------------------

	/** @returns the namespace this node declares itself, lower-cased, or the empty string if it declares none (and so inherits the parent's). */
	getDeclaredNamespace(): string {
		return this.declaredNamespace;
	}

	/**
	 * Sets the namespace this node declares. The empty string (or null/undefined) means "none":
	 * the node then inherits the effective namespace of its parent.
	 *
	 * @param namespace namespace to declare, or null/undefined/empty for none.
	 * @throws ParseException if the namespace does not have a valid format (STXT-SPEC §7).
	 */
	setNamespace(namespace: string | null | undefined): void {
		const lower = StringUtils.lowerCase(namespace);
		NamespaceValidator.validateNamespaceFormat(lower, this.line);
		this.declaredNamespace = lower;
	}

	/** @returns the effective namespace of the node: the one it declares or, failing that, the effective namespace of its parent; the empty string if there is none. */
	getNamespace(): string {
		if (this.declaredNamespace.length > 0) {
			return this.declaredNamespace;
		}
		return this.parent ? this.parent.getNamespace() : "";
	}

	// ----------------------------------------------------------------
	// Position in the source
	// ----------------------------------------------------------------

	/** @returns the line number of the document where this node was opened, or {@link Node.NO_LINE} if unknown. */
	getLine(): number {
		return this.line;
	}

	/**
	 * Sets the source line of the node.
	 *
	 * @param line line number, or {@link Node.NO_LINE} if unknown.
	 */
	setLine(line: number): void {
		this.line = line;
	}

	/** @returns the depth of the node in its tree: 0 for a root node, 1 for its children, and so on. */
	getLevel(): number {
		let level = 0;
		for (let p: InlineNode | null = this.parent; p !== null; p = p.getParent()) {
			level++;
		}
		return level;
	}

	// ----------------------------------------------------------------
	// Tree
	// ----------------------------------------------------------------

	/** @returns the parent of this node, or null if it is a root node. */
	getParent(): InlineNode | null {
		return this.parent;
	}

	/**
	 * Removes this node from its parent, if it has one. Afterwards the node is a root, and its
	 * effective namespace is the one it declares.
	 *
	 * @returns true if the node had a parent and was detached; false if it was already a root.
	 */
	detach(): boolean {
		if (this.parent === null) {
			return false;
		}
		return this.parent.removeChild(this);
	}

	/**
	 * Both ends of the link are kept in sync by {@link InlineNode}; nobody else calls this.
	 * @internal
	 */
	_setParent(parent: InlineNode | null): void {
		this.parent = parent;
	}

	// ----------------------------------------------------------------
	// Content
	// ----------------------------------------------------------------

	/** @returns true if the node is a text block (BLOCK, `>>`); false if it is INLINE. */
	abstract isTextNode(): boolean;

	/** @returns the textual content of the node: the text lines joined with '\n' if it is BLOCK, or the inline value otherwise. */
	abstract getText(): string;

	/** @returns a readable representation of the node, for debugging and error messages. */
	toString(): string {
		let s = `${this.constructor.name}{`;
		if (this.line !== Node.NO_LINE) {
			s += `line=${this.line}, `;
		}
		s += `name='${this.name}'`;
		const namespace = this.getNamespace();
		if (namespace.length > 0) {
			s += `, ns='${namespace}'`;
		}
		s += this.describe();
		s += "}";
		return s;
	}

	/** Form-specific part of {@link Node.toString}. */
	protected abstract describe(): string;
}
