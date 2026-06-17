export class ChildLine {
    private readonly min: number | null;
    private readonly max: number | null;
    private readonly values: string[] | null;
    private readonly type: string | null;

    constructor(type: string | null, min: number | null, max: number | null, values: string[] | null) {
        this.type = type;
        this.min = min;
        this.max = max;
        this.values = values;
    }

    getType(): string | null 
    { 
        return this.type; 
    }

    getMin(): number | null {
        return this.min;
    }

    getMax(): number | null {
        return this.max;
    }

    getValues(): string[] | null {
        return this.values;
    }

    toString(): string {
        return `ChildLine [type=${this.type}, min=${this.min}, max=${this.max}, values=${this.values ? `[${this.values.join(", ")}]` : "null"
            }]`;
    }
}