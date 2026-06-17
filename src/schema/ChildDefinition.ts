import { NamespaceValidator } from "../core/NamespaceValidator";
import { ValidationException } from "../exceptions/ValidationException";
import { StringUtils } from "../core/StringUtils";

export class ChildDefinition {
	private readonly normalizedName: string;
	private readonly name: string;
	private readonly namespace: string;
	private readonly min: number | null;
	private readonly max: number | null;

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

	getName(): string {
		return this.name;
	}

	getNormalizedName(): string {
		return this.normalizedName;
	}

	getNamespace(): string {
		return this.namespace;
	}

	getMin(): number | null {
		return this.min;
	}

	getMax(): number | null {
		return this.max;
	}

	getQualifiedName(): string {
		return this.namespace.length === 0
			? this.normalizedName
			: `${this.namespace}:${this.normalizedName}`;
	}

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
