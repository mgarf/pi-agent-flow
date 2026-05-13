/**
 * Flow View — TUI overlay components for watching live flow output.
 *
 * Two components:
 * 1. FlowPicker — select which flow to watch
 * 2. FlowFocusedView — show interleaved thinking/output transcript
 */

import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  Container,
  type Component,
  Key,
  type KeybindingsManager,
  matchesKey,
  Spacer,
  Text,
  type TUI,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@mariozechner/pi-tui";

// ---------------------------------------------------------------------------
// Transcript entry
// ---------------------------------------------------------------------------

export interface TranscriptEntry {
  /** "thinking" or "output" */
  kind: "thinking" | "output";
  /** The text content of this entry. */
  text: string;
}

/** Per-flow output data tracked in the shared Map. */
export interface FlowOutputEntry {
  /** Flow type name (scout, build, etc.) */
  type: string;
  /** Short headline for display. */
  aim: string;
  /** Whether this flow is still running. */
  running: boolean;
  /** Interleaved transcript entries. */
  transcript: TranscriptEntry[];
  /** Current streaming thinking text (incomplete). */
  streamingThinking: string;
  /** Current streaming output text (incomplete). */
  streamingOutput: string;
  /** Error message if flow failed. */
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Box border rendering (mirrors ask-user.ts)
// ---------------------------------------------------------------------------

const BOX_BORDER_LEFT = "\u2502 ";
const BOX_BORDER_RIGHT = " \u2502";
const BOX_BORDER_OVERHEAD = BOX_BORDER_LEFT.length + BOX_BORDER_RIGHT.length;

class BoxBorderTop implements Component {
  private color: (s: string) => string;
  private title?: string;
  private titleColor?: (s: string) => string;

  constructor(color: (s: string) => string, title?: string, titleColor?: (s: string) => string) {
    this.color = color;
    this.title = title;
    this.titleColor = titleColor;
  }

  invalidate(): void { /* no-op */ }

  render(width: number): string[] {
    const inner = Math.max(0, width - 2);
    if (!this.title || inner < this.title.length + 4) {
      return [this.color("\u256d" + "\u2500".repeat(inner) + "\u256e")];
    }
    const label = " " + this.title + " ";
    const remaining = inner - 1 - label.length;
    const titleStyle = this.titleColor ?? this.color;
    return [
      this.color("\u256d\u2500") + titleStyle(label) + this.color("\u2500".repeat(Math.max(0, remaining)) + "\u256e"),
    ];
  }
}

class BoxBorderBottom implements Component {
  private color: (s: string) => string;
  private label?: string;
  private labelColor?: (s: string) => string;

  constructor(color: (s: string) => string, label?: string, labelColor?: (s: string) => string) {
    this.color = color;
    this.label = label;
    this.labelColor = labelColor;
  }

  invalidate(): void { /* no-op */ }

  render(width: number): string[] {
    const inner = Math.max(0, width - 2);
    if (!this.label || inner < this.label.length + 4) {
      return [this.color("\u2570" + "\u2500".repeat(inner) + "\u256f")];
    }
    const tag = " " + this.label + " ";
    const leftDashes = inner - tag.length - 1;
    const style = this.labelColor ?? this.color;
    return [
      this.color("\u2570" + "\u2500".repeat(Math.max(0, leftDashes))) + style(tag) + this.color("\u2500\u256f"),
    ];
  }
}

// ---------------------------------------------------------------------------
// FlowPicker — select a flow to watch
// ---------------------------------------------------------------------------

export class FlowPicker implements Component {
  private container = new Container();
  private selectedIndex = 0;
  private flows: Array<{ key: string; type: string; aim: string; running: boolean }>;
  private tui: TUI;
  private theme: Theme;
  private keybindings: KeybindingsManager;
  private done: (key: string | null) => void;

