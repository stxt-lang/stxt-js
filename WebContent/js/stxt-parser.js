class Constants {
}
Constants.COMMENT_CHAR = "#";
Constants.TAB_SPACES = 4;
Constants.TAB = "\t";
Constants.SPACE = " ";
Constants.SEP_NODE = ":";
Constants.SEP_TEXT_NODE = ">>";
Constants.EMPTY_NAMESPACE = "";

const DIACRITICS = /[\u0300-\u036f]+/g;
class StringUtils {
    constructor() {
    }
    // Usado para nodos name>>
    static rightTrim(s) {
        if (s == null) {
            return "";
        }
        let i = s.length - 1;
        while (i >= 0 && /\s/.test(s.charAt(i))) {
            i--;
        }
        return s.substring(0, i + 1);
    }
    // Usado para nodos tipo Base64 y Hex
    static cleanSpaces(input) {
        return input.replace(/\s+/g, "");
    }
    // Usado para normalizar namespace
    static lowerCase(input) {
        if (input == null) {
            return "";
        }
        // Equivalente práctico a Locale.ROOT en JS: evitar dependencias de locale del usuario
        return input.toLowerCase();
    }
    // Usados para name de los nodos
    static compactSpaces(s) {
        if (s == null) {
            return "";
        }
        return s.trim().replace(/\s+/g, " ");
    }
    // Usados para name normalizado de nodos
    static normalize(input) {
        if (input == null) {
            return "";
        }
        let s = input.trim();
        if (s.length === 0) {
            return "";
        }
        // Similar a Normalizer.Form.NFKD
        s = s.normalize("NFKD");
        s = s.replace(DIACRITICS, "");
        s = s.toLowerCase();
        s = StringUtils.compactSpaces(s);
        // cualquier cosa que no sea [a-z0-9] => '-'
        s = s.replace(/[^a-z0-9]+/g, "-");
        // trim de '-'
        s = s.replace(/^-+|-+$/g, "");
        return s;
    }
}

class ParseException extends Error {
    constructor(line, code, message) {
        super(message);
        this.name = "ParseException";
        this.line = line;
        this.code = code;
        Object.setPrototypeOf(this, ParseException.prototype);
    }
    toString() {
        return `${this.name} [line=${this.line}, code=${this.code}]: ${this.message}`;
    }
}

class Line {
    constructor(level, content, isComment, isBlock, indentLength) {
        this.level = level;
        this.content = content;
        this.isComment = isComment;
        this.isBlock = isBlock;
        this.indentLength = indentLength;
    }
    isEmpty() {
        return this.content.trim() === "";
    }
}

function parseLine(line, lastNodeBlock, lastLevel, numLine, validate = true) {
    let level = 0;
    let spaces = 0;
    let pointer = 0;
    while (pointer < line.length) {
        const c = line.charAt(pointer);
        if (c === Constants.SPACE) {
            spaces++;
            if (spaces === Constants.TAB_SPACES) {
                level++;
                spaces = 0;
            }
        }
        else if (c === Constants.TAB) {
            level++;
            spaces = 0;
        }
        else if (c === Constants.COMMENT_CHAR) {
            return new Line(level, line.substring(pointer + 1), true, false, pointer);
        }
        else {
            // Primer carácter no espacio/tab/comentario => fin de indentación
            break;
        }
        // Dentro del bloque de texto
        if (lastNodeBlock && level > lastLevel) {
            return new Line(level, StringUtils.rightTrim(line.substring(pointer + 1)), false, true, pointer);
        }
        // Aumentamos pointer
        pointer++;
    }
    // En este punto ya estamos fuera de bloque de texto (si existía)
    // Empty
    if (pointer === line.length) {
        if (lastNodeBlock) {
            return new Line(level, "", false, true, pointer);
        }
        return new Line(level, "", false, false, pointer);
    }
    // Indentación no es múltiplo de 4 con espacios
    if (validate && spaces > 0) {
        throw new ParseException(numLine, "INVALID_NUMBER_SPACES", `There are ${spaces} spaces before node`);
    }
    // Validamos level
    if (validate && level > lastLevel + 1) {
        throw new ParseException(numLine, "INDENTATION_LEVEL_NOT_VALID", `Level of indent incorrect: ${level}`);
    }
    // Caso general: devolver la línea sin la indentación consumida
    return new Line(level, line.substring(pointer).trim(), false, false, pointer);
}

class NameNamespace {
    constructor(name, namespace) {
        this.name = name;
        this.namespace = namespace;
    }
    getName() {
        return this.name;
    }
    getNamespace() {
        return this.namespace;
    }
}

class NameNamespaceParser {
    constructor() {
    }
    static parse(rawName, inheritedNs, lineNumber, fullLine) {
        if (rawName == null) {
            throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${fullLine}`);
        }
        rawName = rawName.trim();
        const startIndex = rawName.indexOf("(");
        const endIndex = rawName.indexOf(")");
        let name;
        let namespace = inheritedNs ?? "";
        // Encontrados los dos
        if (startIndex !== -1 && endIndex !== -1) {
            if (startIndex > endIndex || endIndex !== rawName.length - 1) {
                throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
            }
            name = rawName.substring(0, startIndex).trim();
            namespace = rawName.substring(startIndex + 1, endIndex).trim();
            if (namespace.length === 0) {
                throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
            }
        }
        // Ninguno de los dos
        else if (startIndex === -1 && endIndex === -1) {
            name = rawName;
        }
        // Solo uno de los dos
        else {
            throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Line not valid: ${fullLine}`);
        }
        // Retorno
        return new NameNamespace(name, namespace.toLowerCase());
    }
}

class RuntimeException extends Error {
    constructor(code, message) {
        super(message);
        this.name = "RuntimeException";
        this.code = code;
        Object.setPrototypeOf(this, RuntimeException.prototype);
    }
    getCode() {
        return this.code;
    }
    toString() {
        const message = this.message;
        return `${this.name}[${this.code}]${message ? `: ${message}` : ""}`;
    }
}

class NamespaceValidator {
    static validateNamespaceFormat(namespace, lineNumber) {
        if (namespace == null || namespace.length === 0) {
            return;
        }
        if (!NamespaceValidator.NAMESPACE_FORMAT.test(namespace)) {
            throw new ParseException(lineNumber, "INVALID_NAMESPACE", `Namespace not valid: ${namespace}`);
        }
    }
}
NamespaceValidator.NAMESPACE_FORMAT = /^@?[a-z0-9]+(\.[a-z0-9]+)+$/;

