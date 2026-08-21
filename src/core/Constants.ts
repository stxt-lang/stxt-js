/** Characters and sizes fixed by STXT-SPEC that the parser and the writer share. */
export class Constants {
	/**
	 * Version of STXT-SPEC (the base syntax) this library implements; "STXT 1.0" on its own means
	 * this number (STXT-SPEC §1.1). Each specification is versioned independently, so the schema,
	 * template, tree and discovery specs may carry other numbers. It is distinct from the version
	 * of the package: the package may be released many times against the same specification
	 * version.
	 */
	static readonly SPEC_VERSION: string = "1.0";
	/** Character that opens a comment line. */
	static readonly COMMENT_CHAR: string = "#";
	/** Number of spaces that make up one indentation level. */
	static readonly TAB_SPACES: number = 4;
	/** Tab character, the other way of indenting one level. */
	static readonly TAB: string = "\t";
	/** Space character. */
	static readonly SPACE: string = " ";
	/** Separator between the name and the value of an INLINE node. */
	static readonly SEP_NODE: string = ":";
	/** Marker that turns a node into a BLOCK text node. */
	static readonly SEP_TEXT_NODE: string = ">>";
	/** Namespace of a node that declares none and inherits none. */
	static readonly EMPTY_NAMESPACE: string = "";
}
