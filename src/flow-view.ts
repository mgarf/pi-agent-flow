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
    if (matchesKey(data, "\n") || matchesKey(data, "\r")) {
      this.done(this.flows[this.selectedIndex]?.key ?? null);
      return;
    }
  }

  private buildContent(): void {
    this.container.clear();
    const width = process.stdout.columns ?? 80;

    // Title
    this.container.addChild(
      new Text(this.theme.fg("accent", "  Select a flow to watch"), 0, 0),
    );
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
    this.container.addChild(
      new Text(this.theme.fg("dim", "  \u2191\u2193 navigate \u00b7 Enter select \u00b7 Esc dismiss"), 0, 0),
    );
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    this.buildContent();
    return this.container.render(width);
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
    const width = process.stdout.columns ?? 80;

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
    for (const entry of this.entry.transcript) {
      if (entry.kind === "thinking") {
        const wrapped = wrapTextWithAnsi(entry.text, width - 4);
        lines.push(...wrapped.map((l) => `  ${this.theme.fg("dim", l)}`));
      } else {
        const wrapped = wrapTextWithAnsi(entry.text, width - 4);
        lines.push(...wrapped.map((l) => `  ${l}`));
      }
    }

    // Append incomplete streaming thinking
    if (this.entry.streamingThinking) {
      const wrapped = wrapTextWithAnsi(this.entry.streamingThinking, width - 4);
      lines.push(...wrapped.map((l) => `  ${this.theme.fg("dim", l)}`));
    }

    // Append incomplete streaming output
    if (this.entry.streamingOutput) {
      const wrapped = wrapTextWithAnsi(this.entry.streamingOutput, width - 4);
      lines.push(...wrapped.map((l) => `  ${l}`));
    }

    // Auto-scroll: show last N lines that fit the terminal
    const maxRows = Math.max(1, this.tui.terminal.rows - 6); // header + footer, clamped to avoid negative
    const visible = lines.slice(-maxRows);
    if (lines.length > maxRows) {
      visible.unshift(this.theme.fg("dim", `  ... ${lines.length - maxRows} lines above ...`));
    }

    for (const line of visible) {
      this.container.addChild(new Text(line, 0, 0));
    }

    // Error message
    if (this.entry.errorMessage) {
      this.container.addChild(new Spacer(1));
      this.container.addChild(new Text(this.theme.fg("error", `  Error: ${this.entry.errorMessage}`), 0, 0));
    }

    this.container.addChild(new Spacer(1));
    this.container.addChild(
      new Text(this.theme.fg("dim", "  Esc dismiss \u00b7 Ctrl+Alt+O re-pick"), 0, 0),
    );
  }

  invalidate(): void {
    this.container.invalidate();
  }

  render(width: number): string[] {
    this.buildContent();
    return this.container.render(width);
  }
}