class Node {
    constructor(line, level, name, namespace, textNode, value) {
        this.textLines = [];
        this.children = [];
        this.isFrozen = false;
        this.level = level;
        this.line = line;
        this.name = StringUtils.compactSpaces(name);
        this.normalizedName = StringUtils.normalize(name);
        this.namespace = StringUtils.lowerCase(namespace);
        this.value = (value ?? "").trim();
        this.textNode = textNode;
        NamespaceValidator.validateNamespaceFormat(this.namespace, line);
        if (this.value.length > 0 && this.isTextNode()) {
            throw new RuntimeException("INLINE_VALUE_NOT_VALID", "Not empty value with textNode");
        }
        if (this.normalizedName.length === 0) {
            throw new ParseException(line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
        }
    }
    addTextLine(line) {
        this.textLines.push(line);
    }
    getName() {
        return this.name;
    }
    getNormalizedName() {
        return this.normalizedName;
    }
    getQualifiedName() {
        return this.namespace.length === 0
            ? this.normalizedName
            : `${this.namespace}:${this.normalizedName}`;
    }
    getNamespace() {
        return this.namespace;
    }
    getChildren() {
        return this.children;
    }
    addChild(node) {
        if (this.isFrozen) {
            throw new RuntimeException("NODE_FROZEN", "Node is frozen");
        }
        this.children.push(node);
    }
    getValue() {
        return this.value;
    }
    getTextLines() {
        return this.textLines;
    }
    getLine() {
        return this.line;
    }
    getLevel() {
        return this.level;
    }
    isTextNode() {
        return this.textNode;
    }
    getText() {
        return this.isTextNode() ? this.textLines.join("\n") : this.value;
    }
    freeze() {
        if (this.isFrozen) {
            return;
        }
        for (const n of this.children) {
            n.freeze();
        }
        Object.freeze(this.children);
        Object.freeze(this.textLines);
        this.isFrozen = true;
    }
    getChild(cname, namespace) {
        const result = this.getChildrenByName(cname, namespace);
        if (result.length > 1) {
            throw new RuntimeException("AMBIGUOUS_CHILD", "More than 1 child. Use getChildren");
        }
        if (result.length === 0) {
            return null;
        }
        return result[0];
    }
    // Fast access methods to children
    getChildrenByName(cname, namespace) {
        const key = StringUtils.normalize(cname);
        const targetNamespace = namespace !== undefined ? namespace : this.namespace;
        const result = [];
        for (const child of this.children) {
            if (child.getNormalizedName() === key && child.getNamespace() === targetNamespace) {
                result.push(child);
            }
        }
        return result;
    }
    toString() {
        let s = "Node{";
        s += `line=${this.line}`;
        s += `, level=${this.level}`;
        s += `, name='${this.name}'`;
        if (this.namespace.length > 0) {
            s += `, ns='${this.namespace}'`;
        }
        s += `, text=${this.textNode}`;
        if (!this.textNode && this.value.length > 0) {
            s += `, value='${this.value}'`;
        }
        if (this.textNode) {
            s += `, lines=${this.textLines.length}`;
        }
        s += `, children=${this.children.length}`;
        s += "}";
        return s;
    }
}

function createNode(lineIndent, lineNumber, level, parent) {
    const line = lineIndent.content;
    let name;
    let value;
    let textNode = false;
    const nodeIndex = line.indexOf(Constants.SEP_NODE);
    const textIndex = line.indexOf(Constants.SEP_TEXT_NODE);
    if (nodeIndex === -1 && textIndex === -1) {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }
    else if (nodeIndex === -1 && textIndex !== -1) {
        textNode = true;
    }
    else if (nodeIndex !== -1 && textIndex === -1) {
        textNode = false;
    }
    else if (nodeIndex < textIndex) {
        textNode = false;
    }
    else {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }
    if (textNode) {
        name = line.substring(0, textIndex);
        value = line.substring(textIndex + Constants.SEP_TEXT_NODE.length);
    }
    else {
        name = line.substring(0, nodeIndex);
        value = line.substring(nodeIndex + Constants.SEP_NODE.length);
    }
    if (textNode && value.trim().length > 0) {
        throw new ParseException(lineNumber, "INLINE_VALUE_NOT_VALID", `Line not valid: ${line}`);
    }
    // Namespace por defecto: heredado del padre
    const nameNamespace = NameNamespaceParser.parse(name, parent ? parent.getNamespace() : null, lineNumber, line);
    name = nameNamespace.getName();
    const namespace = nameNamespace.getNamespace();
    // Validamos nombre
    if (name.length === 0) {
        throw new ParseException(lineNumber, "INVALID_LINE", `Line not valid: ${line}`);
    }
    // Creamos nodo
    return new Node(lineNumber, level, name, namespace, textNode, value);
}

class ParseResult {
    constructor(nodes = [], errors = []) {
        this.nodes = nodes;
        this.errors = errors;
    }
    getNodes() {
        return this.nodes;
    }
    getErrors() {
        return this.errors;
    }
    hasErrors() {
        return this.errors.length > 0;
    }
    addError(error) {
        this.errors.push(error);
    }
    addNode(node) {
        this.nodes.push(node);
    }
}

class Parser {
    constructor() {
        this.observers = [];
        this.validators = [];
    }
    registerObserver(observer) {
        this.observers.push(observer);
    }
    registerValidator(validator) {
        this.validators.push(validator);
    }
    parse(content) {
        const result = this.parseResult(content);
        if (result.hasErrors()) {
            const error = result.getErrors()[0];
            throw error;
        }
        return result.getNodes();
    }
    parseResult(content) {
        content = this.removeUTF8BOM(content);
        const result = new ParseResult();
        const stack = [];
        const documents = [];
        let lineNumber = 0;
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            lineNumber++;
            this.processLine(line, lineNumber, stack, documents, result);
        }
        // Cerrar todos los nodos pendientes al EOF
        this.closeToLevel(stack, documents, 0, result);
        // Agregar nodos al resultado
        for (const doc of documents) {
            result.addNode(doc);
        }
        // Retorno resultado
        return result;
    }
    processLine(lineString, lineNumber, stack, documents, result) {
        try {
            const lastNode = stack.length === 0 ? null : stack[stack.length - 1];
            const lastLevel = lastNode ? lastNode.getLevel() : 0;
            const lastNodeText = lastNode ? lastNode.isTextNode() : false;
            // Parseamos línea
            const line = parseLine(lineString, lastNodeText, lastLevel, lineNumber);
            if (line.isComment) {
                // Pasamos a observers
                this.observers.forEach(observer => {
                    observer.onComment(lineNumber, lineString);
                });
                return;
            }
            const currentLevel = line.level;
            // Si estamos dentro de un nodo texto, y el nivel indica que sigue siendo texto,
            // añadimos línea de texto y no creamos nodo.
            if (line.isBlock) {
                lastNode.addTextLine(line.content);
                // Notificar a observers sobre la línea de texto
                this.observers.forEach(observer => {
                    observer.onTextLine(lastNode, lineNumber, lineString, line);
                });
                return;
            }
            // Si es línea vacía no hacemos nada
            if (line.isEmpty()) {
                return;
            }
            // Cerramos nodos hasta el nivel actual (esto "finaliza" y adjunta al padre/documentos)
            this.closeToLevel(stack, documents, currentLevel, result);
            // Creamos el nuevo nodo y lo dejamos "abierto" en la pila (NO lo adjuntamos aún)
            const parent = stack.length === 0 ? null : stack[stack.length - 1];
            const node = createNode(line, lineNumber, currentLevel, parent);
            // Pasamos a observers
            this.observers.forEach(observer => {
                observer.onCreate(node, lineString);
            });
            // Añadimos a stack
            stack.push(node);
        }
        catch (e) {
            this.handleError(e, lineNumber, result);
        }
    }
    handleError(e, line, result, errorCode = "UNEXPECTED_ERROR", unknownErrorCode = "UNKNOWN_ERROR") {
        if (e instanceof ParseException) {
            result.addError(e);
        }
        else if (e instanceof Error) {
            // Convertir errores genéricos a ParseException
            result.addError(new ParseException(line, errorCode, e.message));
        }
        else {
            // Error desconocido
            result.addError(new ParseException(line, unknownErrorCode, String(e)));
        }
    }
    closeToLevel(stack, documents, targetLevel, result) {
        while (stack.length > targetLevel) {
            const completed = stack.pop();
            completed.freeze();
            // Pasamos validators
            this.validators.forEach(validator => {
                try {
                    const errors = validator.validate(completed);
                    errors.forEach(error => {
                        result.addError(error);
                    });
                }
                catch (e) {
                    this.handleError(e, completed.getLine(), result, "VALIDATION_ERROR", "UNKNOWN_VALIDATION_ERROR");
                }
            });
            if (stack.length === 0) {
                documents.push(completed);
            }
            else {
                stack[stack.length - 1].addChild(completed);
            }
            // Pasamos a observers
            this.observers.forEach(observer => {
                observer.onFinish(completed);
            });
        }
    }
    removeUTF8BOM(content) {
        return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
    }
}

