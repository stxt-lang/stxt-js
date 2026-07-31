import { NamespaceValidator } from "../core/NamespaceValidator";
import { ValidationException } from "../exceptions/ValidationException";
import { StringUtils } from "../core/StringUtils";

/** Definition of an expected child inside a {@link NodeDefinition}: name, namespace and min/max cardinality. */
export class ChildDefinition {
	private readonly normalizedName: string;
	private readonly name: string;
	private readonly namespace: string;
	private readonly min: number | null;
	private readonly max: number | null;

	/**
	 * Creates the definition of an expected child.
	 *
	 * @param name name of the expected child.
	 * @param namespace namespace of the expected child (may be null/undefined).
	 * @param min minimum cardinality, or null if there is no minimum.
	 * @param max maximum cardinality, or null if there is no maximum.
	 * @param numLine line number, for the error messages.
	 * @throws ValidationException with code `INVALID_NODE_NAME` if the name is not valid.
	 */
	constructor(name: string, namespace: string | null | undefined,	min: number | null,	max: number | null,	numLine: number) {
		this.name = StringUtils.compactSpaces(name);
		this.normalizedName = StringUtils.normalize(name);
		this.namespace = StringUtils.lowerCase(namespace);
		this.min = min;
		this.max = max;

		NamespaceValidator.validateNamespaceFormat(this.namespace, numLine);

		if (this.normalizedName.length === 0) {
			throw new ValidationException(numLine, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
		}
	}

	/** @returns the name of the expected child, as it appears in the schema. */
	getName(): string {
		return this.name;
	}

	/** @returns the canonical name of the expected child. */
	getNormalizedName(): string {
		return this.normalizedName;
	}

	/** @returns the namespace of the expected child, or the empty string if it has none. */
	getNamespace(): string {
		return this.namespace;
	}

	/** @returns the minimum cardinality, or null if there is no minimum. */
	getMin(): number | null {
		return this.min;
	}

	/** @returns the maximum cardinality, or null if there is no maximum. */
	getMax(): number | null {
		return this.max;
	}

	/** @returns the canonical name prefixed by its namespace, used as the key in {@link NodeDefinition.getChildren}. */
	getQualifiedName(): string {
		return this.namespace.length === 0
			? this.normalizedName
			: `${this.namespace}:${this.normalizedName}`;
	}

	/** @returns a plain object with the definition, so that JSON.stringify serializes it. */
	toJSON() {
		return {
			name: this.getName(),
			normalizedName: this.getNormalizedName(),
			namespace: this.getNamespace(),
			min: this.getMin(),
			max: this.getMax(),
		};
	}

}
