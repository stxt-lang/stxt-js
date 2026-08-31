/**
 * A resolution error (STXT-DISCOVERY-SPEC section 8).
 *
 * Resolution errors are collected, not thrown: the spec mandates reporting them while
 * allowing the tool to keep loading the remaining definitions, so a resolve pass returns
 * every error it found instead of aborting at the first one.
 */
export class DiscoveryError {
	/** Two definitions for the same target namespace at the same level (spec 8.1). */
	static readonly DUPLICATE_NAMESPACE = "DISCOVERY_DUPLICATE_NAMESPACE";

	/** A file under a resolution directory that does not parse as STXT (spec 8.2). */
	static readonly NOT_PARSEABLE = "DISCOVERY_NOT_PARSEABLE";

	/** A file whose root node belongs neither to @stxt.schema nor to @stxt.template (spec 8.3). */
	static readonly NOT_A_DEFINITION = "DISCOVERY_NOT_A_DEFINITION";

	/** A definition that does not validate against its meta-schema (spec 8.4). */
	static readonly INVALID_DEFINITION = "DISCOVERY_INVALID_DEFINITION";

	/**
	 * Creates a resolution error.
	 *
	 * @param code one of the `DISCOVERY_*` constants of this class.
	 * @param file full path of the offending file.
	 * @param message human-readable description of the error.
	 * @param namespace target namespace involved, when the error is about a namespace.
	 */
	constructor(
		readonly code: string,
		readonly file: string,
		readonly message: string,
		readonly namespace?: string
	) {}
}