  constructor(
    flows: Array<{ key: string; type: string; aim: string; running: boolean }>,
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    done: (key: string | null) => void,
  ) {
    this.flows = flows;
    this.tui = tui;
    this.theme = theme;
    this.keybindings = keybindings;
    this.done = done;
    this.buildContent();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.done(null);
      return;
    }
    if (this.keybindings.matches(data, "tui.select.up") || matchesKey(data, "k")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.buildContent();
      this.container.invalidate();
      return;
    }
    if (this.keybindings.matches(data, "tui.select.down") || matchesKey(data, "j")) {
      this.selectedIndex = Math.min(this.flows.length - 1, this.selectedIndex + 1);
      this.buildContent();
      this.container.invalidate();
      return;
    }
    if (this.keybindings.matches(data, "tui.select.confirm")) {
      this.done(this.flows[this.selectedIndex]?.key ?? null);
      return;
    }
  }

  private buildContent(): void {
    this.container.clear();
    const width = process.stdout.columns ?? 80;

    const borderColor = (s: string) => this.theme.fg("accent", s);
    const titleColor = (s: string) => this.theme.fg("dim", this.theme.bold(s));

    // Top border
    this.container.addChild(new BoxBorderTop(borderColor, "flow_picker", titleColor));
    this.container.addChild(new Spacer(1));

    for (let i = 0; i < this.flows.length; i++) {
      const flow = this.flows[i]!;
      const pointer = i === this.selectedIndex ? "\u25b6" : " ";
      const status = flow.running
        ? this.theme.fg("warning", "[running]")
        : this.theme.fg("dim", "[done]");
      const aim = truncateToWidth(flow.aim, width - 30);
      const line = `${pointer} ${this.theme.fg("accent", flow.type)} ${status}  ${aim}`;
      this.container.addChild(new Text(line, 0, 0));
    }

    this.container.addChild(new Spacer(1));
    // Bottom border
    this.container.addChild(
      new BoxBorderBottom(borderColor, "Esc dismiss", (s: string) => this.theme.fg("dim", s)),
    );
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    this.buildContent();

    const innerWidth = Math.max(1, width - BOX_BORDER_OVERHEAD);
    const rawLines = this.container.render(innerWidth);

    const borderColor = (s: string) => this.theme.fg("accent", s);
    const titleColor = (s: string) => this.theme.fg("dim", this.theme.bold(s));

    return rawLines.map((line, index) => {
      if (index === 0) {
        return new BoxBorderTop(borderColor, "flow_picker", titleColor).render(width)[0];
      }
      if (index === rawLines.length - 1) {
        return new BoxBorderBottom(borderColor, "Esc dismiss", (s: string) => this.theme.fg("dim", s)).render(width)[0];
      }
      const padded = truncateToWidth(line, innerWidth, "", true);
      return `${borderColor(BOX_BORDER_LEFT)}${padded}${borderColor(BOX_BORDER_RIGHT)}`;
    });
  }
}

// ---------------------------------------------------------------------------
// FlowFocusedView — show one flow's interleaved transcript
// ---------------------------------------------------------------------------

export class FlowFocusedView implements Component {
  private container = new Container();
  private flowKey: string;
  private entry: FlowOutputEntry;
  private tui: TUI;
  private theme: Theme;
  private keybindings: KeybindingsManager;
  private dismiss: () => void;
  private onRePick: (() => void) | undefined;
  private lastRenderWidth = 0;

  constructor(
    flowKey: string,
    entry: FlowOutputEntry,
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    dismiss: () => void,
    onRePick?: () => void,
  ) {
    this.flowKey = flowKey;
    this.entry = entry;
    this.tui = tui;
    this.theme = theme;
    this.keybindings = keybindings;
    this.dismiss = dismiss;
    this.onRePick = onRePick;
    this.buildContent();
  }

