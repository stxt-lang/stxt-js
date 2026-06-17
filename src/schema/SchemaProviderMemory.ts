import { Node } from "../core/Node";
import { Parser } from "../core/Parser";
import { StringUtils } from "../core/StringUtils";
import { Schema } from "./Schema";
import { transformNodeToSchema } from "./SchemaParser";
import { SchemaProvider } from "./SchemaProvider";
import { SchemaProviderMeta } from "./SchemaProviderMeta";
import { SchemaValidator } from "./SchemaValidator";

export class SchemaProviderMemory implements SchemaProvider {
    private readonly parentSchema: SchemaProvider;

    constructor(parent?: SchemaProvider | null | undefined) {
        if (!parent) {
            this.parentSchema = new SchemaProviderMeta();
        } else {
            this.parentSchema = parent;
        }
    }

    protected readonly schemas: Map<string, Schema> = new Map();

    getSchema(namespace: string): Schema | undefined | null {
        const key = StringUtils.lowerCase(namespace);

        let result: Schema | undefined | null = this.schemas.get(key);
        if (!result) {
            result = this.parentSchema.getSchema(namespace);
        }
        return result;
    }

    addSchema(txt: string): void {
        const parser: Parser = new Parser();
        const node: Node = parser.parse(txt)[0];
        const schema: Schema = transformNodeToSchema(node);

        const schemaValidator = new SchemaValidator(new SchemaProviderMeta(), true);
        schemaValidator.validate(node);

        const key = schema.getNamespace();
        this.schemas.set(key, schema);
    }

    clear(): void {
        this.schemas.clear();
    }

    getAllSchemas(): ReadonlyArray<Schema> {
        return Array.from(this.schemas.values());
    }
}