class ValidationException extends ParseException {
    constructor(line, code, message) {
        super(line, code, message);
        this.name = "ValidationException";
        Object.setPrototypeOf(this, ValidationException.prototype);
    }
}

class Schema {
    constructor(namespace, line, description) {
        this.nodes = new Map();
        this.namespace = StringUtils.lowerCase(namespace);
        this.description = description;
        NamespaceValidator.validateNamespaceFormat(this.namespace, line);
    }
    getNodes() {
        return this.nodes;
    }
    getNodeDefinition(name) {
        return this.nodes.get(StringUtils.normalize(name));
    }
    addNodeDefinition(nodeDefinition) {
        const qname = nodeDefinition.getNormalizedName();
        if (this.nodes.has(qname)) {
            throw new ValidationException(0, "NODE_DEF_ALREADY_DEFINED", `Exists a previous node definition with: ${qname}`);
        }
        this.nodes.set(qname, nodeDefinition);
    }
    getNamespace() {
        return this.namespace;
    }
    // Dentro de la clase Schema
    toJSON() {
        return {
            namespace: this.namespace,
            nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
        };
    }
    toString() {
        return JSON.stringify(this, null, 2); // pretty print
    }
}
Schema.SCHEMA_NAMESPACE = "@stxt.schema";

class NodeDefinition {
    constructor(name, type, line, description) {
        this.children = new Map();
        this.values = new Set();
        this.name = StringUtils.compactSpaces(name);
        this.normalizedName = StringUtils.normalize(name);
        this.type = type;
        this.description = description;
        if (this.normalizedName.length === 0) {
            throw new ValidationException(line, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
        }
    }
    getName() {
        return this.name;
    }
    getNormalizedName() {
        return this.normalizedName;
    }
    getType() {
        return this.type;
    }
    getChildren() {
        return this.children;
    }
    getDescription() {
        return this.description;
    }
    setDescription(description) {
        this.description = description;
    }
    addChildDefinition(childDefinition) {
        const qname = childDefinition.getQualifiedName();
        if (this.children.has(qname)) {
            throw new ValidationException(0, "CHILD_DEF_ALREADY_DEFINED", `Exists a previous node definition with: ${qname}`);
        }
        this.children.set(qname, childDefinition);
    }
    addValue(value, line) {
        if (this.values.has(value)) {
            throw new ValidationException(line ?? 0, "DUPLICATE_ENUM_VALUE", `Duplicate enum value: '${value}'`);
        }
        this.values.add(value);
    }
    isAllowedValue(value) {
        if (this.values.size === 0) {
            return true;
        }
        return this.values.has(value);
    }
    getValues() {
        return this.values;
    }
    toJSON() {
        return {
            name: this.getName(),
            normalizedName: this.getNormalizedName(),
            type: this.getType(),
            description: this.description,
            children: Array.from(this.getChildren().values()).map(c => c.toJSON()),
            values: Array.from(this.getValues()),
        };
    }
}

class ChildDefinition {
    constructor(name, namespace, min, max, numLine) {
        this.name = StringUtils.compactSpaces(name);
        this.normalizedName = StringUtils.normalize(name);
        this.namespace = StringUtils.lowerCase(namespace);
        this.min = min;
        this.max = max;
        NamespaceValidator.validateNamespaceFormat(this.namespace, numLine);
        if (this.normalizedName.length === 0) {
            throw new ValidationException(numLine, "INVALID_NODE_NAME", `Node name not valid: ${name}`);
        }
    }
    getName() {
        return this.name;
    }
    getNormalizedName() {
        return this.normalizedName;
    }
    getNamespace() {
        return this.namespace;
    }
    getMin() {
        return this.min;
    }
    getMax() {
        return this.max;
    }
    getQualifiedName() {
        return this.namespace.length === 0
            ? this.normalizedName
            : `${this.namespace}:${this.normalizedName}`;
    }
    toJSON() {
        return {
            name: this.getName(),
            normalizedName: this.getNormalizedName(),
            namespace: this.getNamespace(),
            min: this.getMin(),
            max: this.getMax(),
        };
    }
}

const INLINE = {
    getName() {
        return "INLINE";
    },
    validate(nodeDef, node) {
        if (node.getTextLines().length > 0) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
        }
    },
};

const BLOCK = {
    getName() {
        return "BLOCK";
    },
    validate(nodeDef, node) {
        if (node.getValue().length > 0) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_VALUE", `Not allowed inline text in node ${node.getQualifiedName()}`);
        }
    },
};

