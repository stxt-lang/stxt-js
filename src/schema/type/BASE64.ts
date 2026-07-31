import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { RuntimeException } from "../../exceptions/RuntimeException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

/** `BASE64` type: checks that the content is valid Base64. */
export const BASE64: Type = {
    getName(): string {
        return "BASE64";
    },

    validate(ndef: NodeDefinition, n: Node): void {
        const raw = binaryValue(n);

        try {
            // Try to decode it
            const buf = Buffer.from(raw, "base64");

            // Re-encode to check consistency
            // (this keeps partially valid strings out)
            const reencoded = buf.toString("base64");

            // Normalize the padding before comparing
            const normalizedInput = raw.replace(/=+$/, "");
            const normalizedReencoded = reencoded.replace(/=+$/, "");

            if (normalizedInput !== normalizedReencoded) {
                throw new ValidationException(n.getLine(), "INVALID_VALUE", `Node '${n.getName()}' Invalid Base64`);
            }
        } catch {
            throw new ValidationException(n.getLine(), "INVALID_VALUE", `Node '${n.getName()}' Invalid Base64`);
        }
    },
};
