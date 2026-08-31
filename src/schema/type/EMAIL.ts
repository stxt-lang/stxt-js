import { regexType } from "./regexType";

/**
 * The address proper, `local@domain` per the normative grammar of STXT-SCHEMA-SPEC 9.4, as it
 * reads when it ends the value (bare form): local part of 1-64 characters, whole address of at
 * most 254, TLD of 2-63 ASCII letters...
 */
const ADDRESS = "(?=.{1,254}$)(?=[^@]{1,64}@)"
	+ "[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,63}";

/** ...and the same address as it reads between `<` and `>` (the lookaheads stop at the `>`). */
const BRACKETED = "(?=[^>]{1,254}>$)(?=[^@>]{1,64}@)"
	+ "[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,63}";

/**
 * `EMAIL` type: checks that the value is an e-mail address, per the normative grammar of
 * STXT-SCHEMA-SPEC 9.4, in either of its two forms: the bare address (`user@domain.tld`) or a
 * display name followed by the address between angle brackets (`Joan Costa <joan@example.com>`).
 * The display name is any non-empty text without `<` or `>` (quotes are not interpreted) whose
 * last character is not a blank, and the blank before `<` is optional; `<`/`>` without a name,
 * unbalanced or followed by anything are rejected. ASCII only (no EAI), permissive with dots
 * (the full RFC 5322 dot-atom is not replicated), RFC 5321 practical length limits. Blanks are
 * the STXT ones (U+0020/U+0009) only, so no `\s` here.
 */
export const EMAIL = regexType("EMAIL",
	new RegExp(`^(?:[^<>]*[^<> \\t][ \\t]*<${BRACKETED}>|${ADDRESS})$`),
	"Invalid email"
);
