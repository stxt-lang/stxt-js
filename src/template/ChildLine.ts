/** A child definition line inside an `@stxt.template`: type, cardinality and allowed values. */
export class ChildLine {
    private readonly min: number | null;
    private readonly max: number | null;
    private readonly values: string[] | null;
    private readonly type: string | null;

    /**
     * Creates the already parsed content of a definition line.
     *
     * @param type declared type, or null if the line declares none.
     * @param min minimum cardinality, or null if there is no minimum.
     * @param max maximum cardinality, or null if there is no maximum.
     * @param values values declared between brackets, or null if the line has no brackets at all.
     */
    constructor(type: string | null, min: number | null, max: number | null, values: string[] | null) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.values = values;
    }

    /** @returns the declared type, or null if the line declares none. */
    getType(): string | null
    {
        return this.type;
    }

    /** @returns the minimum cardinality, or null if there is no minimum. */
    getMin(): number | null {
        return this.min;
    }

    /** @returns the maximum cardinality, or null if there is no maximum. */
    getMax(): number | null {
        return this.max;
    }

    /** @returns the values declared between brackets, or null if the line has no brackets at all. */
    getValues(): string[] | null {
        return this.values;
    }

    /** @returns a readable representation of the line, for debugging. */
    toString(): string {
        return `ChildLine [type=${this.type}, min=${this.min}, max=${this.max}, values=${this.values ? `[${this.values.join(", ")}]` : "null"
            }]`;
    }
}
