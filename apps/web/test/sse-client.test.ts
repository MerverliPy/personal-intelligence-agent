// ---------------------------------------------------------------------------
// SSE client parser unit tests (P3-T09)
// ---------------------------------------------------------------------------
// Verifies the incremental SSE parser handles all event types emitted
// by the P3-T05 assistant orchestrator, plus chunked buffers (one
// event split across two calls), comment lines, and keepalives.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { parseSseStream, type SseEventWire } from '../src/pages/conversation-shared.js';

describe('parseSseStream', () => {
  it('parses a single event with default name and data', () => {
    const r = parseSseStream('data: hello\n\n');
    expect(r.events).toEqual([{ event: 'message', data: 'hello' }]);
    expect(r.remainder).toBe('');
  });

  it('parses a named event', () => {
    const r = parseSseStream('event: run.started\ndata: {"type":"run.started"}\n\n');
    expect(r.events).toEqual([{ event: 'run.started', data: '{"type":"run.started"}' }]);
    expect(r.remainder).toBe('');
  });

  it('joins multi-line data fields with a single newline', () => {
    const r = parseSseStream('data: line1\ndata: line2\n\n');
    expect(r.events).toEqual([{ event: 'message', data: 'line1\nline2' }]);
  });

  it('ignores comment lines (lines starting with `:`)', () => {
    const r = parseSseStream(': this is a comment\ndata: real\n\n');
    expect(r.events).toEqual([{ event: 'message', data: 'real' }]);
  });

  it('treats a comment-only block as no event', () => {
    const r = parseSseStream(': keepalive\n\n');
    expect(r.events).toEqual([]);
  });

  it('parses all six P3-T05 SSE event types', () => {
    const types = [
      'run.started',
      'response.delta',
      'citation.provisional',
      'approval.required',
      'response.completed',
      'run.failed',
    ];
    for (const t of types) {
      const r = parseSseStream(`event: ${t}\ndata: {"type":"${t}"}\n\n`);
      expect(r.events).toHaveLength(1);
      expect(r.events[0]!.event).toBe(t);
    }
  });

  it('strips a single leading space from a value, per the SSE spec', () => {
    const r = parseSseStream('data:  hello world\n\n');
    expect(r.events).toEqual([{ event: 'message', data: ' hello world' }]);
  });

  it('returns the trailing partial block as `remainder`', () => {
    const buffer = 'data: first\n\ndata: partial-without-blank-line';
    const r = parseSseStream(buffer);
    expect(r.events).toEqual([{ event: 'message', data: 'first' }]);
    expect(r.remainder).toBe('data: partial-without-blank-line');
  });

  it('handles a chunked buffer: first call yields one event + remainder, second call yields the next', () => {
    const first = parseSseStream('data: a\n\ndata: b');
    expect(first.events).toEqual([{ event: 'message', data: 'a' }]);
    expect(first.remainder).toBe('data: b');

    const second = parseSseStream(first.remainder + '\n\n');
    expect(second.events).toEqual([{ event: 'message', data: 'b' }]);
    expect(second.remainder).toBe('');
  });

  it('handles CRLF line endings', () => {
    const r = parseSseStream('data: hello\r\n\r\n');
    expect(r.events).toEqual([{ event: 'message', data: 'hello' }]);
  });

  it('handles bare field lines (no colon) as field-name with empty value', () => {
    const r = parseSseStream('event\ndata: value\n\n');
    // `event` is a known field with empty value; `data` follows.
    expect(r.events).toEqual([{ event: '', data: 'value' }]);
  });

  it('discards empty data-only blocks (no actual data line)', () => {
    const r = parseSseStream('\n\n');
    expect(r.events).toEqual([]);
  });
});
