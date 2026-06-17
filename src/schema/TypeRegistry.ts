import { Type } from "./Type";
import { RuntimeException } from "../exceptions/RuntimeException";

import { INLINE } from "./type/INLINE";
import { BLOCK } from "./type/BLOCK";
import { TEXT } from "./type/TEXT";
import { BOOLEAN } from "./type/BOOLEAN";
import { URL } from "./type/URL";
import { INTEGER } from "./type/INTEGER";
import { NATURAL } from "./type/NATURAL";
import { NUMBER } from "./type/NUMBER";
import { DATE } from "./type/DATE";
import { TIMESTAMP } from "./type/TIMESTAMP";
import { EMAIL } from "./type/EMAIL";
import { HEXADECIMAL } from "./type/HEXADECIMAL";
import { BASE64 } from "./type/BASE64";
import { GROUP } from "./type/GROUP";
import { ENUM } from "./type/ENUM";

export class TypeRegistry {
    private static readonly REGISTRY: Map<string, Type> = new Map();

    // Inicialización estática (sin INSTANCE)
    private static readonly _init = (() => {
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

    static get(nodeType: string): Type | undefined {
        // fuerza que se ejecute _init al cargar la clase (por si el bundler hiciera cosas raras)
        void this._init;
        return this.REGISTRY.get(nodeType);
    }

    private static register(instance: Type): void {
        const name = instance.getName();

        if (this.REGISTRY.has(name)) {
            throw new RuntimeException("DUPLICATED_TYPE", `Type already defined: ${name}`);
        }

        this.REGISTRY.set(name, instance);
    }
}