const TEXT = {
    getName() {
        return "TEXT";
    },
    validate(nodeDef, node) {
        if (node.getChildren().length > 0) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_CHILDREN_TEXT", `Not allowed children nodes in node ${node.getQualifiedName()}`);
        }
    },
};

function regexType(name, pattern, error) {
    return {
        getName: () => name,
        validate(nodeDef, node) {
            const value = node.getText();
            if (!pattern.test(value)) {
                throw new ValidationException(node.getLine(), "INVALID_VALUE", `${node.getName()}: ${error} (${value})`);
            }
        },
    };
}

const BOOLEAN = regexType("BOOLEAN", /^(true|false)$/, "Invalid boolean");

const URL = {
    getName() {
        return "URL";
    },
    validate(ndef, n) {
        const url = n.getValue();
        try {
            const parsed = new globalThis.URL(url);
            const ok = !!parsed.protocol && !!parsed.hostname;
            if (!ok) {
                throw new ValidationException(n.getLine(), "INVALID_URL_STRUCTURE", `Invalid URL: ${url}`);
            }
        }
        catch {
            throw new ValidationException(n.getLine(), "INVALID_VALUE", `Invalid URL: ${url}`);
        }
    },
};

const INTEGER = regexType("INTEGER", /^[-+]?\d+$/, "Invalid integer");

const NATURAL = regexType("NATURAL", /^\d+$/, "Invalid natural");

const NUMBER = regexType("NUMBER", /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/, "Invalid number");

const DATE = regexType("DATE", /^\d{4}-\d{2}-\d{2}$/, "Invalid date");

const TIMESTAMP = regexType("TIMESTAMP", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[+-]\d{2}:\d{2})?$/, "Invalid timestamp");

const EMAIL = regexType("EMAIL", /^(?=.{1,256}$)(?=.{1,64}@.{1,255}$)(?=.{1,64}@.{1,63}\..{1,63}$)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, "Invalid email");

const HEXADECIMAL = {
    getName() {
        return "HEXADECIMAL";
    },
    validate(ndef, n) {
        // Elimina espacios, tabs y saltos de línea
        let value = StringUtils.cleanSpaces(n.getText());
        if (value.length === 0) {
            throw invalid(n, "Invalid hexadecimal (empty)");
        }
        // Permitir prefijo '#'
        if (value.startsWith("#")) {
            value = value.substring(1);
        }
        if (value.length === 0) {
            throw invalid(n, "Invalid hexadecimal (only '#')");
        }
        // Longitud par (hexadecimal por bytes)
        if ((value.length & 1) !== 0) {
            throw invalid(n, "Invalid hexadecimal length (must be even)");
        }
        // Validar caracteres hexadecimales
        for (let i = 0; i < value.length; i++) {
            const c = value.charAt(i);
            // Equivalente a Character.digit(c, 16) == -1
            if (!/^[0-9a-fA-F]$/.test(c)) {
                throw invalid(n, `Invalid hexadecimal character '${c}'`);
            }
        }
    },
};
function invalid(n, msg) {
    return new ValidationException(n.getLine(), "INVALID_VALUE", `${n.getName()}: ${msg}`);
}

// Decodifica/codifica base64 de forma isomorfa: usa Buffer en Node y
// atob/btoa en el navegador (ambos operan sobre "binary strings").
function base64Decode(raw) {
    const Buffer = globalThis.Buffer;
    if (typeof Buffer !== "undefined") {
        return Buffer.from(raw, "base64").toString("binary");
    }
    return atob(raw);
}
function base64Encode(binary) {
    const Buffer = globalThis.Buffer;
    if (typeof Buffer !== "undefined") {
        return Buffer.from(binary, "binary").toString("base64");
    }
    return btoa(binary);
}
const BASE64 = {
    getName() {
        return "BASE64";
    },
    validate(ndef, n) {
        const raw = StringUtils.cleanSpaces(n.getText());
        try {
            // Intentamos decodificar (Buffer en Node, atob en navegador)
            const decoded = base64Decode(raw);
            // Re-encode para verificar consistencia
            // (evita aceptar cadenas parcialmente válidas)
            const reencoded = base64Encode(decoded);
            // Normalizamos padding para comparar
            const normalizedInput = raw.replace(/=+$/, "");
            const normalizedReencoded = reencoded.replace(/=+$/, "");
            if (normalizedInput !== normalizedReencoded) {
                throw new ValidationException(n.getLine(), "INVALID_VALUE", `Node '${n.getName()}' Invalid Base64`);
            }
        }
        catch {
            throw new ValidationException(n.getLine(), "INVALID_VALUE", `Node '${n.getName()}' Invalid Base64`);
        }
    },
};

const GROUP = {
    getName() {
        return "GROUP";
    },
    validate(nodeDef, node) {
        if (node.getValue().length > 0 || node.getTextLines().length > 0) {
            throw new ValidationException(node.getLine(), "INVALID_VALUE", `Node '${node.getName()}' has to be empty`);
        }
    },
};

const ENUM = {
    getName() {
        return "ENUM";
    },
    validate(nodeDef, node) {
        if (node.getTextLines().length > 0) {
            throw new ValidationException(node.getLine(), "NOT_ALLOWED_TEXT", `Not allowed text in node ${node.getQualifiedName()}`);
        }
        const value = node.getValue();
        const allowed = nodeDef.getValues(); // ReadonlySet<string>
        if (!nodeDef.isAllowedValue(value)) {
            throw new ValidationException(node.getLine(), "INVALID_VALUE", `The value '${value}' not allowed. Only: ${Array.from(allowed).join(", ")}`);
        }
    },
};

class TypeRegistry {
    static get(nodeType) {
        // fuerza que se ejecute _init al cargar la clase (por si el bundler hiciera cosas raras)
        void this._init;
        return this.REGISTRY.get(nodeType);
    }
    static register(instance) {
        const name = instance.getName();
        if (this.REGISTRY.has(name)) {
            throw new RuntimeException("DUPLICATED_TYPE", `Type already defined: ${name}`);
        }
        this.REGISTRY.set(name, instance);
    }
}
TypeRegistry.REGISTRY = new Map();
// Inicialización estática (sin INSTANCE)
TypeRegistry._init = (() => {
    // Tipos principales
    TypeRegistry.register(INLINE);
    TypeRegistry.register(BLOCK);
    // Subtipos
    TypeRegistry.register(TEXT);
    TypeRegistry.register(BOOLEAN);
    TypeRegistry.register(URL);
    TypeRegistry.register(INTEGER);
    TypeRegistry.register(NATURAL);
    TypeRegistry.register(NUMBER);
    TypeRegistry.register(DATE);
    TypeRegistry.register(TIMESTAMP);
    TypeRegistry.register(EMAIL);
    TypeRegistry.register(HEXADECIMAL);
    TypeRegistry.register(BASE64);
    TypeRegistry.register(GROUP);
    TypeRegistry.register(ENUM);
    return true;
})();

