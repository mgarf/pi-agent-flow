import { describe, it, expect } from 'vitest';
import { computeActiveTools } from '../src/flow-prompt';

describe('computeActiveTools', () => {
  it('should include memory tools in optimize mode', () => {
    const tools = computeActiveTools(true);
    expect(tools).toContain('memory_search');
    expect(tools).toContain('session_search');
    expect(tools).toContain('memory');
    expect(tools).toContain('skill');
    expect(tools).toContain('batch_read');
    expect(tools).toContain('flow');
    expect(tools).toContain('web');
    expect(tools).toContain('ask_user');
  });

  it('should include memory tools in non-optimize mode', () => {
    const tools = computeActiveTools(false);
    expect(tools).toContain('memory_search');
    expect(tools).toContain('session_search');
    expect(tools).toContain('memory');
    expect(tools).toContain('skill');
    expect(tools).toContain('read');
    expect(tools).toContain('write');
    expect(tools).toContain('edit');
    expect(tools).toContain('batch');
    expect(tools).toContain('bash');
    expect(tools).toContain('flow');
    expect(tools).toContain('web');
    expect(tools).toContain('ask_user');
  });
});
