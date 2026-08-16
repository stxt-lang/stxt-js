import { Node } from "./Node";
import { TextNode } from "./TextNode";
import { RuntimeException } from "../exceptions/RuntimeException";
import { StringUtils } from "./StringUtils";

/**
 * INLINE node of the STXT tree (`Name: value`): an optional inline value and an ordered list of
 * children. It is the only form that has children — and so the only one with child lookups
 * ({@link InlineNode.getChild}, {@link InlineNode.getChildrenByName}) — and the only one that can
 * create them ({@link InlineNode.addInlineNode}, {@link InlineNode.addTextNode}).
 *
 * Overloads with two strings always take the second one as the *content* (the value); the
 * namespace only exists in the three-argument forms.
 */
export class InlineNode extends Node {
	private value!: string;
	private readonly children: Node[] = [];

	/**
	 * Creates an inline node with no value, no declared namespace and no known source line.
	 *
	 * @param name name of the node.
	 */
	constructor(name: string);
	/**
	 * Creates an inline node with a value, no declared namespace and no known source line.
	 *
	 * @param name name of the node.
	 * @param value inline value, or null/undefined for none.
	 */
	constructor(name: string, value: string | null | undefined);
	/**
	 * Creates an inline node with a declared namespace and a value; the source line is optional.
	 * This is the form the {@link Parser} uses.
	 *
	 * @param name name of the node.
	 * @param namespace namespace the node declares, or null/undefined/empty for none.
	 * @param value inline value, or null/undefined for none.
	 * @param line source line, or {@link Node.NO_LINE} (the default).
	 * @throws ParseException if the name or the namespace are not valid.
	 */
	constructor(name: string, namespace: string | null | undefined, value: string | null | undefined, line?: number);
	constructor(name: string, ...rest: (string | number | null | undefined)[]) {
		// With two strings the second one is the value; the namespace only exists with three or more
		const [namespace, value, line] = rest.length <= 1
			? [null, rest[0] as string | null | undefined, Node.NO_LINE]
			: [rest[0] as string | null | undefined, rest[1] as string | null | undefined, (rest[2] as number | undefined) ?? Node.NO_LINE];
		super(name, namespace, line);
		this.setValue(value);
	}

	// ----------------------------------------------------------------
	// Value
	// ----------------------------------------------------------------

	/** @returns the inline value of the node, trimmed; the empty string if it has none. */
	getValue(): string {
		return this.value;
	}

	/**
	 * Sets the inline value of the node.
	 *
	 * @param value new value, or null/undefined for none. It is trimmed.
	 */
	setValue(value: string | null | undefined): void {
		this.value = (value ?? "").trim();
	}

	getText(): string {
		return this.value;
	}

	isTextNode(): boolean {
		return false;
	}

	// ----------------------------------------------------------------
	// Children
	// ----------------------------------------------------------------

	/** @returns the children of the node in order of appearance, as a read-only view. */
	getChildren(): ReadonlyArray<Node> {
		return this.children;
	}

	/**
	 * Adds a child, linking both ends: afterwards `child.getParent()` is this node. It is appended
	 * at the end unless a position is given.
	 *
	 * @param child node to add; it must not have a parent yet.
	 * @param index position where to insert it (0 = first); at the end when omitted.
	 * @throws RuntimeException with code `NODE_ALREADY_ATTACHED` if the child already has a parent
	 *         (detach it first), or `NODE_CYCLE` if it is this node or one of its ancestors.
	 * @throws RangeError if the index is out of range.
	 */
	addChild(child: Node, index?: number): void {
		if (child.getParent() !== null) {
			throw new RuntimeException("NODE_ALREADY_ATTACHED", `Node '${child.getName()}' already has a parent: detach it first`);
		}
		for (let p: Node | null = this; p !== null; p = p.getParent()) {
			if (p === child) {
				throw new RuntimeException("NODE_CYCLE", `Node '${child.getName()}' cannot be a child of itself or of one of its descendants`);
			}
		}

		const at = index ?? this.children.length;
		if (!Number.isInteger(at) || at < 0 || at > this.children.length) {
			throw new RangeError(`Index ${index} out of range [0, ${this.children.length}]`);
		}

		this.children.splice(at, 0, child);
		child._setParent(this);
	}

