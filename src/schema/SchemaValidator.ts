import { Node } from "../core/Node";
import { InlineNode } from "../core/InlineNode";
import { ValidationException } from "../exceptions/ValidationException";
import { Validator } from "../processors/Validator";

import { SchemaProvider } from "./SchemaProvider";
import { Schema } from "./Schema";
import { NodeDefinition } from "./NodeDefinition";
import { ChildDefinition } from "./ChildDefinition";

import { TypeRegistry } from "./TypeRegistry";
import { Type } from "./Type";

/** {@link Validator} that, for each node, resolves its {@link Schema} through a {@link SchemaProvider} and validates type and cardinality. */
export class SchemaValidator implements Validator {
    private readonly schemaProvider: SchemaProvider;
    private readonly recursiveValidation: boolean;

    /**
     * Creates a validator that resolves schemas through the given provider.
     *
     * @param schemaProvider where to resolve the schema of each namespace from.
     * @param recursive whether the children of each node are validated recursively too.
     */
    constructor(schemaProvider: SchemaProvider, recursive = false) {
        this.schemaProvider = schemaProvider;
        this.recursiveValidation = recursive;
    }

    /**
     * Validates a node against the schema of its namespace.
     *
     * @param node already closed node to validate.
     * @returns the validation errors found, or an empty array if the node is valid.
     */
    validate(node: Node): ValidationException[] {
        const errors: ValidationException[] = [];

        // Get the namespace
        const namespace = node.getNamespace();
        // The empty namespace is never validated (STXT-SCHEMA-SPEC 5): a node that neither
        // declares nor inherits a namespace is valid by definition, no schema is looked up for
        // it and SCHEMA_NOT_FOUND is never reported for it. Its children are still walked when
        // recursive, because one of them may declare a namespace of its own.
        if (namespace === "") {
            if (this.recursiveValidation && node instanceof InlineNode) {
                for (const childNode of node.getChildren()) {
                    errors.push(...this.validate(childNode));
                }
            }
            return errors;
        }

        const schema = this.schemaProvider.getSchema(namespace);

        if (!schema) {
            errors.push(new ValidationException(node.getLine(),"SCHEMA_NOT_FOUND",`Not found schema: ${namespace}`));
            return errors;
        }

        // Validate the node
        errors.push(...this.validateAgainstSchema(node, schema));

        // Validate the children (only an inline node has any)
        if (this.recursiveValidation && node instanceof InlineNode) {
            for (const childNode of node.getChildren()){
                errors.push(...this.validate(childNode));
            }
        }

        return errors;
    }

    /**
     * Validates a node against an already resolved schema: existence, value type and cardinalities of its children.
     *
     * @param node node to validate.
     * @param schema schema to validate against.
     * @returns the validation errors found, empty if the node is valid.
     */
    validateAgainstSchema(node: Node, schema: Schema): ValidationException[] {
        const errors: ValidationException[] = [];
        const schemaNode = schema.getNodeDefinition(node.getCanonicalName());

        if (!schemaNode) {
            const error = `NOT EXIST NODE ${node.getCanonicalName()} for namespace ${schema.getNamespace()}`;
            errors.push(new ValidationException(node.getLine(), "NODE_NOT_DEFINED_IN_SCHEMA", error));
            return errors;
        }

        errors.push(...SchemaValidator.validateValue(schemaNode, node));
        errors.push(...SchemaValidator.validateChildrenDeclared(schemaNode, node));
        errors.push(...SchemaValidator.validateCount(schemaNode, node));

        return errors;
    }

    // The children of a node for the purposes of the content model: a text node has none
    private static childrenOf(node: Node): ReadonlyArray<Node> {
        return node instanceof InlineNode ? node.getChildren() : [];
    }

    // Closed content model (STXT-SCHEMA-SPEC, section 6): only the direct children declared
    // in the definition of the parent are allowed; with no Children, nothing is
    private static validateChildrenDeclared(nodeDef: NodeDefinition, node: Node): ValidationException[] {
        const errors: ValidationException[] = [];

        for (const child of SchemaValidator.childrenOf(node)) {
            if (!nodeDef.getChildren().has(child.getQualifiedName())) {
                errors.push(new ValidationException(child.getLine(), "CHILD_NOT_DECLARED", `Child '${child.getQualifiedName()}' not declared in node '${node.getQualifiedName()}'`));
            }
        }

        return errors;
    }

    private static validateValue(nodeDef: NodeDefinition, node: Node): ValidationException[] {
        const errors: ValidationException[] = [];
        const nodeType = nodeDef.getType();

        const validator: Type | undefined = TypeRegistry.get(nodeType);
        if (!validator) {
            errors.push(new ValidationException(node.getLine(),"TYPE_NOT_VALID",`Node type not supported: ${nodeType}`));
            return errors;
        }

        try {
            validator.validate(nodeDef, node);
        } catch (e: unknown) {
            if (e instanceof ValidationException) {
                errors.push(e);
            } else if (e instanceof Error) {
                errors.push(new ValidationException(node.getLine(),"UNEXPECTED_ERROR", e.message));
            } else {
                errors.push(new ValidationException(node.getLine(),"UNEXPECTED_ERROR", String(e)));
            }
        }

        return errors;
    }

    private static validateCount(nodeDef: NodeDefinition, node: Node): ValidationException[] {
        const errors: ValidationException[] = [];
        const count = new Map<string, number>();
        const childrenByType = new Map<string, Node[]>();

        for (const child of SchemaValidator.childrenOf(node)) {
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
            errors.push(new ValidationException(node.getLine(),"TOO_FEW_CHILDREN",`${childCount} nodes of '${childDef.getQualifiedName()}' and min is ${min}`));
        }

        if (max !== null && childCount > max) {
            // Error on the parent
            errors.push(new ValidationException(node.getLine(),"TOO_MANY_CHILDREN",`${childCount} nodes of '${childDef.getQualifiedName()}' and max is ${max}`));

            // Error on each child node beyond the allowed maximum
            for (const child of children) {
                errors.push(new ValidationException(
                    child.getLine(),
                    "TOO_MANY_CHILDREN",
                    `Too many '${childDef.getQualifiedName()}' nodes: found ${childCount}, max is ${max}`
                ));
            }
        }

        return errors;
    }
}
