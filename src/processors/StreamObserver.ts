import { Node } from "../core/Node";
import { ParseException } from "../exceptions/ParseException";

/**
 * Process hook notified by the {@link Parser} with the stream of results a parse emits: each
 * completed root node, and every error. It complements {@link Observer}, which watches the
 * process line by line: a StreamObserver only sees finished roots and errors, so a consumer
 * that processes a document root by root never has to ask a node for its level. Register it
 * with {@link Parser.registerStreamObserver}; a class may implement {@link Observer},
 * StreamObserver or both.
 *
 * It fires in every entry point — `parse()`, `parseResult()` and `parseStream()` — exactly the
 * same way; what `parseStream()` adds is that the parser retains nothing, so there these
 * callbacks are the only way to get the results.
 */
export interface StreamObserver {
	/**
	 * Called when a root (level 0) node is closed, with its whole subtree already complete —
	 * children, values, text lines — and its validators already run. In
	 * {@link Parser.parseStream} the parser releases the node right after this call, so the
	 * memory in use is one root tree at a time.
	 *
	 * @param node the completed root node. Do not modify it.
	 */
	onRootNode(node: Node): void;
	/**
	 * Called for every error found (syntax or validation), in order of appearance. Parsing
	 * continues with the next line, except for `LIMIT_*` errors ({@link LimitException},
	 * STXT-SPEC §11.2), which abort the parse right after this call. In fail-fast
	 * {@link Parser.parse} the observer still sees every error before the first one is thrown,
	 * because `parse()` reuses the `parseResult()` traversal.
	 *
	 * @param error the error found.
	 */
	onError(error: ParseException): void;
}
