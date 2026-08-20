import { Node } from "../core/Node";
import { Validator } from "../processors/Validator";
import { SchemaValidator } from "../schema/SchemaValidator";
import { ValidationException } from "../exceptions/ValidationException";

/**
 * Wrapper around a {@link SchemaValidator} that only validates namespaced nodes, so that a
 * document mixing schema-bound and free nodes does not report the free ones as unknown.
 *
 * @deprecated since 0.8.0: {@link SchemaValidator} applies this rule itself (STXT-SCHEMA-SPEC 5,
 * the empty namespace is never validated), so the wrapper adds nothing. Register the
 * `SchemaValidator` directly. Kept for compatibility; to be removed in 1.0.
 */
export class ConditionalValidator implements Validator {
    private readonly schemaValidator: SchemaValidator;

    /**
     * Creates a validator that delegates to a schema validator.
     *
     * @param schemaValidator validator the namespaced nodes are handed over to.
     */
    constructor(schemaValidator: SchemaValidator) {
        this.schemaValidator = schemaValidator;
    }

    /**
     * Validates a node when it has a namespace, and lets it through otherwise.
     *
     * @param node already closed node to validate.
     * @returns the validation errors found, or an empty array if the node is valid or has no namespace.
     */
    validate(node: Node): ValidationException[] {
        // Only validate the node when it has a namespace
        if (node.getNamespace() !== "") {
            return this.schemaValidator.validate(node);
        }
        return [];
    }
}

