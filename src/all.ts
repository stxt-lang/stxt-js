// Public entry point of the package (out/all.js / out/all.d.ts).
// Anything that should be consumable by third parties (e.g. the VSCode extension)
// has to be re-exported from here.

export { Node } from "./core/Node";
export { InlineNode } from "./core/InlineNode";
export { TextNode } from "./core/TextNode";
export { Parser } from "./core/Parser";
export { ParseResult } from "./core/ParseResult";
export { Line } from "./core/Line";
export { Constants } from "./core/Constants";
import { Constants as _Constants } from "./core/Constants";
/**
 * Version of STXT-SPEC (the base syntax) this library implements, distinct from the version of
 * the package; each specification is versioned independently (STXT-SPEC §1.1). Same value as
 * `Constants.SPEC_VERSION`.
 */
export const SPEC_VERSION: string = _Constants.SPEC_VERSION;
export { parseLine } from "./core/LineParser";
export { StringUtils } from "./core/StringUtils";

export { ParseException } from "./exceptions/ParseException";
export { ValidationException } from "./exceptions/ValidationException";

export { Observer } from "./processors/Observer";

export { Schema } from "./schema/Schema";
export { SchemaValidator } from "./schema/SchemaValidator";
export { SchemaProvider } from "./schema/SchemaProvider";
export { NodeDefinition } from "./schema/NodeDefinition";
export { ChildDefinition } from "./schema/ChildDefinition";
export { transformNodeToSchema } from "./schema/SchemaParser";

export { UnifiedSchemaProvider } from "./runtime/UnifiedSchemaProvider";
export { ConditionalValidator } from "./runtime/ConditionalValidator";
export { NodeWriter, IndentStyle } from "./runtime/NodeWriter";
export { toCanonicalTree, toCanonicalJson } from "./runtime/TreeJson";
export type { CanonicalDocument, CanonicalNode, CanonicalInlineNode, CanonicalBlockNode } from "./runtime/TreeJson";

export { transformTemplateNodeToSchema } from "./template/TemplateParser";

export { DiscoveryResolver, DiscoveryOptions } from "./discovery/DiscoveryResolver";
export { DiscoveryResult, DiscoveryDefinition, DiscoveryLevel } from "./discovery/DiscoveryResult";
export { DiscoveryError } from "./discovery/DiscoveryError";
export { DiscoveryFileSystem, DiscoveryEntry } from "./discovery/DiscoveryFileSystem";
export { DiscoveryEnvironment } from "./discovery/DiscoveryEnvironment";
