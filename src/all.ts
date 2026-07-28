// Punto de entrada público del paquete (out/all.js / out/all.d.ts).
// Todo lo que deba ser consumible por terceros (p. ej. la extensión VSCode)
// debe re-exportarse desde aquí.

export { Node } from "./core/Node";
export { Parser } from "./core/Parser";
export { ParseResult } from "./core/ParseResult";
export { Line } from "./core/Line";
export { Constants } from "./core/Constants";
export { parseLine } from "./core/LineParser";
export { StringUtils } from "./core/StringUtils";

export { ParseException } from "./exceptions/ParseException";

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

export { transformTemplateNodeToSchema } from "./template/TemplateParser";
