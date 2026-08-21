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
import { TIME } from "./type/TIME";
import { TIMESTAMP } from "./type/TIMESTAMP";
import { UUID } from "./type/UUID";
import { BINARY } from "./type/BINARY";
import { EMAIL } from "./type/EMAIL";
import { HEXADECIMAL } from "./type/HEXADECIMAL";
import { BASE64 } from "./type/BASE64";
import { GROUP } from "./type/GROUP";
import { ENUM } from "./type/ENUM";
import { MARKDOWN } from "./type/MARKDOWN";

/** Static registry of the STXT value types, indexed by name. Adding a new type: a new {@link Type} + `register(...)` here. */
export class TypeRegistry {
    private static readonly REGISTRY: Map<string, Type> = new Map();

    // Static initialization (no INSTANCE)
    private static readonly _init = (() => {
        // Main types
        TypeRegistry.register(INLINE);
        TypeRegistry.register(BLOCK);

        // Subtypes
        TypeRegistry.register(TEXT);
        TypeRegistry.register(BOOLEAN);
        TypeRegistry.register(URL);
        TypeRegistry.register(INTEGER);
        TypeRegistry.register(NATURAL);
        TypeRegistry.register(NUMBER);
        TypeRegistry.register(DATE);
        TypeRegistry.register(TIME);
        TypeRegistry.register(TIMESTAMP);
        TypeRegistry.register(UUID);
        TypeRegistry.register(EMAIL);
        TypeRegistry.register(HEXADECIMAL);
        TypeRegistry.register(BINARY);
        TypeRegistry.register(BASE64);
        TypeRegistry.register(GROUP);
        TypeRegistry.register(ENUM);
        TypeRegistry.register(MARKDOWN);

        return true;
    })();

    // STXT-SCHEMA-SPEC 9 / STXT-TEMPLATE-SPEC 15: only INLINE and GROUP admit children
    /**
     * Tells whether nodes of a type may have children.
     *
     * @param nodeType name of the type.
     * @returns true if nodes of this type may have children (only INLINE and GROUP).
     */
    static admitsChildren(nodeType: string): boolean {
        return nodeType === "INLINE" || nodeType === "GROUP";
    }

    /**
     * Looks up a registered type by name.
     *
     * @param nodeType name of the type to look for.
     * @returns the {@link Type} registered under that name, or undefined if it does not exist.
     */
    static get(nodeType: string): Type | undefined {
        // force _init to run when the class is loaded (in case a bundler does something odd)
        void this._init;
        return this.REGISTRY.get(nodeType);
    }

    private static register(instance: Type): void {
        const name = instance.getName();

        if (this.REGISTRY.has(name)) {
            throw new RuntimeException("TYPE_DUPLICATED", `Type already defined: ${name}`);
        }

        this.REGISTRY.set(name, instance);
    }
}
