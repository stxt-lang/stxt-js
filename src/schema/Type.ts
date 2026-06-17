import { Node } from "../core/Node";
import { NodeDefinition } from "./NodeDefinition";

export interface Type {
    validate(nodeDef: NodeDefinition, node: Node): void;
    getName(): string;
}
