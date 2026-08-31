import { NamespaceValidator } from "../core/NamespaceValidator";
import { StringUtils } from "../core/StringUtils";
import { ParseException } from "../exceptions/ParseException";
import { ValidationException } from "../exceptions/ValidationException";
import { NodeDefinition } from "./NodeDefinition";

/** Schema of a namespace: the set of {@link NodeDefinition} valid for the nodes of that namespace. */
export class Schema {
	/** Namespace of the schema language itself, `@stxt.schema`. */
	static readonly SCHEMA_NAMESPACE = "@stxt.schema";

	/** Namespace of the template language, `@stxt.template`. */
	static readonly TEMPLATE_NAMESPACE = "@stxt.template";

	private readonly nodes: Map<string, NodeDefinition> = new Map();
	private readonly namespace: string;
	private readonly description: string | undefined;

	/**
	 * Creates an empty schema for a namespace.
	 *
	 * @param namespace namespace this schema applies to.
	 * @param line line number, for the error message.
	 * @param description optional description of the schema.
	 * @throws ParseException if the namespace is not well formed.
	 */
	constructor(namespace: string | null | undefined, line: number, description: string | undefined) {
		this.namespace = StringUtils.lowerCase(namespace);
		this.description = description;
		NamespaceValidator.validateNamespaceFormat(this.namespace, line);
	}

	/** @returns the description of the schema (STXT-SCHEMA-SPEC §6.1), or undefined if it has none. */
	getDescription(): string | undefined {
		return this.description;
	}

	/** @returns the node definitions, indexed by their canonical name. */
	getNodes(): ReadonlyMap<string, NodeDefinition> {
		return this.nodes;
	}

	/**
	 * Looks up the definition of a node by name.
	 *
	 * @param name name of the node to look for.
	 * @returns the definition of the node with that name, or undefined if it is not defined in this schema.
	 */
	getNodeDefinition(name: string): NodeDefinition | undefined {
		return this.nodes.get(StringUtils.normalize(name));
	}

	/**
	 * Adds the definition of a node to this schema.
	 *
	 * @param nodeDefinition node definition to add.
	 * @throws ValidationException with code `NODE_DUPLICATED` if there already was a node definition with the same name.
	 */
	addNodeDefinition(nodeDefinition: NodeDefinition): void {
		const canonicalName = nodeDefinition.getCanonicalName();

		if (this.nodes.has(canonicalName)) {
			throw new ValidationException(ParseException.NO_LINE, "NODE_DUPLICATED", `A node definition with the same name already exists: ${canonicalName}`);
		}

		this.nodes.set(canonicalName, nodeDefinition);
	}

	/** @returns the namespace this schema applies to. */
	getNamespace(): string {
		return this.namespace;
	}

	/** @returns a plain object with the schema, so that JSON.stringify serializes it. */
	toJSON() {
		return {
			namespace: this.namespace,
			nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
		};
	}

	/** @returns the schema as pretty-printed JSON, for debugging. */
	toString(): string {
		return JSON.stringify(this, null, 2); // pretty print
	}

}
