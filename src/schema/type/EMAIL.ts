import { regexType } from "./regexType";

/**
 * The address proper, `local@domain` with the usual length limits, as it reads when it ends the
 * value (bare form)...
 */
const ADDRESS = "(?=.{1,256}$)(?=.{1,64}@.{1,255}$)(?=.{1,64}@.{1,63}\\..{1,63}$)"
    + "[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";

/** ...and the same address as it reads between `<` and `>` (the lookaheads stop at the `>`). */
const BRACKETED = "(?=[^>]{1,256}>$)(?=[^>]{1,64}@[^>]{1,255}>$)(?=[^>]{1,64}@[^>]{1,63}\\.[^>]{1,63}>$)"
    + "[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";

/**
 * `EMAIL` type: checks that the value is an e-mail address, in either of the two forms of
 * STXT-SCHEMA-SPEC 9.4: the bare address (`user@domain.tld`) or a display name followed by the
 * address between angle brackets (`Joan Costa <joan@example.com>`). The display name is any
 * non-empty text without `<` or `>` (quotes are not interpreted) and the space before `<` is
 * optional; `<`/`>` without a name, unbalanced or followed by anything are rejected.
 */
export const EMAIL = regexType("EMAIL",
    new RegExp(`^(?:[^<>]*[^<>\\s]\\s*<${BRACKETED}>|${ADDRESS})$`),
    "Invalid email"
);
