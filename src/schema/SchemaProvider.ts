import { Schema } from "./Schema";

/** Resolves the {@link Schema} that applies to a namespace. Composable implementations (memory, meta-schema...). */
export interface SchemaProvider {
	/**
	 * Resolves the schema that applies to a namespace.
	 *
	 * @param namespace namespace whose schema is wanted.
	 * @returns the schema of the namespace, or null/undefined if there is none for that namespace.
	 */
	getSchema(namespace: string): Schema | null | undefined;
}
