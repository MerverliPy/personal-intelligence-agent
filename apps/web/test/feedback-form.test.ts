// ---------------------------------------------------------------------------
// Feedback form unit tests (P3-T09)
// ---------------------------------------------------------------------------
// Covers AC #4 ("Feedback can be submitted without altering the
// original message"): the form is a sibling of the message, never
// nests inside it, and the rendered HTML structure is keyboard-
// submittable with a proper `<label>`-`<input>` association.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  renderFeedbackForm,
  renderMessage,
  FEEDBACK_CATEGORIES,
} from '../src/pages/conversation-shared.js';

const SAMPLE_MSG = {
  id: 'msg-1',
  role: 'ASSISTANT' as const,
  content: 'Here is the answer.',
  created_at: '2026-06-13T12:00:00.000Z',
};

describe('renderFeedbackForm', () => {
  it('renders a `<form>` with a `data-message-id` attribute', () => {
    const html = renderFeedbackForm('msg-1');
    expect(html).toMatch(/^<form /);
    expect(html).toContain('data-message-id="msg-1"');
  });

  it('includes a category `<select>` with all 8 FEEDBACK_CATEGORIES options', () => {
    const html = renderFeedbackForm('msg-1');
    for (const c of FEEDBACK_CATEGORIES) {
      expect(html).toContain(`value="${c}"`);
    }
    expect(FEEDBACK_CATEGORIES).toHaveLength(8);
  });

  it('includes correction and notes textareas with a `maxlength` cap', () => {
    const html = renderFeedbackForm('msg-1', 4096);
    expect(html).toContain('name="correction"');
    expect(html).toContain('maxlength="4096"');
    expect(html).toContain('name="notes"');
  });

  it('associates every input with a `<label>` (keyboard accessibility)', () => {
    const html = renderFeedbackForm('msg-1');
    // The `for` attribute on each label must match an `id` on an input/select/textarea.
    const labels = Array.from(html.matchAll(/<label for="([^"]+)">/g)).map((m) => m[1]);
    expect(labels.length).toBeGreaterThanOrEqual(3);
    for (const id of labels) {
      const idPattern = new RegExp(`id="${id}"`);
      expect(html).toMatch(idPattern);
    }
  });

  it('has a submit button (keyboard-activatable)', () => {
    const html = renderFeedbackForm('msg-1');
    expect(html).toContain('type="submit"');
  });

  it('XSS guard: escapes a messageId that contains HTML', () => {
    const html = renderFeedbackForm('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderMessage', () => {
  it('renders the message content in a `.message-content` div', () => {
    const html = renderMessage(SAMPLE_MSG, true);
    expect(html).toMatch(/^<article /);
    expect(html).toContain('class="message message-assistant"');
    expect(html).toContain('Here is the answer.');
  });

  it('XSS guard: escapes script tags in message content', () => {
    const xss = { ...SAMPLE_MSG, content: '<script>alert(1)</script>' };
    const html = renderMessage(xss, true);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('AC#4: feedback form is a SIBLING of the message content, not nested inside', () => {
    const html = renderMessage(SAMPLE_MSG, true);
    // The `.message-content` div should not contain the feedback form.
    const contentMatch = html.match(/<div class="message-content">([\s\S]*?)<\/div>/);
    expect(contentMatch).not.toBeNull();
    expect(contentMatch![1]!).not.toContain('feedback-form');
    // The feedback form appears AFTER the `.message-content` div.
    const formIdx = html.indexOf('feedback-form');
    const contentIdx = html.indexOf('class="message-content"');
    expect(contentIdx).toBeGreaterThan(-1);
    expect(formIdx).toBeGreaterThan(contentIdx);
  });

  it('does NOT include the feedback form on non-assistant messages', () => {
    const userMsg = { ...SAMPLE_MSG, role: 'USER' as const };
    expect(renderMessage(userMsg, true)).not.toContain('feedback-form');
  });

  it('omits the feedback form when `feedbackEnabled` is false', () => {
    expect(renderMessage(SAMPLE_MSG, false)).not.toContain('feedback-form');
  });
});
