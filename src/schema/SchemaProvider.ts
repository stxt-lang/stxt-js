import { Schema } from "./Schema";

export interface SchemaProvider {
    getSchema(namespace: string): Schema | null | undefined;
}
