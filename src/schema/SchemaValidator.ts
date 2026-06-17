import { Node } from "../core/Node";
import { ValidationException } from "../exceptions/ValidationException";
import { Validator } from "../processors/Validator";

import { SchemaProvider } from "./SchemaProvider";
import { Schema } from "./Schema";
import { NodeDefinition } from "./NodeDefinition";
import { ChildDefinition } from "./ChildDefinition";

import { TypeRegistry } from "./TypeRegistry";
import { Type } from "./Type";

export class SchemaValidator implements Validator {
    private readonly schemaProvider: SchemaProvider;
    private readonly recursiveValidation: boolean;

    constructor(schemaProvider: SchemaProvider, recursive = false) {
        this.schemaProvider = schemaProvider;
        this.recursiveValidation = recursive;
    }

    validate(node: Node): ValidationException[] {
        const errors: ValidationException[] = [];

        // Obtenemos namespace
        const namespace = node.getNamespace();
        const schema = this.schemaProvider.getSchema(namespace);

        if (!schema) {
            errors.push(new ValidationException(node.getLine(),"SCHEMA_NOT_FOUND",`Not found schema: ${namespace}`));
            return errors;
        }

        // Validamos nodo
        errors.push(...this.validateAgainstSchema(node, schema));

        // Validamos children
        if (this.recursiveValidation) {
            for (const childNode of node.getChildren()){
                errors.push(...this.validate(childNode));
            }
        }

        return errors;
    }

    validateAgainstSchema(node: Node, schema: Schema): ValidationException[] {
        const errors: ValidationException[] = [];
        const schemaNode = schema.getNodeDefinition(node.getNormalizedName());

        if (!schemaNode) {
            const error = `NOT EXIST NODE ${node.getNormalizedName()} for namespace ${schema.getNamespace()}`;
            errors.push(new ValidationException(node.getLine(), "NODE_NOT_EXIST_IN_SCHEMA", error));
            return errors;
        }

        errors.push(...SchemaValidator.validateValue(schemaNode, node));
        errors.push(...SchemaValidator.validateCount(schemaNode, node));

        return errors;
    }

    private static validateValue(nodeDef: NodeDefinition, node: Node): ValidationException[] {
        const errors: ValidationException[] = [];
        const nodeType = nodeDef.getType();

        const validator: Type | undefined = TypeRegistry.get(nodeType);
        if (!validator) {
            errors.push(new ValidationException(node.getLine(),"TYPE_NOT_SUPPORTED",`Node type not supported: ${nodeType}`));
            return errors;
        }

        try {
            validator.validate(nodeDef, node);
        } catch (e: unknown) {
            if (e instanceof ValidationException) {
                errors.push(e);
            } else if (e instanceof Error) {
                errors.push(new ValidationException(node.getLine(),"VALIDATION_ERROR", e.message));
            } else {
                errors.push(new ValidationException(node.getLine(),"UNKNOWN_VALIDATION_ERROR", String(e)));
            }
        }

        return errors;
    }

    private static validateCount(nodeDef: NodeDefinition, node: Node): ValidationException[] {
        const errors: ValidationException[] = [];
        const count = new Map<string, number>();
        const childrenByType = new Map<string, Node[]>();

        for (const child of node.getChildren()) {
            const childName = child.getQualifiedName();
            count.set(childName, (count.get(childName) ?? 0) + 1);
            
            if (!childrenByType.has(childName)) {
                childrenByType.set(childName, []);
            }
            childrenByType.get(childName)!.push(child);
        }

        for (const childDef of nodeDef.getChildren().values()) {
            const qname = childDef.getQualifiedName();
            errors.push(...SchemaValidator.validateCountChild(
                childDef, 
                count.get(qname) ?? 0, 
                node,
                childrenByType.get(qname) ?? []
            ));
        }

        return errors;
    }

    private static validateCountChild(childDef: ChildDefinition, childCount: number, node: Node, children: Node[]): ValidationException[] {
        const errors: ValidationException[] = [];
        const min = childDef.getMin(); // number | null
        const max = childDef.getMax(); // number | null

        if (min !== null && childCount < min) {
            errors.push(new ValidationException(node.getLine(),"INVALID_NUMBER",`${childCount} nodes of '${childDef.getQualifiedName()}' and min is ${min}`));
        }

        if (max !== null && childCount > max) {
            // Error en el parent
            errors.push(new ValidationException(node.getLine(),"INVALID_NUMBER",`${childCount} nodes of '${childDef.getQualifiedName()}' and max is ${max}`));
            
            // Error en cada nodo hijo que excede el máximo permitido
            for (const child of children) {
                errors.push(new ValidationException(
                    child.getLine(),
                    "INVALID_NUMBER",
                    `Too many '${childDef.getQualifiedName()}' nodes: found ${childCount}, max is ${max}`
                ));
            }
        }

        return errors;
    }
}