class SchemaValidator {
    constructor(schemaProvider, recursive = false) {
        this.schemaProvider = schemaProvider;
        this.recursiveValidation = recursive;
    }
    validate(node) {
        const errors = [];
        // Obtenemos namespace
        const namespace = node.getNamespace();
        const schema = this.schemaProvider.getSchema(namespace);
        if (!schema) {
            errors.push(new ValidationException(node.getLine(), "SCHEMA_NOT_FOUND", `Not found schema: ${namespace}`));
            return errors;
        }
        // Validamos nodo
        errors.push(...this.validateAgainstSchema(node, schema));
        // Validamos children
        if (this.recursiveValidation) {
            for (const childNode of node.getChildren()) {
                errors.push(...this.validate(childNode));
            }
        }
        return errors;
    }
    validateAgainstSchema(node, schema) {
        const errors = [];
        const schemaNode = schema.getNodeDefinition(node.getNormalizedName());
        if (!schemaNode) {
            const error = `NOT EXIST NODE ${node.getNormalizedName()} for namespace ${schema.getNamespace()}`;
            errors.push(new ValidationException(node.getLine(), "NODE_NOT_EXIST_IN_SCHEMA", error));
            return errors;
        }
        errors.push(...SchemaValidator.validateValue(schemaNode, node));
        errors.push(...SchemaValidator.validateCount(schemaNode, node));
        return errors;
    }
    static validateValue(nodeDef, node) {
        const errors = [];
        const nodeType = nodeDef.getType();
        const validator = TypeRegistry.get(nodeType);
        if (!validator) {
            errors.push(new ValidationException(node.getLine(), "TYPE_NOT_SUPPORTED", `Node type not supported: ${nodeType}`));
            return errors;
        }
        try {
            validator.validate(nodeDef, node);
        }
        catch (e) {
            if (e instanceof ValidationException) {
                errors.push(e);
            }
            else if (e instanceof Error) {
                errors.push(new ValidationException(node.getLine(), "VALIDATION_ERROR", e.message));
            }
            else {
                errors.push(new ValidationException(node.getLine(), "UNKNOWN_VALIDATION_ERROR", String(e)));
            }
        }
        return errors;
    }
    static validateCount(nodeDef, node) {
        const errors = [];
        const count = new Map();
        const childrenByType = new Map();
        for (const child of node.getChildren()) {
            const childName = child.getQualifiedName();
            count.set(childName, (count.get(childName) ?? 0) + 1);
            if (!childrenByType.has(childName)) {
                childrenByType.set(childName, []);
            }
            childrenByType.get(childName).push(child);
        }
        for (const childDef of nodeDef.getChildren().values()) {
            const qname = childDef.getQualifiedName();
            errors.push(...SchemaValidator.validateCountChild(childDef, count.get(qname) ?? 0, node, childrenByType.get(qname) ?? []));
        }
        return errors;
    }
    static validateCountChild(childDef, childCount, node, children) {
        const errors = [];
        const min = childDef.getMin(); // number | null
        const max = childDef.getMax(); // number | null
        if (min !== null && childCount < min) {
            errors.push(new ValidationException(node.getLine(), "INVALID_NUMBER", `${childCount} nodes of '${childDef.getQualifiedName()}' and min is ${min}`));
        }
        if (max !== null && childCount > max) {
            // Error en el parent
            errors.push(new ValidationException(node.getLine(), "INVALID_NUMBER", `${childCount} nodes of '${childDef.getQualifiedName()}' and max is ${max}`));
            // Error en cada nodo hijo que excede el máximo permitido
            for (const child of children) {
                errors.push(new ValidationException(child.getLine(), "INVALID_NUMBER", `Too many '${childDef.getQualifiedName()}' nodes: found ${childCount}, max is ${max}`));
            }
        }
        return errors;
    }
}

function transformNodeToSchema(node) {
    // Node name
    const nodeName = node.getNormalizedName();
    const namespaceSchema = node.getNamespace();
    // Obtenemos name y namespace
    if (nodeName !== "schema" || namespaceSchema !== Schema.SCHEMA_NAMESPACE) {
        throw new ValidationException(node.getLine(), "NOT_STXT_SCHEMA", `Se espera schema(${Schema.SCHEMA_NAMESPACE}) y es ${nodeName}(${namespaceSchema})`);
    }
    // Obtenemos description
    const descrip = node.getChild("description")?.getText();
    const schema = new Schema(node.getValue(), node.getLine(), descrip);
    // Para validar
    const allNames = new Set(); // Para validar que existan los childs
    // Obtenemos los nodos
    for (const n of node.getChildrenByName("node")) {
        const schNode = createFrom(n, schema.getNamespace());
        schema.addNodeDefinition(schNode);
        allNames.add(schNode.getNormalizedName());
    }
    // Validamos que todos los nombres estén definidos
    for (const schNode of schema.getNodes().values()) {
        for (const schChild of schNode.getChildren().values()) {
            // Sólo validamos del mismo namespace
            if (schChild.getNamespace() === schema.getNamespace()) {
                // Ojo: en Java aquí se usa schChild.getNormalizedName(), pero ChildDefinition no lo expone.
                // Para mantener el comportamiento, se recomienda añadir getNormalizedName() a ChildDefinition.
                const childNorm = schChild.getNormalizedName?.();
                if (!childNorm) {
                    throw new RuntimeException("CHILD_DEFINITION_API_MISMATCH", "ChildDefinition.getNormalizedName() is missing in TypeScript version. Add it to ChildDefinition.");
                }
                if (!allNames.has(childNorm)) {
                    throw new ValidationException(0, "CHILD_NOT_DEFINED", `Child ${childNorm} not defined in ${schema.getNamespace()}`);
                }
            }
        }
    }
    return schema;
}
function createFrom(n, namespace) {
    const name = n.getValue();
    let type = "INLINE";
    const typeNode = n.getChild("type");
    if (typeNode) {
        type = typeNode.getValue();
    }
    const description = n.getChild("description")?.getText();
    const result = new NodeDefinition(name, type, n.getLine(), description);
    const children = n.getChild("children");
    if (children) {
        for (const child of children.getChildrenByName("child")) {
            putChildToSchemaNode(result, child, namespace);
        }
    }
    // Miramos values
    let valuesNodes = n.getChildrenByName("values");
    if (valuesNodes && valuesNodes.length > 0) {
        if (type !== "ENUM") {
            throw new ValidationException(n.getLine(), "VALUES_ONLY_SUPPORTED_BY_ENUM", `Values only supported for type ENUM, not for type ${type}`);
        }
        if (valuesNodes.length > 1) {
            throw new RuntimeException("INVALID_SIZE_VALUES", `Unexpected number of values: ${valuesNodes.length}`);
        }
        const valuesNode = valuesNodes[0];
        const values = valuesNode.getChildrenByName("value");
        for (const v of values) {
            result.addValue(v.getValue(), v.getLine());
        }
        // Para la comprobación final de ENUM
        valuesNodes = values;
    }
    // Miramos enum
    if (type === "ENUM" && (!valuesNodes || valuesNodes.length === 0)) {
        throw new ValidationException(n.getLine(), "VALUES_EMPTY_FOR_ENUM", "ENUM Type must include values");
    }
    return result;
}
function putChildToSchemaNode(schemaNode, child, defNamespace) {
    // Obtenemos name y namespace
    const ns = NameNamespaceParser.parse(child.getValue(), defNamespace, child.getLine(), child.getValue());
    const name = ns.getName();
    const namespace = ns.getNamespace();
    const schemaChild = new ChildDefinition(name, namespace, getInteger(child, "min"), getInteger(child, "max"), child.getLine());
    schemaNode.addChildDefinition(schemaChild);
}
function getInteger(node, name) {
    const n = node.getChild(name);
    if (!n) {
        return null;
    }
    const raw = n.getValue();
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
        throw new ValidationException(node.getLine(), "INVALID_INTEGER", `Integer not valid: ${raw}`);
    }
    return parsed;
}

