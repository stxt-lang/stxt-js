/** Result of splitting a raw node name into its resolved name and namespace. */
export class NameNamespace {
	private readonly name: string;
	private readonly namespace: string;

	/**
   * Creates a resolved name and namespace pair.
   *
   * @param name name of the node without the namespace part.
   * @param namespace resolved namespace (its own or inherited).
   */
	constructor(name: string, namespace: string) {
		this.name = name;
		this.namespace = namespace;
	}

	/** @returns the name of the node, without the namespace part. */
	getName(): string {
		return this.name;
	}

	/** @returns the resolved namespace (its own or inherited from the parent), or the empty string if it has none. */
	getNamespace(): string {
		return this.namespace;
	}
}
