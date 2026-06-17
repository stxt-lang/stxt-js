import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { RuntimeException } from "../../exceptions/RuntimeException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { StringUtils } from "../../core/StringUtils";

export const BASE64: Type = {
    getName(): string {
        return "BASE64";
    },

    validate(ndef: NodeDefinition, n: Node): void {
        const raw = StringUtils.cleanSpaces(n.getText());

        try {
            // Intentamos decodificar
            const buf = Buffer.from(raw, "base64");

            // Re-encode para verificar consistencia
            // (evita aceptar cadenas parcialmente válidas)
            const reencoded = buf.toString("base64");

            // Normalizamos padding para comparar
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
