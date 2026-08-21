/** String normalization helpers used for names, namespaces and values. */
export class StringUtils {
	// STXT-SPEC 4.2 / 4.3: letters, decimal digits, combining marks (Mn, Mc) and the three
	// separators, with at least one letter or digit. Validated after NFC so that a
	// decomposed spelling such as "e" + combining acute is accepted as "é".
	private static readonly NODE_NAME = /^[\p{L}\p{Nd}\p{Mn}\p{Mc}\-_ ]+$/u;
	private static readonly NODE_NAME_LETTER_OR_DIGIT = /[\p{L}\p{Nd}]/u;

	// STXT-SPEC 4: a blank is exactly U+0020 or U+0009. Every trim in the core works on
	// these two characters only; String.prototype.trim and /\s/ are deliberately avoided
	// because they also remove NBSP, U+3000, U+2028... which STXT treats as content.
	private static readonly LEADING_BLANKS = /^[ \t]+/;
	private static readonly TRAILING_BLANKS = /[ \t]+$/;
	private static readonly BLANK_RUN = /[ \t]+/g;

	private constructor() {
	}

	/**
	 * Tells whether a character is an STXT blank (STXT-SPEC 4): space or tab.
	 *
	 * @param c single character.
	 * @returns true for U+0020 and U+0009 only.
	 */
	static isBlank(c: string): boolean {
		return c === " " || c === "\t";
	}

	/**
	 * Removes the leading and trailing blanks (space and tab only, STXT-SPEC 4) of a string.
	 *
	 * @param s string to trim.
	 * @returns the trimmed string; null/undefined is treated as the empty string.
	 */
	static trim(s: string | null | undefined): string {
		return (s ?? "").replace(this.LEADING_BLANKS, "").replace(this.TRAILING_BLANKS, "");
	}

	// Used for name>> nodes
	/**
	 * Removes the trailing blanks (space and tab only, STXT-SPEC 4, 10.2) of a string.
	 *
	 * @param s string to strip the trailing blanks from.
	 * @returns the string without trailing blanks; null/undefined is treated as the empty string.
	 */
	static rightTrim(s: string | null | undefined): string {
		return (s ?? "").replace(this.TRAILING_BLANKS, "");
	}

	// Used for BASE64 and HEXADECIMAL nodes
	/**
	 * Removes every whitespace character of a string.
	 *
	 * @param input string to remove the spaces from.
	 * @returns the string without any whitespace at all.
	 */
	static cleanSpaces(input: string): string {
		return input.replace(/\s+/g, "");
	}

	// Used to normalize namespaces
	/**
	 * Lower-cases a string.
	 *
	 * @param input string to lower-case.
	 * @returns the lower-cased string; null/undefined is treated as the empty string.
	 */
	static lowerCase(input: string | null | undefined): string {
		// Practical equivalent of Locale.ROOT in JS: keep the user's locale out of it
		return (input ?? "").toLowerCase();
	}

	// Used for the name of the nodes
	/**
	 * Trims a string and collapses its inner runs of blanks (space and tab only).
	 *
	 * @param s string to compact.
	 * @returns the string with the outer blanks trimmed and the inner runs collapsed into a single space; null/undefined is treated as the empty string.
	 */
	static compactSpaces(s: string | null | undefined): string {
		return this.trim(s).replace(this.BLANK_RUN, " ");
	}

	/**
	 * Tells whether a value is a valid STXT node name.
	 *
	 * The test happens after NFC normalization: the source may use either the
	 * precomposed or decomposed Unicode spelling of a letter with a diacritic.
	 *
	 * @param input name to validate.
	 * @returns true if the name contains only permitted characters and has a non-empty canonical name.
	 */
	static isValidNodeName(input: string | null | undefined): boolean {
		const nfc = this.compactSpaces(input).normalize("NFC");
		return this.NODE_NAME.test(nfc) && this.NODE_NAME_LETTER_OR_DIGIT.test(nfc);
	}

	// Used for the normalized name of the nodes (STXT-SPEC 4.3): NFC + lower case,
	// keeping diacritics and non-Latin alphabets (IDN model)
	/**
	 * Builds the canonical name of a node, as defined by STXT-SPEC 4.3.
	 *
	 * @param input string to normalize.
	 * @returns the canonical name of a node: NFC + lower case, with separators collapsed into '-'; null/undefined is treated as the empty string.
	 */
	static normalize(input: string | null | undefined): string {
		let s = this.trim(input);
		if (s.length === 0) {
			return "";
		}

		s = s.normalize("NFC");
		s = s.toLowerCase();

		// every run of separators ('-', '_', blanks) => a single '-'
		s = s.replace(/[-_ \t]+/g, "-");

		// trim the '-'
		s = s.replace(/^-+|-+$/g, "");

		return s;
	}
}
