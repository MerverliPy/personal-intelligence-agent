// ---------------------------------------------------------------------------
// Plain text parser
// ---------------------------------------------------------------------------
// Handles text/plain, text/markdown, text/csv, application/json, text/html,
// and any other text-based MIME type.
// ---------------------------------------------------------------------------

import type { Parser, ParserInput, ParsedDocument, Locator } from './types.js';
import { ParserError } from './types.js';

const PLAIN_TEXT_MIME = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
]);

const PLAIN_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.html',
  '.htm',
  '.json',
  '.xml',
  '.log',
]);

const MARKDOWN_EXTS = new Set(['.md', '.markdown']);
const CSV_EXTS = new Set(['.csv']);

/**
 * Parses plain-text and text-based formats into a normalized document.
 *
 * - Paragraphs are delimited by one or more blank lines.
 * - Lines within a paragraph are joined with a single space.
 * - Markdown headings (#, ##, ...) generate heading locators.
 * - CSV files generate line locators (one per data row).
 */
export class PlainTextParser implements Parser {
  readonly id = 'plain-text-v1';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [...PLAIN_TEXT_MIME] as const;
  readonly supportedExtensions = [...PLAIN_TEXT_EXTENSIONS] as const;

  canParse(mimeType: string, filename: string): boolean {
    if (mimeType && PLAIN_TEXT_MIME.has(mimeType)) return true;
    const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
    return PLAIN_TEXT_EXTENSIONS.has(ext.toLowerCase());
  }

  async parse(input: ParserInput): Promise<ParsedDocument> {
    if (input.content.byteLength === 0) {
      throw new ParserError('Empty file', 'EMPTY_FILE', this.id);
    }
    if (input.content.byteLength > input.maxSizeBytes) {
      throw new ParserError(
        `File size ${input.content.byteLength} exceeds limit ${input.maxSizeBytes}`,
        'SIZE_EXCEEDED',
        this.id,
      );
    }

    const startTime = Date.now();
    const raw = input.content.toString('utf-8');
    const locators: Locator[] = [];
    const ext = input.filename.includes('.')
      ? input.filename.slice(input.filename.lastIndexOf('.')).toLowerCase()
      : '';

    // Detect format variant
    const isMarkdown = input.mimeType === 'text/markdown' || MARKDOWN_EXTS.has(ext);
    const isCsv = input.mimeType === 'text/csv' || CSV_EXTS.has(ext);

    // Build normalized text and locators
    if (isCsv) {
      return this._parseCsv(raw, locators, startTime, input);
    }

    if (isMarkdown) {
      return this._parseMarkdown(raw, locators, startTime, input);
    }

    return this._parsePlainText(raw, locators, startTime, input);
  }

  // -----------------------------------------------------------------------
  // Plain text
  // -----------------------------------------------------------------------

  private _parsePlainText(
    raw: string,
    locators: Locator[],
    startTime: number,
    _input: ParserInput,
  ): ParsedDocument {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into paragraphs (blank-line delimited)
    const paragraphs = normalized.split(/\n{2,}/);
    let offset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]!.trim();
      if (para.length === 0) {
        offset += paragraphs[i]!.length + 2; // account for blank line
        continue;
      }

      // Collapse whitespace within paragraphs
      const collapsed = para.replace(/\s+/g, ' ');
      const normalizedPara = collapsed + '\n\n';
      const start = offset;

      locators.push({
        type: 'paragraph',
        ordinal: locators.filter((l) => l.type === 'paragraph').length,
        startOffset: start,
        endOffset: start + normalizedPara.length,
      });

      offset += normalizedPara.length;
    }

    const text = locators
      .filter((l) => l.type === 'paragraph')
      .map((l) => normalized.slice(l.startOffset, l.endOffset))
      .join('');

    return {
      text,
      locators,
      metadata: {
        format: _input.mimeType || 'text/plain',
        parserId: this.id,
        parserVersion: this.version,
        parsingTimeMs: Date.now() - startTime,
        paragraphCount: locators.filter((l) => l.type === 'paragraph').length,
        characterCount: text.length,
        pageCount: 1,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Markdown
  // -----------------------------------------------------------------------

  private _parseMarkdown(
    raw: string,
    locators: Locator[],
    startTime: number,
    _input: ParserInput,
  ): ParsedDocument {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    let textBuf = '';
    let paraBuf = '';
    let headingIdx = 0;
    let paraIdx = 0;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        // Flush pending paragraph
        if (paraBuf.trim().length > 0) {
          const collapsed = paraBuf.replace(/\s+/g, ' ').trim();
          const start = textBuf.length;
          textBuf += collapsed + '\n\n';
          locators.push({
            type: 'paragraph',
            ordinal: paraIdx++,
            startOffset: start,
            endOffset: textBuf.length,
          });
          paraBuf = '';
        }

        const level = headingMatch[1]!.length;
        const title = headingMatch[2]!.trim();
        const headingLine = title + '\n';
        const start = textBuf.length;
        textBuf += headingLine;
        locators.push({
          type: 'heading',
          ordinal: headingIdx++,
          startOffset: start,
          endOffset: textBuf.length,
          title,
          level,
        });
      } else if (line.trim().length === 0) {
        // Blank line — flush paragraph
        if (paraBuf.trim().length > 0) {
          const collapsed = paraBuf.replace(/\s+/g, ' ').trim();
          const start = textBuf.length;
          textBuf += collapsed + '\n\n';
          locators.push({
            type: 'paragraph',
            ordinal: paraIdx++,
            startOffset: start,
            endOffset: textBuf.length,
          });
          paraBuf = '';
        }
      } else {
        paraBuf += line + ' ';
      }
    }

    // Flush final paragraph
    if (paraBuf.trim().length > 0) {
      const collapsed = paraBuf.replace(/\s+/g, ' ').trim();
      const start = textBuf.length;
      textBuf += collapsed + '\n';
      locators.push({
        type: 'paragraph',
        ordinal: paraIdx++,
        startOffset: start,
        endOffset: textBuf.length,
      });
    }

    return {
      text: textBuf,
      locators,
      metadata: {
        format: 'text/markdown',
        parserId: this.id,
        parserVersion: this.version,
        parsingTimeMs: Date.now() - startTime,
        paragraphCount: paraIdx,
        characterCount: textBuf.length,
        pageCount: 1,
      },
    };
  }

  // -----------------------------------------------------------------------
  // CSV
  // -----------------------------------------------------------------------

  private _parseCsv(
    raw: string,
    locators: Locator[],
    startTime: number,
    _input: ParserInput,
  ): ParsedDocument {
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = normalized.split('\n');
    let text = '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!.trim();
      if (row.length === 0) continue;
      const line = row + '\n';
      const start = text.length;
      text += line;
      locators.push({
        type: 'line',
        ordinal: i,
        startOffset: start,
        endOffset: text.length,
      });
    }

    return {
      text,
      locators,
      metadata: {
        format: 'text/csv',
        parserId: this.id,
        parserVersion: this.version,
        parsingTimeMs: Date.now() - startTime,
        characterCount: text.length,
        pageCount: 1,
      },
    };
  }
}

/** Singleton instance for convenience. */
export const plainTextParser: Parser = new PlainTextParser();
