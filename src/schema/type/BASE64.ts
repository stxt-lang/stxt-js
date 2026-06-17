import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { RuntimeException } from "../../exceptions/RuntimeException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { StringUtils } from "../../core/StringUtils";

// Decodifica/codifica base64 de forma isomorfa: usa Buffer en Node y
// atob/btoa en el navegador (ambos operan sobre "binary strings").
function base64Decode(raw: string): string {
    const Buffer = (globalThis as any).Buffer;
    if (typeof Buffer !== "undefined") {
        return Buffer.from(raw, "base64").toString("binary");
    }
    return atob(raw);
}

function base64Encode(binary: string): string {
    const Buffer = (globalThis as any).Buffer;
    if (typeof Buffer !== "undefined") {
        return Buffer.from(binary, "binary").toString("base64");
    }
    return btoa(binary);
}

export const BASE64: Type = {
    getName(): string {
        return "BASE64";
    },

    validate(ndef: NodeDefinition, n: Node): void {
        const raw = StringUtils.cleanSpaces(n.getText());

        try {
            // Intentamos decodificar (Buffer en Node, atob en navegador)
            const decoded = base64Decode(raw);

            // Re-encode para verificar consistencia
            // (evita aceptar cadenas parcialmente válidas)
            const reencoded = base64Encode(decoded);

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