	/**
	 * Removes a direct child, unlinking both ends: afterwards `child.getParent()` is null and the
	 * child is a root on its own.
	 *
	 * @param child the child to remove.
	 * @returns true if it was a direct child of this node and has been removed; false otherwise.
	 */
	removeChild(child: Node): boolean {
		if (child.getParent() !== this) {
			return false;
		}
		// Identity, not equality: two children may look alike
		const i = this.children.indexOf(child);
		if (i === -1) {
			return false;
		}
		this.children.splice(i, 1);
		child._setParent(null);
		return true;
	}

	/**
	 * Looks up the only direct child with that name.
	 *
	 * @param cname name of the child to look for.
	 * @param namespace effective namespace to search in; this node's own effective namespace when omitted.
	 * @returns the only direct child with that name, or null if there is none.
	 * @throws RuntimeException with code `AMBIGUOUS_CHILD` if there is more than one; use {@link InlineNode.getChildrenByName} then.
	 */
	getChild(cname: string, namespace?: string): Node | null {
		const result = this.getChildrenByName(cname, namespace);
		if (result.length > 1) {
			throw new RuntimeException("AMBIGUOUS_CHILD", "More than 1 child. Use getChildrenByName");
		}
		return result.length === 0 ? null : result[0];
	}

	/**
	 * Looks up every direct child with that name.
	 *
	 * @param cname name of the child to look for.
	 * @param namespace effective namespace to search in; this node's own effective namespace when omitted.
	 * @returns every direct child with that name in that namespace, in order of appearance.
	 */
	getChildrenByName(cname: string, namespace?: string): Node[] {
		const key = StringUtils.normalize(cname);
		const targetNamespace = namespace !== undefined ? namespace : this.getNamespace();
		return this.children.filter(child => child.getCanonicalName() === key && child.getNamespace() === targetNamespace);
	}

	// ----------------------------------------------------------------
	// Factories: create a child and append it
	// ----------------------------------------------------------------

	/**
	 * Creates an inline child and appends it. With two strings the second one is the value; the
	 * namespace only exists in the three-argument form.
	 *
	 * @param name name of the child.
	 * @returns the child created, already attached to this node.
	 */
	addInlineNode(name: string): InlineNode;
	/**
	 * @param name name of the child.
	 * @param value inline value, or null/undefined for none.
	 */
	addInlineNode(name: string, value: string | null | undefined): InlineNode;
	/**
	 * @param name name of the child.
	 * @param namespace namespace the child declares, or null/undefined/empty to inherit this node's.
	 * @param value inline value, or null/undefined for none.
	 */
	addInlineNode(name: string, namespace: string | null | undefined, value: string | null | undefined): InlineNode;
	addInlineNode(name: string, ...rest: (string | null | undefined)[]): InlineNode {
		const child = rest.length <= 1
			? new InlineNode(name, rest[0])
			: new InlineNode(name, rest[0], rest[1]);
		this.addChild(child);
		return child;
	}

	/**
	 * Creates a text child and appends it. With two strings the second one is the text; the
	 * namespace only exists in the three-argument form.
	 *
	 * @param name name of the child.
	 * @returns the child created, already attached to this node.
	 */
	addTextNode(name: string): TextNode;
	/**
	 * @param name name of the child.
	 * @param text text of the child (split into lines at every line break), or its lines.
	 */
	addTextNode(name: string, text: string | ReadonlyArray<string> | null | undefined): TextNode;
	/**
	 * @param name name of the child.
	 * @param namespace namespace the child declares, or null/undefined/empty to inherit this node's.
	 * @param text text of the child (split into lines at every line break), or its lines.
	 */
	addTextNode(name: string, namespace: string | null | undefined, text: string | ReadonlyArray<string> | null | undefined): TextNode;
	addTextNode(name: string, ...rest: (string | ReadonlyArray<string> | null | undefined)[]): TextNode {
		const child = rest.length <= 1
			? new TextNode(name, rest[0])
			: new TextNode(name, rest[0] as string | null | undefined, rest[1]);
		this.addChild(child);
		return child;
	}

	protected describe(): string {
		let s = "";
		if (this.value.length > 0) {
			s += `, value='${this.value}'`;
		}
		s += `, children=${this.children.length}`;
		return s;
	}
}
