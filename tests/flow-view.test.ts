import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Theme, KeybindingsManager, TUI } from '@mariozechner/pi-tui';

vi.mock('@mariozechner/pi-tui', async (importOriginal) => {
  const actual = await importOriginal();

  class TestContainer {
    children = [];
    addChild(child) { this.children.push(child); }
    clear() { this.children = []; }
    invalidate() {}
    render(width) {
      const lines = [];
      for (const child of this.children) {
        if (child.render) { lines.push(...child.render(width)); }
      }
      return lines;
    }
  }

  class TestText {
    text;
    constructor(text) { this.text = text; }
    render() { return this.text.split(String.fromCharCode(10)); }
  }

  class TestSpacer {
    render() { return ['']; }
  }

  return {
    ...actual,
    Container: TestContainer,
    Text: TestText,
    Spacer: TestSpacer,
  };
});

import { FlowPicker, FlowFocusedView, type FlowOutputEntry, type TranscriptEntry } from '../src/flow-view.js';

function makeMockTheme() {
  return { fg: (_, text) => text, bg: (_, text) => text };
}

function makeMockKeybindings() {
  return { matches: vi.fn(() => false), register: vi.fn(), unregister: vi.fn(), list: vi.fn(() => []) };
}

function makeMockTUI() {
  return { terminal: { rows: 24, cols: 80 }, refresh: vi.fn(), queueRefresh: vi.fn(), onResize: vi.fn() };
}

describe('FlowPicker', () => {
  let theme, tui, keybindings;
  beforeEach(() => {
    theme = makeMockTheme();
    tui = makeMockTUI();
    keybindings = makeMockKeybindings();
  });

  it('renders a list of flows', () => {
    const flows = [
      { key: 'scout#0', type: 'scout', aim: 'Explore codebase', running: true },
      { key: 'build#1', type: 'build', aim: 'Build feature', running: false },
    ];
    const done = vi.fn();
    const picker = new FlowPicker(flows, tui, theme, keybindings, done);
    const lines = picker.render(80);
    expect(lines.length).toBeGreaterThan(0);
    expect(done).not.toHaveBeenCalled();
  });

  it('handles empty flow list', () => {
    const done = vi.fn();
    const picker = new FlowPicker([], tui, theme, keybindings, done);
    expect(picker.render(80)).toBeDefined();
  });

  it('invalidates without throwing', () => {
    const flows = [{ key: 'scout#0', type: 'scout', aim: 'Test', running: true }];
    const picker = new FlowPicker(flows, tui, theme, keybindings, vi.fn());
    expect(() => picker.invalidate()).not.toThrow();
  });

  it('renders running status for active flows', () => {
    const flows = [{ key: 'scout#0', type: 'scout', aim: 'Active flow', running: true }];
    const picker = new FlowPicker(flows, tui, theme, keybindings, vi.fn());
    expect(picker.render(80).length).toBeGreaterThan(0);
  });

  it('renders done status for completed flows', () => {
    const flows = [{ key: 'build#1', type: 'build', aim: 'Completed', running: false }];
    const picker = new FlowPicker(flows, tui, theme, keybindings, vi.fn());
    expect(picker.render(80).length).toBeGreaterThan(0);
  });
});

describe('FlowFocusedView', () => {
  let theme, tui, keybindings;
  beforeEach(() => {
    theme = makeMockTheme();
    tui = makeMockTUI();
    keybindings = makeMockKeybindings();
  });

  function makeEntry(overrides = {}) {
    return { type: 'build', aim: 'Build the feature', running: true, transcript: [], streamingThinking: '', streamingOutput: '', ...overrides };
  }

  it('renders header with running status', () => {
    const view = new FlowFocusedView('build#0', makeEntry({ running: true }), tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('renders done status when not running', () => {
    const view = new FlowFocusedView('build#0', makeEntry({ running: false }), tui, theme, keybindings, vi.fn());
    expect(view.render(80)).toBeDefined();
  });

  it('renders transcript entries', () => {
    const entry = makeEntry({ transcript: [
      { kind: 'thinking', text: 'Let me think...' },
      { kind: 'output', text: 'Here is the result.' },
    ]});
    const view = new FlowFocusedView('build#0', entry, tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('renders streaming thinking text', () => {
    const entry = makeEntry({ streamingThinking: 'Thinking in progress...' });
    const view = new FlowFocusedView('build#0', entry, tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('renders streaming output text', () => {
    const entry = makeEntry({ streamingOutput: 'Output in progress...' });
    const view = new FlowFocusedView('build#0', entry, tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('renders error message when present', () => {
    const entry = makeEntry({ running: false, errorMessage: 'Flow failed' });
    const view = new FlowFocusedView('build#0', entry, tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('update() replaces entry and re-renders', () => {
    const dismiss = vi.fn();
    const view = new FlowFocusedView('build#0', makeEntry({ streamingOutput: 'first' }), tui, theme, keybindings, dismiss);
    view.update(makeEntry({ streamingOutput: 'second', transcript: [{ kind: 'output', text: 'completed' }] }));
    expect(() => view.render(80)).not.toThrow();
  });

  it('invalidates without throwing', () => {
    const view = new FlowFocusedView('build#0', makeEntry(), tui, theme, keybindings, vi.fn());
    expect(() => view.invalidate()).not.toThrow();
  });

  it('renders with empty aim without crashing', () => {
    const view = new FlowFocusedView('build#0', makeEntry({ aim: '' }), tui, theme, keybindings, vi.fn());
    expect(() => view.render(80)).not.toThrow();
  });

  it('renders interleaved thinking and output', () => {
    const transcript = [
      { kind: 'thinking', text: 'Analyzing' },
      { kind: 'output', text: 'Step 1' },
      { kind: 'thinking', text: 'Processing' },
      { kind: 'output', text: 'Step 2' },
    ];
    const view = new FlowFocusedView('build#0', makeEntry({ transcript }), tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });

  it('shows line count for long transcripts', () => {
    const transcript = Array.from({ length: 30 }, (_, i) => ({ kind: 'output', text: 'Line ' + i }));
    const view = new FlowFocusedView('build#0', makeEntry({ transcript }), tui, theme, keybindings, vi.fn());
    expect(view.render(80).length).toBeGreaterThan(0);
  });
});
