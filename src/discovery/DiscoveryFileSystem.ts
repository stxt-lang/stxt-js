/**
 * An entry of a directory listing, as returned by {@link DiscoveryFileSystem.listDirectory}.
 */
export interface DiscoveryEntry {
	/** Full path of the entry, in the same form the file system uses for every other path. */
	path: string;
	/** Base name of the entry (last path segment). */
	name: string;
	/** True if the entry is a directory. */
	isDirectory: boolean;
}

/**
 * Minimal file-system abstraction used by {@link DiscoveryResolver} (STXT-DISCOVERY-SPEC).
 *
 * The resolver treats paths as opaque strings: it never parses or concatenates them itself,
 * so an implementation may back them with plain OS paths (Node `fs`), editor URIs
 * (`vscode.workspace.fs`) or an in-memory tree for tests. All paths returned by an
 * implementation must be canonical enough that string equality means "same directory".
 */
export interface DiscoveryFileSystem {
	/**
	 * Whether a path exists and is a directory.
	 *
	 * @param path path to check.
	 * @returns true if the path is an existing directory; false otherwise (including I/O errors).
	 */
	isDirectory(path: string): Promise<boolean>;

	/**
	 * Lists the immediate entries of a directory.
	 *
	 * @param path directory to list.
	 * @returns the entries of the directory, in any order.
	 */
	listDirectory(path: string): Promise<DiscoveryEntry[]>;

	/**
	 * Reads a file as UTF-8 text. The decode must be STRICT (STXT-SPEC §3): input that is not
	 * valid UTF-8 is rejected — the promise rejects, an I/O-level error like a missing file —
	 * never decoded by silently substituting the invalid sequences with U+FFFD. In Node that
	 * means decoding the buffer with `new TextDecoder("utf-8", { fatal: true })`, not
	 * `readFile(path, "utf-8")`, which substitutes.
	 *
	 * @param path file to read.
	 * @returns the text content of the file.
	 */
	readFile(path: string): Promise<string>;

	/**
	 * Returns the parent directory of a path, or null when the path is the file-system root.
	 *
	 * @param path path whose parent is wanted.
	 * @returns the parent path, or null at the root.
	 */
	parentOf(path: string): string | null;

	/**
	 * Joins a directory path and a child name.
	 *
	 * @param path base directory.
	 * @param name child segment to append.
	 * @returns the joined path.
	 */
	join(path: string, name: string): string;
}
