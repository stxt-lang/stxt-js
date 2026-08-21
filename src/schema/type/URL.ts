import { regexType } from "./regexType";

/**
 * `URL` type: an absolute URL with a mandatory scheme and host, following the grammar of
 * STXT-SCHEMA-SPEC 9.4 — `scheme "://" [userinfo "@"] host [":" port] ["/" path] ["?" query]
 * ["#" fragment]` — and not the platform URL parser, so every port accepts exactly the same
 * values. Any scheme of the form letter + letters/digits/`+`/`-`/`.` is accepted; the host is
 * non-empty (no TLD required, IPv6 in brackets, non-ASCII kept as it is); a value without a
 * scheme, a scheme without `//` and host (`mailto:`, `urn:`, `file:///`), inner blanks or a
 * non-numeric port are rejected. Nothing is resolved or normalised.
 */
export const URL = regexType(
	"URL",
	/^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^ \t/?#@]+@)?(?:\[[0-9A-Fa-f:.]+\]|[^ \t/?#@:[\]]+)(?::[0-9]+)?(?:\/[^ \t?#]*)?(?:\?[^ \t#]*)?(?:#[^ \t]*)?$/,
	"Invalid URL"
);
