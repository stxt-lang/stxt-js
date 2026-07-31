import { Schema } from "./Schema";
import { NodeDefinition } from "./NodeDefinition";
import { ChildDefinition } from "./ChildDefinition";
import { Node } from "../core/Node";
import { ValidationException } from "../exceptions/ValidationException";
import { RuntimeException } from "../exceptions/RuntimeException";
import { NameNamespaceParser } from "../core/NameNamespaceParser";
import { TypeRegistry } from "./TypeRegistry";

/**
 * Turns the tree of an already parsed `@stxt.schema` document into a {@link Schema}.
 *
 * @param node root node of the schema document, `Schema (@stxt.schema): ...`.
 * @returns the schema the document defines.
 * @throws ValidationException if the document is not a valid `@stxt.schema` one.
 */
export function transformNodeToSchema(node: Node): Schema {
    // Node name
    const nodeName = node.getNormalizedName();
    const namespaceSchema = node.getNamespace();

    // Get the name and the namespace
    if (nodeName !== "schema" || namespaceSchema !== Schema.SCHEMA_NAMESPACE) {
        throw new ValidationException(node.getLine(), "NOT_STXT_SCHEMA", `Expected schema(${Schema.SCHEMA_NAMESPACE}) but got ${nodeName}(${namespaceSchema})`);
    }

    // Get the description
    const descrip = node.getChild("description")?.getText();

    const schema = new Schema(node.getValue(), node.getLine(), descrip);

    // Used to check that every child is defined
    const allNames = new Set<string>();

    // Get the nodes
    for (const n of node.getChildrenByName("node")) {
        const schNode = createFrom(n, schema.getNamespace());
        schema.addNodeDefinition(schNode);
        allNames.add(schNode.getNormalizedName());
    }

    // Check that every name is defined
    for (const schNode of schema.getNodes().values()) {
        for (const schChild of schNode.getChildren().values()) {
            // Only names of the same namespace are checked
            if (schChild.getNamespace() === schema.getNamespace()) {
                // Defensive leftover from the Java port: ChildDefinition does expose
                // getNormalizedName(), so this check can never fail with the current class.
                const childNorm = (schChild as any).getNormalizedName?.() as string | undefined;

                if (!childNorm) {
                    throw new RuntimeException(
                        "CHILD_DEFINITION_API_MISMATCH",
                        "ChildDefinition.getNormalizedName() is missing in TypeScript version. Add it to ChildDefinition."
                    );
                }

                if (!allNames.has(childNorm)) {
                    throw new ValidationException(0, "CHILD_NOT_DEFINED", `Child ${childNorm} not defined in ${schema.getNamespace()}`);
                }
            }
        }
    }

    return schema;
}

/** Builds the definition of a node from a `Node:` entry of the schema document. */
function createFrom(n: Node, namespace: string): NodeDefinition {
    const name = n.getValue();

    let type = "INLINE";
    const typeNode = n.getChild("type");
    if (typeNode) {
        type = typeNode.getValue();
    }
    const description = n.getChild("description")?.getText();

    const result = new NodeDefinition(name, type, n.getLine(), description);

    const children = n.getChild("children");
    if (children) {
        // Schema error 13.5: Children in a Node whose type does not admit children
        if (!TypeRegistry.admitsChildren(type)) {
            throw new ValidationException(children.getLine(), "CHILDREN_NOT_ALLOWED_FOR_TYPE", `Type ${type} does not allow children (node ${name})`);
        }
        for (const child of children.getChildrenByName("child")) {
            putChildToSchemaNode(result, child, namespace);
        }
    }

    // Look at the values
    let valuesNodes = n.getChildrenByName("values");
    if (valuesNodes && valuesNodes.length > 0) {
        if (type !== "ENUM") {
            throw new ValidationException(n.getLine(), "VALUES_ONLY_SUPPORTED_BY_ENUM", `Values only supported for type ENUM, not for type ${type}`);
        }

        if (valuesNodes.length > 1) {
            throw new RuntimeException("INVALID_SIZE_VALUES", `Unexpected number of values: ${valuesNodes.length}`);
        }

        const valuesNode = valuesNodes[0];
        const values = valuesNode.getChildrenByName("value");
        for (const v of values) {
            result.addValue(v.getValue(), v.getLine());
        }

        // For the final ENUM check
        valuesNodes = values;
    }

    // Look at the enum
    if (type === "ENUM" && (!valuesNodes || valuesNodes.length === 0)) {
        throw new ValidationException(n.getLine(), "VALUES_EMPTY_FOR_ENUM", "ENUM Type must include values");
    }

    return result;
}

/** Adds to a node definition the expected child a `Child:` entry declares. */
function putChildToSchemaNode(schemaNode: NodeDefinition, child: Node, defNamespace: string): void {
    // Get the name and the namespace
    const ns = NameNamespaceParser.parse(child.getValue(), defNamespace, child.getLine(), child.getValue());
    const name = ns.getName();
    const namespace = ns.getNamespace();

    const min = getInteger(child, "min");
    const max = getInteger(child, "max");

    // Invalid cardinality when Min > Max (STXT-SCHEMA-SPEC 10 and 13.7)
    if (min !== null && max !== null && min > max) {
        throw new ValidationException(child.getLine(), "MIN_GREATER_THAN_MAX", `Min ${min} greater than Max ${max}`);
    }

    const schemaChild = new ChildDefinition(name, namespace, min, max, child.getLine());
    schemaNode.addChildDefinition(schemaChild);
}

/** Reads an integer child (`Min`, `Max`) of a node, or null when it is not there. */
function getInteger(node: Node, name: string): number | null {
    const n = node.getChild(name);
    if (!n) {
        return null;
    }

    const raw = n.getValue();
    const parsed = Number.parseInt(raw, 10);

    if (Number.isNaN(parsed)) {
        throw new ValidationException(node.getLine(), "INVALID_INTEGER", `Integer not valid: ${raw}`);
    }

    return parsed;
}
