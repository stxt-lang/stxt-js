import { NamespaceValidator } from "../core/NamespaceValidator";
import { StringUtils } from "../core/StringUtils";
import { ValidationException } from "../exceptions/ValidationException";
import { NodeDefinition } from "./NodeDefinition";

export class Schema {
    static readonly SCHEMA_NAMESPACE = "@stxt.schema";

    private readonly nodes: Map<string, NodeDefinition> = new Map();
    private readonly namespace: string;
    private readonly description: string | undefined;

    constructor(namespace: string | null | undefined, line: number, description: string | undefined) {
        this.namespace = StringUtils.lowerCase(namespace);
        this.description = description;
        NamespaceValidator.validateNamespaceFormat(this.namespace, line);
    }

    getNodes(): ReadonlyMap<string, NodeDefinition> {
        return this.nodes;
    }

    getNodeDefinition(name: string): NodeDefinition | undefined {
        return this.nodes.get(StringUtils.normalize(name));
    }

    addNodeDefinition(nodeDefinition: NodeDefinition): void {
        const qname = nodeDefinition.getNormalizedName();

        if (this.nodes.has(qname)) {
            throw new ValidationException(0, "NODE_DEF_ALREADY_DEFINED", `Exists a previous node definition with: ${qname}`);
        }

        this.nodes.set(qname, nodeDefinition);
    }

    getNamespace(): string {
        return this.namespace;
    }

    // Dentro de la clase Schema

    toJSON() {
        return {
            namespace: this.namespace,
            nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
        };
    }

    toString(): string {
        return JSON.stringify(this, null, 2); // pretty print
    }

}
