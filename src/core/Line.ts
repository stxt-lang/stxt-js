export class Line {
	// Igual que en Java: campos públicos e inmutables
	public readonly level: number;
	public readonly content: string;
	public readonly isComment: boolean;
	public readonly isBlock: boolean;
	public readonly indentLength: number;

	constructor(level: number, content: string, isComment: boolean, isBlock: boolean, indentLength: number) {
		this.level = level;
		this.content = content;
		this.isComment = isComment;
		this.isBlock = isBlock;
		this.indentLength = indentLength;

	}
	isEmpty(): boolean {
		return this.content.trim() === "";
	}
}

