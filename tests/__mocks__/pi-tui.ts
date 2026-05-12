export class Text {
	text: string;
	constructor(text: string, _width: number, _height: number) {
		this.text = text;
	}
	toString() {
		return this.text;
	}
	setText(text: string) {
		this.text = text;
	}
	invalidate() {}
	render(_width: number): string[] {
		return this.text.split("\n");
	}
}

export class TruncatedText {
	text: string;
	constructor(text: string, _paddingX: number = 0, _paddingY: number = 0) {
		this.text = text;
	}
	toString() {
		return this.text;
	}
}

export class Container {
	children: any[] = [];
	addChild(child: any) {
		this.children.push(child);
	}
	clear() {
		this.children = [];
	}
	invalidate() {}
	render(_width: number): string[] {
		return [];
	}
}

export class Markdown {
	text: string;
	constructor(text: string, _width: number, _height: number, _theme?: any) {
		this.text = text;
	}
	setText(text: string) {
		this.text = text;
	}
	render(_width: number): string[] {
		return this.text.split("\n");
	}
	invalidate() {}
}

export class Spacer {
	constructor(_height: number) {}
	invalidate() {}
	render(_width: number): string[] {
		return [];
	}
}

export class Editor {
	disableSubmit = false;
	onSubmit?: (text: string) => void;
	constructor(_tui: any, _theme: any) {}
	handleInput(_data: string) {}
	invalidate() {}
	render(_width: number): string[] {
		return [];
	}
}

export namespace Key {
	export function ctrl(key: string): string {
		return `ctrl+${key}`;
	}
	export function shift(key: string): string {
		return `shift+${key}`;
	}
	export function alt(key: string): string {
		return `alt+${key}`;
	}
	export function super_(key: string): string {
		return `super+${key}`;
	}
	export const space = "space";
	export const escape = "escape";
	export const backspace = "backspace";
	export const tab = "tab";
}

export function matchesKey(data: string, key: string): boolean {
	// Handle escape key: raw \x1b matches "escape"
	if (key === "escape" && data === "\x1b") return true;
	// Handle enter keys
	if (key === "\n" && (data === "\n" || data === "\r")) return true;
	if (key === "\r" && (data === "\n" || data === "\r")) return true;
	// Handle arrow keys (CSI sequences)
	if (key === "up" && data === "\x1b[A") return true;
	if (key === "down" && data === "\x1b[B") return true;
	if (key === "right" && data === "\x1b[C") return true;
	if (key === "left" && data === "\x1b[D") return true;
	// Handle literal key names (e.g. "ctrl+alt+o")
	if (data === key) return true;
	// Handle space key
	if (key === "space" && data === " ") return true;
	// Handle backspace
	if (key === "backspace" && data === "\x7f") return true;
	return false;
}

export function fuzzyFilter<T>(items: T[], _query: string, _accessor: (item: T) => string): T[] {
	return items;
}

export function decodeKittyPrintable(_data: string): string | undefined {
	return undefined;
}

export function truncateToWidth(text: string, _width: number, _ellipsis?: string, _padRight?: boolean): string {
	return text;
}

export function wrapTextWithAnsi(text: string, _width: number): string[] {
	return text.split("\n");
}