class SchemaProviderMeta {
    constructor() {
        const parser = new Parser();
        const nodes = parser.parse(SchemaProviderMeta.META_TEXT);
        if (nodes.length !== 1) {
            throw new ValidationException(0, "META_SCHEMA_INVALID", `Meta schema must produce exactly 1 document, got ${nodes.length}`);
        }
        this.meta = transformNodeToSchema(nodes[0]);
    }
    getSchema(namespace) {
        if (namespace !== Schema.SCHEMA_NAMESPACE) {
            throw new RuntimeException("RESOURCE_NOT_FOUND", `Not found '${namespace}' in namespace: ${Schema.SCHEMA_NAMESPACE}`);
        }
        if (!this.meta) {
            throw new ValidationException(0, "META_SCHEMA_NOT_AVAILABLE", "Meta schema not available");
        }
        return this.meta;
    }
}
SchemaProviderMeta.META_TEXT = `Schema (@stxt.schema): @stxt.schema
    Node: Schema
        Children:
            Child: Description
                Max: 1
            Child: Node
                Min: 1
    Node: Node
        Children:
            Child: Type
                Max: 1
            Child: Children
                Max: 1
            Child: Description
                Max: 1
            Child: Values
                Max: 1
    Node: Children
        Type: GROUP
        Children:
            Child: Child
                Min: 1
    Node: Description
        Type: TEXT
    Node: Child
        Children:
            Child: Min
                Max: 1
            Child: Max
                Max: 1
    Node: Min
        Type: NATURAL
    Node: Max
        Type: NATURAL
    Node: Type
        Type: ENUM
        Values:
            Value: INLINE
            Value: BLOCK
            Value: TEXT
            Value: BOOLEAN
            Value: URL
            Value: INTEGER
            Value: NATURAL
            Value: NUMBER
            Value: DATE
            Value: TIMESTAMP
            Value: EMAIL
            Value: HEXADECIMAL
            Value: BASE64
            Value: GROUP
            Value: ENUM
    Node: Values
        Children:
            Child: Value
                Min: 1
    Node: Value
`;

class SchemaProviderMemory {
    constructor(parent) {
        this.schemas = new Map();
        if (!parent) {
            this.parentSchema = new SchemaProviderMeta();
        }
        else {
            this.parentSchema = parent;
        }
    }
    getSchema(namespace) {
        const key = StringUtils.lowerCase(namespace);
        let result = this.schemas.get(key);
        if (!result) {
            result = this.parentSchema.getSchema(namespace);
        }
        return result;
    }
    addSchema(txt) {
        const parser = new Parser();
        const node = parser.parse(txt)[0];
        const schema = transformNodeToSchema(node);
        const schemaValidator = new SchemaValidator(new SchemaProviderMeta(), true);
        schemaValidator.validate(node);
        const key = schema.getNamespace();
        this.schemas.set(key, schema);
    }
    clear() {
        this.schemas.clear();
    }
    getAllSchemas() {
        return Array.from(this.schemas.values());
    }
}

class ChildLine {
    constructor(type, min, max, values) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.values = values;
    }
    getType() {
        return this.type;
    }
    getMin() {
        return this.min;
    }
    getMax() {
        return this.max;
    }
    getValues() {
        return this.values;
    }
    toString() {
        return `ChildLine [type=${this.type}, min=${this.min}, max=${this.max}, values=${this.values ? `[${this.values.join(", ")}]` : "null"}]`;
    }
}

