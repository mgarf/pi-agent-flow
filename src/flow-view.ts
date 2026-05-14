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
  Markdown,
} from "@mariozechner/pi-tui";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { italic, tailText } from "./render-utils.js";

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
  /** Structured output parsed from the flow's final response. */
  structuredOutput?: import("./types.js").FlowStructuredOutput;
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

/** Strip ```json ... ``` code blocks from text. */
function stripJsonBlock(text: string): string {
  return text.replace(/```(?:json)?\s*[\s\S]*?```/g, "").trim();
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
  private scrollOffset = 0;
  private maxScroll = 0;
  private scrollState: "none" | "scrolled" | "overflow" = "none";
  private scrollCount = 0;
  private firstTranscriptLineIndex = 0;

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
    this.buildContent(Math.max(1, (process.stdout.columns ?? 80) - BOX_BORDER_OVERHEAD));
  }

  /** Update the transcript data and re-render. Called on every streaming delta. */
  update(entry: FlowOutputEntry): void {
    this.entry = entry;

    // Strip JSON code blocks from transcript when structured output is available
    // so the overlay shows the formatted report instead of raw JSON.
    if (entry.structuredOutput && entry.transcript.length > 0) {
      let changed = false;
      for (const t of entry.transcript) {
        const stripped = stripJsonBlock(t.text);
        if (stripped !== t.text) {
          t.text = stripped;
          changed = true;
        }
      }
      if (changed) {
        // Reset scroll since content changed
        this.scrollOffset = 0;
      }
    }

    this.scrollOffset = 0; // reset scroll so new output is always visible
    const w = this.lastRenderWidth || Math.max(1, (process.stdout.columns ?? 80) - BOX_BORDER_OVERHEAD);
    this.buildContent(w);
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
    // Scroll up
    if (this.keybindings.matches(data, "tui.select.up") || matchesKey(data, "k") || matchesKey(data, "up")) {
      if (this.scrollOffset < this.maxScroll) {
        this.scrollOffset++;
        const w = this.lastRenderWidth || Math.max(1, (process.stdout.columns ?? 80) - BOX_BORDER_OVERHEAD);
        this.buildContent(w);
        this.container.invalidate();
      }
      return;
    }
    // Scroll down
    if (this.keybindings.matches(data, "tui.select.down") || matchesKey(data, "j") || matchesKey(data, "down")) {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        const w = this.lastRenderWidth || Math.max(1, (process.stdout.columns ?? 80) - BOX_BORDER_OVERHEAD);
        this.buildContent(w);
        this.container.invalidate();
      }
      return;
    }
  }

  private buildContent(renderWidth: number): void {
    this.container.clear();
    const width = renderWidth;

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
    const separator = this.theme.fg("dim", "─".repeat(Math.max(0, width)));

    // Group thinking and output into sections for cleaner rendering
    let lastKind: "thinking" | "output" | null = null;

    const pushEntry = (kind: "thinking" | "output", text: string) => {
      if (!text) return;
      const label = kind === "thinking" ? "[thinking]" : "[output]";
      // Add section header when switching kinds
      if (lastKind !== kind) {
        if (lines.length > 0) {
          lines.push(separator);
        }
        lines.push(this.theme.fg("dim", `  ${label}`));
      }
      // Use tailText for long streaming text (matching main session)
      const displayText = text.length > 2000 ? tailText(text, 2000) : text;
      const wrapped = wrapTextWithAnsi(displayText, Math.max(1, width - 2));
      lines.push(...wrapped.map((l) => {
        if (kind === "thinking") {
          // Thinking: dim + italic (matching main session streaming style)
          const colored = `  ${this.theme.fg("dim", italic(l))}`;
          return truncateToWidth(colored, width, "", true);
        }
        const colored = `  ${l}`;
        return truncateToWidth(colored, width, "", true);
      }));
      lastKind = kind;
    };

    for (const entry of this.entry.transcript) {
      pushEntry(entry.kind, entry.text);
    }

    // Structured output report (only when flow is done and structured output is available)
    if (!this.entry.running && this.entry.structuredOutput) {
      const so = this.entry.structuredOutput;

      lines.push(separator);
      lines.push(this.theme.fg("dim", "  [report]"));

      // Status badge + summary
      const statusColor = so.status === "complete" ? "success" : so.status === "partial" ? "warning" : "error";
      lines.push(`  ${this.theme.fg(statusColor, `[${so.status}]`)} ${truncateToWidth(so.summary, Math.max(1, width - 10), "", true)}`);

      // Files
      if (so.files && so.files.length > 0) {
        const fileList = so.files.slice(0, 10).map((f) => f.path).join(", ");
        lines.push(this.theme.fg("dim", `  Files: ${truncateToWidth(fileList, Math.max(1, width - 10), "", true)}`));
      }

      // Commands
      if (so.commands && so.commands.length > 0) {
        const cmdLabels = so.commands.slice(0, 5).map((c) => {
          const short = c.command.length > 40 ? c.command.slice(0, 40) + "..." : c.command;
          return `${c.tool ?? "cmd"}: ${short}`;
        });
        lines.push(this.theme.fg("dim", `  Commands: ${cmdLabels.join(", ")}`));
        if (so.commands.length > 5) {
          lines.push(this.theme.fg("dim", `    ... and ${so.commands.length - 5} more`));
        }
      }

      // Not done
      if (so.notDone && so.notDone.length > 0) {
        const notDoneText = so.notDone.map((item) => {
          const details = [
            item.reason ? `reason: ${item.reason}` : undefined,
            item.blocker ? `blocker: ${item.blocker}` : undefined,
            item.nextStep ? `next: ${item.nextStep}` : undefined,
          ].filter(Boolean).join("; ");
          return details ? `${item.item} (${details})` : item.item;
        }).join("; ");
        lines.push(this.theme.fg("dim", `  Not Done: ${truncateToWidth(notDoneText, Math.max(1, width - 14), "", true)}`));
      }

      // Next steps
      if (so.nextSteps && so.nextSteps.length > 0) {
        lines.push(this.theme.fg("dim", `  Next: ${truncateToWidth(so.nextSteps.join("; "), Math.max(1, width - 10), "", true)}`));
      }

      // Reasoning (top 3)
      if (so.reasoning && so.reasoning.length > 0) {
        for (const r of so.reasoning.slice(0, 3)) {
          const short = r.length > 80 ? r.slice(0, 80) + "..." : r;
          lines.push(this.theme.fg("dim", `    \u2022 ${truncateToWidth(short, Math.max(1, width - 8), "", true)}`));
        }
        if (so.reasoning.length > 3) {
          lines.push(this.theme.fg("dim", `    ... and ${so.reasoning.length - 3} more`));
        }
      }

      // Notes (top 3)
      if (so.notes && so.notes.length > 0) {
        for (const n of so.notes.slice(0, 3)) {
          const short = n.length > 80 ? n.slice(0, 80) + "..." : n;
          lines.push(this.theme.fg("dim", `    \u2022 ${truncateToWidth(short, Math.max(1, width - 8), "", true)}`));
        }
        if (so.notes.length > 3) {
          lines.push(this.theme.fg("dim", `    ... and ${so.notes.length - 3} more`));
        }
      }
    }

    // Auto-scroll: show last N lines that fit the overlay
    const overlayHeight = Math.floor(this.tui.terminal.rows * 0.85);
    const errorOverhead = this.entry.errorMessage ? 2 : 0;
    const maxRows = Math.max(1, overlayHeight - 5 - errorOverhead);
    this.maxScroll = Math.max(0, lines.length - maxRows);
    
    // Apply scroll offset: slice from the scrolled position
    const sliceCount = Math.max(1, maxRows);
    const baseSlice = lines.slice(-(sliceCount + this.scrollOffset), -this.scrollOffset || undefined);
    const visible = [...baseSlice];
    
    // Track scroll state for left-border scrollbar indicator (zero vertical space)
    if (this.scrollOffset > 0) {
      this.scrollState = "scrolled";
      this.scrollCount = this.scrollOffset;
    } else if (lines.length > maxRows) {
      this.scrollState = "overflow";
      this.scrollCount = lines.length - maxRows;
    } else {
      this.scrollState = "none";
      this.scrollCount = 0;
    }
    
    // Track first transcript line index for scrollbar border indicator
    // Container children: header(1) + aim(1 if present) + spacer(1) + transcript...
    this.firstTranscriptLineIndex = 2 + (this.entry.aim ? 1 : 0);

    // Clamp visible lines to maxRows to prevent screen clipping
    const clamped = visible.slice(0, maxRows);
    
    for (const line of clamped) {
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

    this.buildContent(innerWidth);

    const rawLines = this.container.render(innerWidth);

    const borderColor = (s: string) => this.theme.fg("accent", s);
    const titleColor = (s: string) => this.theme.fg("dim", this.theme.bold(s));

    const topBorder = new BoxBorderTop(borderColor, this.entry.type, titleColor).render(width);
    const scrollPrefix = this.scrollState !== "none"
      ? `${this.scrollState === "scrolled" ? "\u25b2" : "\u25bc"} ${this.scrollCount} \u00b7 `
      : "";
    const bottomBorder = new BoxBorderBottom(
      borderColor,
      `${scrollPrefix}Esc dismiss \u00b7 \u2191\u2193 scroll \u00b7 Ctrl+Alt+O re-pick`,
      (s: string) => this.theme.fg("dim", s),
    ).render(width);

    const contentLines = rawLines.map((line, index) => {
      const padded = truncateToWidth(line, innerWidth, "", true);
      let leftBorder = BOX_BORDER_LEFT;
      // Left-border scrollbar: show arrow on first transcript line when scrolled
      if (index === this.firstTranscriptLineIndex && this.scrollState !== "none") {
        const arrow = this.scrollState === "scrolled" ? "\u25b2" : "\u25bc";
        leftBorder = `${arrow} `;
      }
      return `${borderColor(leftBorder)}${padded}${borderColor(BOX_BORDER_RIGHT)}`;
    });

    return [...topBorder, ...contentLines, ...bottomBorder];
  }
}
