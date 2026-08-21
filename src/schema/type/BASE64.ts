import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

/** Standard alphabet of RFC 4648 section 4, used to check the leftover bits of the last character. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Shape of a Base64 value (STXT-SCHEMA-SPEC 9.5): groups of four characters of the standard
 * alphabet, with an optional final group of two or three characters whose `=` padding may be
 * omitted. The empty string matches here and is rejected separately.
 */
const SHAPE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;

/**
 * STXT-SCHEMA-SPEC 9.5: standard Base64 (not URL-safe), padding optional, no leftover bits,
 * never empty. The check is a regular expression plus the leftover-bits rule, never the
 * platform decoder, which silently ignores characters outside the alphabet.
 *
 * @param value value already stripped of blanks.
 * @returns whether it is valid Base64.
 */
export function isValidBase64(value: string): boolean {
	if (value.length === 0 || !SHAPE.test(value)) {
		return false;
	}
	const data = value.replace(/=+$/, "");
	const rest = data.length % 4;
	if (rest === 0) {
		return true;
	}
	// The last character encodes 6 bits; with 2 characters 4 of them are leftover, with 3, 2 of them.
	const last = ALPHABET.indexOf(data.charAt(data.length - 1));
	const mask = rest === 2 ? 0x0f : 0x03;
	return (last & mask) === 0;
}

/** `BASE64` type: checks that the content is valid Base64. */
export const BASE64: Type = {
    getName(): string {
        return "BASE64";
    },

    validate(ndef: NodeDefinition, n: Node): void {
        if (!isValidBase64(binaryValue(n))) {
            throw new ValidationException(n.getLine(), "INVALID_VALUE", `Node '${n.getName()}' Invalid Base64`);
        }
    },
};