class ChildLineParser {
    constructor() { }
    static parse(rawLine, lineNumber) {
        if (rawLine.trim().length === 0) {
            return new ChildLine(null, null, null, null);
        }
        const m = ChildLineParser.CHILD_LINE_PATTERN.exec(rawLine);
        if (!m) {
            throw new ValidationException(lineNumber, "INVALID_CHILD_LINE", `Line not valid: ${rawLine}`);
        }
        // m[1]=count, m[2]=type, m[3]=values
        let type = m[2]?.trim() ?? "";
        if (type.length === 0) {
            type = null;
        }
        const count = (m[1] ?? "").trim();
        let min = null;
        let max = null;
        if (count.length === 0 || count === "*") {
            min = null;
            max = null;
        }
        else if (count === "?") {
            min = null;
            max = 1;
        }
        else if (count === "+") {
            min = 1;
            max = null;
        }
        else if (count.endsWith("+")) {
            const expectedNum = parseInt(count.substring(0, count.length - 1), 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = expectedNum;
            max = null;
        }
        else if (count.endsWith("-")) {
            const expectedNum = parseInt(count.substring(0, count.length - 1), 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = null;
            max = expectedNum;
        }
        else if (count.includes(",")) {
            try {
                const [a, b] = count.split(",", 2);
                const aNum = parseInt(a.trim(), 10);
                const bNum = parseInt(b.trim(), 10);
                if (Number.isNaN(aNum) || Number.isNaN(bNum)) {
                    throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
                }
                min = aNum;
                max = bNum;
            }
            catch {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
        }
        else {
            const expectedNum = parseInt(count, 10);
            if (Number.isNaN(expectedNum)) {
                throw new ValidationException(lineNumber, "INVALID_CHILD_COUNT", `Invalid count ${count} in line: ${rawLine}`);
            }
            min = expectedNum;
            max = expectedNum;
        }
        // values
        let values = null;
        const valuesStr = m[3];
        if (valuesStr !== null && valuesStr !== undefined) {
            const parts = valuesStr.split(",");
            const list = [];
            for (let part of parts) {
                part = part.trim();
                if (part.length === 0) {
                    continue;
                }
                if (list.includes(part)) {
                    throw new ValidationException(lineNumber, "VALUE_DUPLICATED", `The values ${part} is duplicated`);
                }
                list.push(part);
            }
            if (list.length > 0) {
                values = list;
            }
        }
        // type es string|null en nuestra clase
        return new ChildLine(type ?? null, min, max, values);
    }
}
ChildLineParser.CHILD_LINE_PATTERN = /^\s*(?:\(\s*([^()\s][^)]*?)\s*\)\s*)?([^()[\]]*)?(?:\[\s*([^]*?)\s*\]\s*)?\s*$/;

function transformTemplateNodeToSchema(node) {
    // Insertamos namespace
    const result = new Schema(node.getValue(), node.getLine(), undefined);
    // Buscamos nodo structure
    const structure = node.getChild("structure");
    if (!structure) {
        throw new ValidationException(node.getLine(), "TEMPLATE_STRUCTURE_REQUIRED", "Template must define 'Structure >>'");
    }
    const text = structure.getText();
    const offset = structure.getLine();
    // Creamos un parser simple
    const parser = new Parser();
    // Parseamos para los nodos
    try {
        const nodes = parser.parse(text);
        // Vamos iterando todos los nodos insertando
        for (const n of nodes) {
            addToSchema(result, n);
        }
    }
    catch (e) {
        if (e instanceof ParseException) {
            throw new ParseException(e.line + offset, e.code, e.message);
        }
        throw e;
    }
    // Buscamos descripciones
    const description = node.getChild("description");
    if (description) {
        const text = description.getText();
        try {
            const nodes = parser.parse(text);
            addDescriptions(result, nodes);
        }
        catch (e) {
            if (e instanceof ValidationException) {
                throw new ValidationException(e.line + description.getLine(), e.code, e.message);
            }
            if (e instanceof ParseException) {
                throw new ParseException(e.line + description.getLine(), e.code, e.message);
            }
            throw e;
        }
    }
    // Retornamos resultado
    return result;
}
function addToSchema(schema, node) {
    // Obtenemos nombre qualificado
    let namespace = node.getNamespace();
    const name = node.getName();
    // Miramos datos
    let cl = ChildLineParser.parse(node.getValue(), node.getLine());
    if (!namespace || namespace === "") {
        namespace = schema.getNamespace();
    }
    if (namespace !== schema.getNamespace()) {
        // Validamos type vacío
        const type = cl.getType();
        if (type != null && type.trim().length > 0) {
            throw new ValidationException(node.getLine(), "TYPE_DEFINITION_NOT_ALLOWED", "Not allowed type definition in external namespaces");
        }
        // No hacemos nada con creación de nodos que no son de @stxt.template!!
        return;
    }
    // Miramos si es nuevo y añadimos en listado
    let schemaNode = schema.getNodeDefinition(name);
    if (!schemaNode) {
        // Nuevo
        const type = cl.getType() == null ? "INLINE" : cl.getType();
        schemaNode = new NodeDefinition(node.getName(), type, node.getLine(), undefined);
        schema.addNodeDefinition(schemaNode);
        if (!TypeRegistry.get(type)) {
            throw new ValidationException(node.getLine(), "TYPE_NOT_VALID", `Type not valid: ${type}`);
        }
        const values = cl.getValues();
        if (values) {
            if (type !== "ENUM") {
                throw new ValidationException(node.getLine(), "VALUES_NOT_IN_ENUM", `Values only allowed with type ENUM`);
            }
            for (const v of values) {
                schemaNode.addValue(v, node.getLine());
            }
        }
    }
    else {
        let type = cl.getType();
        if (!type || !type.startsWith("@")) {
            throw new ValidationException(node.getLine(), "NODE_DEFINED_MULTIPLE_TIMES", `Multiple node reference must start with @: ${node.getName()}`);
        }
        type = type.substring(1);
        type = StringUtils.normalize(type);
        if (type === node.getNormalizedName()) {
            return; // OK Definition
        }
        throw new ValidationException(node.getLine(), "NODE_REFERENCE_NOT_VALID", `Reference must be '@${node.getName()}', not '${type}'`);
    }
    // Una vez ya existe, si tiene hijos los intentamos crear.
    const childrenNode = node.getChildren();
    // Insertamos childs
    for (const child of childrenNode) {
        cl = ChildLineParser.parse(child.getValue(), child.getLine());
        const childName = child.getName();
        let childNamespace = child.getNamespace();
        if (!childNamespace || childNamespace === "") {
            childNamespace = schema.getNamespace();
        }
        const schChild = new ChildDefinition(childName, childNamespace, cl.getMin(), cl.getMax(), child.getLine());
        schemaNode.addChildDefinition(schChild);
        addToSchema(schema, child);
    }
}
function addDescriptions(schema, nodes) {
    nodes.forEach((node) => {
        // Obtenemos namespace
        let namespace = node.getNamespace();
        if (!namespace || namespace === "") {
            namespace = schema.getNamespace();
        }
        // Validamos no external description
        if (namespace !== schema.getNamespace()) {
            throw new ValidationException(node.getLine(), "EXTERNAL_DESCRIPTION_NOT_ALLOWED", "Not allowed description in external namespaces");
        }
        // Validamos sin hijos
        if (node.getChildren().length > 0) {
            throw new ValidationException(node.getLine(), "CHILDREN_DESCRIPTION_NOT_ALLOWED", "Not allowed children in description");
        }
        // Buscamos nodo de esquema
        const nodeDef = schema.getNodeDefinition(node.getName());
        if (!nodeDef) {
            throw new ValidationException(node.getLine(), "NODE_NOT_FOUND", `Not found node with name: ${node.getName()}`);
        }
        nodeDef.setDescription(node.getText());
    });
}

class MetaTemplateSchemaProvider {
    constructor() {
        const parser = new Parser();
        const nodes = parser.parse(MetaTemplateSchemaProvider.META_TEXT);
        if (nodes.length !== 1) {
            throw new ValidationException(0, "META_SCHEMA_INVALID", `Meta schema must produce exactly 1 document, got ${nodes.length}`);
        }
        this.meta = transformTemplateNodeToSchema(nodes[0]);
    }
    getSchema(namespace) {
        if (namespace !== "@stxt.template") {
            throw new RuntimeException("RESOURCE_NOT_FOUND", `Not found '${namespace}' in namespace: @stxt.template`);
        }
        // meta siempre existe si el constructor terminó, pero lo dejamos equivalente al Java
        if (!this.meta) {
            throw new ValidationException(0, "META_SCHEMA_NOT_AVAILABLE", "Meta schema not available");
        }
        return this.meta;
    }
}
MetaTemplateSchemaProvider.META_TEXT = `Template (@stxt.template): @stxt.template
\tStructure >>
\t\tTemplate (@stxt.template):
\t\t\tDescription: (?) TEXT
\t\t\tStructure: (1) BLOCK
`;

// TemplateSchemaProvider.ts
class TemplateSchemaProviderMemory extends SchemaProviderMemory {
    constructor(parent) {
        if (!parent) {
            parent = new MetaTemplateSchemaProvider();
        }
        super(parent);
    }
    addTemplate(template) {
        const parser = new Parser();
        const nodes = parser.parse(template);
        if (nodes.length !== 1) {
            throw new ValidationException(0, "INVALID_SCHEMA", `There are ${nodes.length}, and expected is 1`);
        }
        // Validamos el template contra el meta-schema de templates
        const schemaValidator = new SchemaValidator(new MetaTemplateSchemaProvider(), true);
        schemaValidator.validate(nodes[0]);
        // Generamos schema desde el template
        const sch = transformTemplateNodeToSchema(nodes[0]);
        // Check mínimo de seguridad (en Java también se controlaba el namespace esperado)
        if (!sch.getNamespace() || sch.getNamespace().trim().length === 0) {
            throw new ValidationException(0, "INVALID_SCHEMA", "Schema namespace is empty");
        }
        this.schemas.set(sch.getNamespace(), sch);
    }
}

// Wrapper del validador que solo valida nodos con namespace
class ConditionalValidator {
    constructor(schemaValidator) {
        this.schemaValidator = schemaValidator;
    }
    validate(node) {
        // Solo validar si tiene namespace
        if (node.getNamespace() !== "") {
            return this.schemaValidator.validate(node);
        }
        return [];
    }
}

var IndentStyle;
(function (IndentStyle) {
    IndentStyle["TABS"] = "TABS";
    IndentStyle["SPACES_4"] = "SPACES_4";
})(IndentStyle || (IndentStyle = {}));
class NodeWriter {
    constructor() { }
    static toSTXT(node, style = IndentStyle.TABS) {
        const out = [];
        NodeWriter.writeNode(out, node, 0, style, "");
        return out.join("");
    }
    static toSTXTDocs(docs, style = IndentStyle.TABS) {
        const out = [];
        for (let i = 0; i < docs.length; i++) {
            if (i > 0) {
                out.push("\n");
            }
            NodeWriter.writeNode(out, docs[i], 0, style, "");
        }
        return out.join("");
    }
    static writeNode(out, n, depth, style, parentNs) {
        NodeWriter.indent(out, depth, style);
        const ns = n.getNamespace();
        out.push(n.getName());
        if (ns.length > 0 && ns !== parentNs) {
            out.push(" (", ns, ")");
        }
        if (n.isTextNode()) {
            out.push(" >>\n");
            for (const line of n.getTextLines()) {
                NodeWriter.indent(out, depth + 1, style);
                out.push(line, "\n");
            }
        }
        else {
            out.push(":");
            const value = n.getValue();
            if (value.length > 0) {
                out.push(" ", value);
            }
            out.push("\n");
        }
        for (const child of n.getChildren()) {
            NodeWriter.writeNode(out, child, depth + 1, style, ns);
        }
    }
    static indent(out, depth, style) {
        if (depth > 0) {
            out.push(style === IndentStyle.SPACES_4 ? "    ".repeat(depth) : "\t".repeat(depth));
        }
    }
}

/**
 * Provider unificado que maneja tanto schemas como templates.
 * Detecta automáticamente el tipo según el namespace del nodo raíz:
 * - @stxt.template => procesa como template
 * - @stxt.schema => procesa como schema
 * - otros => no hace nada
 */
class UnifiedSchemaProvider {
    constructor() {
        this.schemas = new Map();
        this.schemaMeta = new SchemaProviderMeta();
        this.templateMeta = new MetaTemplateSchemaProvider();
    }
    getSchema(namespace) {
        const key = StringUtils.lowerCase(namespace);
        if (namespace === "@stxt.template") {
            return this.templateMeta.getSchema(key);
        }
        else if (namespace === "@stxt.schema") {
            return this.schemaMeta.getSchema(key);
        }
        let result = this.schemas.get(key);
        return result;
    }
    addFile(text) {
        const parser = new Parser();
        const nodes = parser.parse(text);
        for (const node of nodes) {
            const namespace = node.getNamespace();
            if (namespace === "@stxt.template") {
                this.addTemplateNode(node);
            }
            else if (namespace === "@stxt.schema") {
                this.addSchemaNode(node);
            }
        }
    }
    addTemplateNode(node) {
        // Validar contra el meta-schema de templates
        const schemaValidator = new SchemaValidator(this.templateMeta, true);
        schemaValidator.validate(node);
        // Transformar el template a schema
        const schema = transformTemplateNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());
        this.schemas.set(key, schema);
    }
    addSchemaNode(node) {
        // Validar contra el meta-schema de schemas
        const schemaValidator = new SchemaValidator(this.schemaMeta, true);
        schemaValidator.validate(node);
        // Transformar el nodo a schema
        const schema = transformNodeToSchema(node);
        const key = StringUtils.lowerCase(schema.getNamespace());
        this.schemas.set(key, schema);
    }
    clear() {
        this.schemas.clear();
    }
    getAllSchemas() {
        return Array.from(this.schemas.values());
    }
}

export { BASE64, BLOCK, BOOLEAN, ChildDefinition, ChildLine, ChildLineParser, ConditionalValidator, Constants, DATE, EMAIL, ENUM, GROUP, HEXADECIMAL, INLINE, INTEGER, IndentStyle, Line, MetaTemplateSchemaProvider, NATURAL, NUMBER, NameNamespace, NameNamespaceParser, NamespaceValidator, Node, NodeDefinition, NodeWriter, ParseException, ParseResult, Parser, RuntimeException, Schema, SchemaProviderMemory, SchemaProviderMeta, SchemaValidator, StringUtils, TEXT, TIMESTAMP, TemplateSchemaProviderMemory, TypeRegistry, URL, UnifiedSchemaProvider, ValidationException, createNode, parseLine, regexType, transformNodeToSchema, transformTemplateNodeToSchema };
//# sourceMappingURL=stxt-parser.js.map
