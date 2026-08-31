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
	/**
	 * Default maximum open nesting levels (STXT-SPEC §11.2); level 0 is the first. Configure it
	 * per parser with {@link ParserOptions.maxNesting}; -1 disables the limit.
	 */
	static readonly DEFAULT_MAX_NESTING: number = 100;
	/**
	 * Default maximum length of one input line, indentation included (STXT-SPEC §11.2).
	 * Configure it per parser with {@link ParserOptions.maxLineLength}; -1 disables the limit.
	 */
	static readonly DEFAULT_MAX_LINE_LENGTH: number = 10000;
	/**
	 * Default maximum total input consumed (STXT-SPEC §11.2). Configure it per parser with
	 * {@link ParserOptions.maxInputSize}; -1 disables the limit.
	 */
	static readonly DEFAULT_MAX_INPUT_SIZE: number = 10000000;
	/**
	 * Upper bound of `Min`/`Max` in a schema and of the numbers of a template cardinality:
	 * 2^32 - 1 (STXT-SCHEMA-SPEC §10, STXT-TEMPLATE-SPEC §7.1). A greater value is
	 * `CARDINALITY_NOT_VALID`; "no maximum" is said by omitting `Max`.
	 */
	static readonly MAX_CARDINALITY: number = 4294967295;
}
