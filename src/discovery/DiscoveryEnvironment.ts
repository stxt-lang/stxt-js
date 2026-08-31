/**
 * Environment abstraction used by {@link DiscoveryResolver} (STXT-DISCOVERY-SPEC).
 *
 * It answers the three questions that depend on the platform and the process environment:
 * the `STXT_PATH` override, the user-level directory and the system-level directory.
 * Injecting it keeps the resolver free of `process`/`os` access, deterministic in tests
 * and usable from any host (Node, editor extension, browser).
 */
export interface DiscoveryEnvironment {
	/**
	 * The value of the `STXT_PATH` environment variable, already split into entries.
	 *
	 * The distinction between "not defined" and "defined but empty" is normative
	 * (STXT-DISCOVERY-SPEC section 6): when defined, `STXT_PATH` completely replaces the
	 * resolution chain, and an empty value leaves the chain empty.
	 *
	 * @returns the list of directories (highest precedence first), an empty array when the
	 *          variable is defined but empty, or null when it is not defined at all.
	 */
	getStxtPath(): string[] | null;

	/**
	 * The user-level resolution directory (`$HOME/.stxt` on Unix, `%USERPROFILE%\.stxt` on
	 * Windows), already resolved to a full path.
	 *
	 * @returns the user-level directory, or null when the host has no notion of a user home.
	 */
	getUserLevelDir(): string | null;

	/**
	 * The system-level resolution directory (`/etc/stxt` on Unix, `%ProgramData%\stxt` on
	 * Windows), already resolved to a full path.
	 *
	 * @returns the system-level directory, or null when the host has no system level.
	 */
	getSystemLevelDir(): string | null;
}
