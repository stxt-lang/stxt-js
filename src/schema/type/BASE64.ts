import { Node } from "../../core/Node";
import { ValidationException } from "../../exceptions/ValidationException";
import { NodeDefinition } from "../NodeDefinition";
import { Type } from "../Type";
import { binaryValue } from "./binaryValue";

/** Standard alphabet of RFC 4648 section 4, used to check the leftover bits of the last character. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Membership test for the standard alphabet, applied to the padding-stripped core. A plain
 * character class with a single `*`, which matches in linear time with no backtracking —
 * unlike a grouped-repetition shape such as `(?:[A-Za-z0-9+/]{4})*`, whose backtracking state
 * overflows V8's call stack (`RangeError`) on inputs of a few million characters, still inside
 * the default `maxInputSize`.
 */
const ALPHABET_ONLY = /^[A-Za-z0-9+/]*$/;

/**
 * STXT-SCHEMA-SPEC 9.5: standard Base64 (not URL-safe), padding optional, no leftover bits,
 * never empty. The shape is checked in linear time — strip the optional trailing padding,
 * enforce the padding/length rule, verify the core belongs to the standard alphabet — plus
 * the leftover-bits rule; never the platform decoder, which silently ignores characters
 * outside the alphabet.
 *
 * @param value value already stripped of blanks.
 * @returns whether it is valid Base64.
 */
export function isValidBase64(value: string): boolean {
	if (value.length === 0) {
		return false;
	}

	// Strip the optional final padding: 0, 1 or 2 '=' signs, only at the very end of the
	// value. Three or more, or an '=' anywhere else, is rejected below by the alphabet check.
	let core = value;
	let padding = 0;

	if (value.endsWith("==")) {
		core = value.slice(0, -2);
		padding = 2;
	} else if (value.endsWith("=")) {
		core = value.slice(0, -1);
		padding = 1;
	}

	if (!ALPHABET_ONLY.test(core)) {
		return false;
	}

	const rest = core.length % 4;

	// A trailing group of a single character never occurs in Base64. Two '=' close a
	// two-character group, one '=' a three-character group; with no padding the core is
	// whole groups plus an optional final group of two or three characters.
	if (padding === 2 ? rest !== 2 : padding === 1 ? rest !== 3 : rest === 1) {
		return false;
	}

	if (rest === 0) {
		return true;
	}

	// The last character encodes 6 bits; with 2 characters 4 of them are leftover, with 3, 2 of them.
	const last = ALPHABET.indexOf(core.charAt(core.length - 1));
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