  /** Update the transcript data and re-render. Called on every streaming delta. */
  update(entry: FlowOutputEntry): void {
    this.entry = entry;
    this.buildContent();
    this.container.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.dismiss();
      return;
    }
    // Ctrl+Alt+O to re-pick a different flow
    if (this.onRePick && matchesKey(data, "ctrl+alt+o")) {
      this.onRePick();
      return;
    }
  }

  private buildContent(): void {
    this.container.clear();
    const width = this.lastRenderWidth || (process.stdout.columns ?? 80);

    const borderColor = (s: string) => this.theme.fg("accent", s);
    const titleColor = (s: string) => this.theme.fg("dim", this.theme.bold(s));

    // Header
    const statusLabel = this.entry.running
      ? this.theme.fg("warning", "\u25cf running")
      : this.theme.fg("success", "\u2713 done");
    const header = `${this.theme.fg("accent", this.entry.type)}  ${statusLabel}`;
    this.container.addChild(new Text(header, 0, 0));
    if (this.entry.aim) {
      this.container.addChild(new Text(this.theme.fg("dim", `  ${this.entry.aim}`), 0, 0));
    }
    this.container.addChild(new Spacer(1));

    // Build full transcript (completed entries + streaming)
    const lines: string[] = [];
    const separator = this.theme.fg("dim", "─".repeat(width - 4));

    // Group thinking and output into sections for cleaner rendering
    let lastKind: "thinking" | "output" | null = null;

    const pushEntry = (kind: "thinking" | "output", text: string) => {
      if (!text) return;
      const colorFn = kind === "thinking" ? (s: string) => this.theme.fg("dim", s) : (s: string) => s;
      const label = kind === "thinking" ? "[thinking]" : "[output]";
      // Add section header when switching kinds
      if (lastKind !== kind) {
        if (lines.length > 0) {
          lines.push(separator);
        }
        lines.push(this.theme.fg("dim", `  ${label}`));
      }
      const wrapped = wrapTextWithAnsi(text, width - 4);
      lines.push(...wrapped.map((l) => `  ${colorFn(l)}`));
      lastKind = kind;
    };

    for (const entry of this.entry.transcript) {
      pushEntry(entry.kind, entry.text);
    }

    // Auto-scroll: show last N lines that fit the overlay
    const overlayHeight = Math.floor(this.tui.terminal.rows * 0.85);
    const overhead = 5; // header + gap + possible error + trailing gap
    const maxRows = Math.max(1, overlayHeight - overhead);
    const visible = lines.slice(-maxRows);
    if (lines.length > maxRows) {
      visible.unshift(this.theme.fg("dim", `  ... ${lines.length - maxRows} lines above ...`));
    }

    for (const line of visible) {
      this.container.addChild(new Text(line, 0, 0));
    }

    // Error message
    if (this.entry.errorMessage) {
      this.container.addChild(new Text("", 0, 0));
      this.container.addChild(new Text(this.theme.fg("error", `  Error: ${this.entry.errorMessage}`), 0, 0));
    }
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - BOX_BORDER_OVERHEAD);
    this.lastRenderWidth = innerWidth;

    const rawLines = this.container.render(innerWidth);

    const borderColor = (s: string) => this.theme.fg("accent", s);
    const titleColor = (s: string) => this.theme.fg("dim", this.theme.bold(s));

    const topBorder = new BoxBorderTop(borderColor, this.entry.type, titleColor).render(width);
    const bottomBorder = new BoxBorderBottom(
      borderColor,
      "Esc dismiss \u00b7 Ctrl+Alt+O re-pick",
      (s: string) => this.theme.fg("dim", s),
    ).render(width);

    const contentLines = rawLines.map((line) => {
      const padded = truncateToWidth(line, innerWidth, "", true);
      return `${borderColor(BOX_BORDER_LEFT)}${padded}${borderColor(BOX_BORDER_RIGHT)}`;
    });

    return [...topBorder, ...contentLines, ...bottomBorder];
  }
}
