import { ValidationException } from "../exceptions/ValidationException";
import { StringUtils } from "../core/StringUtils";
import { ChildDefinition } from "./ChildDefinition";

/**
 * Definition of a node inside a {@link Schema}: its name, its value type, the children it expects
 * ({@link ChildDefinition}) and, for ENUM, the values it allows.
 */
export class NodeDefinition {
	private readonly name: string;
	private readonly canonicalName: string;
	private readonly type: string;
	private description: string | undefined;

	private readonly children: Map<string, ChildDefinition> = new Map();
	private readonly values: Set<string> = new Set();

	/**
	 * Creates the definition of a node.
	 *
	 * @param name name of the node.
	 * @param type name of the type (see {@link TypeRegistry}).
	 * @param line line number, for the error message.
	 * @param description optional description of the node.
	 * @throws ValidationException with code `INVALID_NODE_NAME` if the name is not valid.
	 */
	constructor(name: string, type: string, line: number, description: string | undefined) {
		this.name = StringUtils.compactSpaces(name);
		this.canonicalName = StringUtils.normalize(name);
		this.type = type;
		this.description = description;

		if (!StringUtils.isValidNodeName(this.name)) {
			throw new ValidationException(line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
		}
	}

	/** @returns the name of the node, as it appears in the schema. */
	getName(): string {
		return this.name;
	}

	/** @returns the canonical name of the node. */
	getCanonicalName(): string {
		return this.canonicalName;
	}

	/** @returns the name of the value type of this node (see {@link TypeRegistry}). */
	getType(): string {
		return this.type;
	}

	/** @returns the definitions of the expected children, indexed by their qualified canonical name. */
	getChildren(): ReadonlyMap<string, ChildDefinition> {
		return this.children;
	}

	/** @returns the optional description of the node, or undefined if it has none. */
	getDescription(): string | undefined {
		return this.description;
	}

	/**
	 * Sets the optional description of the node.
	 *
	 * @param description new optional description of the node.
	 */
	setDescription(description: string): void {
		this.description = description;
	}

	/**
	 * Adds the definition of an expected child.
	 *
	 * @param childDefinition definition of the child to add.
	 * @throws ValidationException with code `CHILD_DUPLICATED` if a definition for that child already existed.
	 */
	addChildDefinition(childDefinition: ChildDefinition): void {
		const qname = childDefinition.getQualifiedName();
		if (this.children.has(qname)) {
			throw new ValidationException(0, "CHILD_DUPLICATED", `Exists a previous node definition with: ${qname}`);
		}
		this.children.set(qname, childDefinition);
	}

	// STXT-SCHEMA-SPEC 13.9 / STXT-TEMPLATE-SPEC 14.14: there can be no duplicated values
	// after the trim normalization. Same code as ChildLineParser: it is the same condition
	// coming through the other entry point.
	/**
	 * Adds a value to the list of values allowed for this node.
	 *
	 * @param value value to add to the list of allowed values.
	 * @param line line number, for the error message.
	 * @throws ValidationException with code `VALUE_DUPLICATED` if the value (once trimmed) had already been added.
	 */
	addValue(value: string, line?: number): void {
		const trimmed = value?.trim() ?? "";

		if (this.values.has(trimmed)) {
			throw new ValidationException(
				line ?? 0,
				"VALUE_DUPLICATED",
				`The values ${trimmed} is duplicated`
			);
		}

		this.values.add(trimmed);
	}

	/**
	 * Tells whether a value is allowed for this node.
	 *
	 * @param value value to check.
	 * @returns true if no restricted values are defined, or if the value is among the allowed ones.
	 */
	isAllowedValue(value: string): boolean {
		if (this.values.size === 0) {
			return true;
		}
		return this.values.has(value);
	}

	/** @returns the values allowed for this node (ENUM), or empty if there is no restriction. */
	getValues(): ReadonlySet<string> {
		return this.values;
	}

	/** @returns a plain object with the definition, so that JSON.stringify serializes it. */
	toJSON() {
		return {
			name: this.getName(),
			canonicalName: this.getCanonicalName(),
			type: this.getType(),
			description: this.description,
			children: Array.from(this.getChildren().values()).map(c => c.toJSON()),
			values: Array.from(this.getValues()),
		};
	}

}
