// ---------------------------------------------------------------------------
// PDF parser
// ---------------------------------------------------------------------------
// Uses pdf-parse (which wraps pdf.js) for text extraction. Pure JavaScript
// — no network access, no external process.
// ---------------------------------------------------------------------------

import type { Parser, ParserInput, ParsedDocument, Locator } from './types.js';
import { ParserError } from './types.js';
// pdf-parse ships with CJS types; dynamic import avoids bundling issues
import pdfParse from 'pdf-parse';

const PDF_MIME_TYPES = new Set(['application/pdf', 'application/x-pdf']);

const PDF_EXTENSIONS = new Set(['.pdf']);

/**
 * Parses PDF documents into normalized text with page locators.
 *
 * Page breaks are preserved as form-feed characters (`\f`). Each page
 * generates a `page` locator. Within each page, paragraphs are detected
 * via blank-line separation and emitted as `paragraph` locators.
 */
export class PdfParser implements Parser {
  readonly id = 'pdf-v1';
  readonly version = '1.0.0';
  readonly supportedMimeTypes = [...PDF_MIME_TYPES] as const;
  readonly supportedExtensions = [...PDF_EXTENSIONS] as const;

  canParse(mimeType: string, filename: string): boolean {
    if (mimeType && PDF_MIME_TYPES.has(mimeType)) return true;
    const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
    return PDF_EXTENSIONS.has(ext.toLowerCase());
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

    let data: pdfParse.Result;
    try {
      data = await pdfParse(input.content, {
        // Disable version check warning
        version: 'default',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Detect encrypted PDFs
      if (msg.includes('encrypted') || msg.includes('password') || msg.includes('No valid PDF')) {
        throw new ParserError(
          'Cannot parse PDF: file may be encrypted or malformed',
          'PDF_PARSE_ERROR',
          this.id,
        );
      }
      throw new ParserError(`PDF parsing failed: ${msg}`, 'PDF_PARSE_ERROR', this.id);
    }

    const fullText = data.text;
    const locators = this._buildLocators(fullText);

    return {
      text: fullText,
      locators,
      metadata: {
        format: 'application/pdf',
        parserId: this.id,
        parserVersion: this.version,
        parsingTimeMs: Date.now() - startTime,
        pageCount: data.numpages,
        paragraphCount: locators.filter((l) => l.type === 'paragraph').length,
        characterCount: fullText.length,
        sourceMetadata: {
          pdfProducer: data.info?.Producer ?? undefined,
          pdfCreator: data.info?.Creator ?? undefined,
          pdfAuthor: data.info?.Author ?? undefined,
          pdfTitle: data.info?.Title ?? undefined,
        },
      },
    };
  }

  // -----------------------------------------------------------------------
  // Locator construction
  // -----------------------------------------------------------------------

  private _buildLocators(fullText: string): Locator[] {
    const locators: Locator[] = [];

    // Split on form-feed (page break) or explicit page markers
    // pdf-parse uses double newlines between pages in some versions,
    // and '\n\n' between pages in others. We detect page boundaries
    // heuristically.
    const pages = fullText.split(/\f/);
    let globalOffset = 0;

    for (let p = 0; p < pages.length; p++) {
      const pageText = pages[p]!;
      if (pageText.trim().length === 0) {
        globalOffset += pageText.length + 1; // +1 for the form-feed
        continue;
      }

      const pageStart = globalOffset;

      // Within a page, detect paragraphs (blank-line delimited)
      const paragraphs = pageText.split(/\n{2,}/);
      for (const para of paragraphs) {
        const trimmed = para.replace(/\s+/g, ' ').trim();
        if (trimmed.length === 0) continue;

        const paraStart = pageStart + pageText.indexOf(para);
        locators.push({
          type: 'paragraph',
          ordinal: locators.filter((l) => l.type === 'paragraph').length,
          startOffset: paraStart,
          endOffset: paraStart + para.length,
          metadata: { page: p + 1 },
        });
      }

      locators.push({
        type: 'page',
        ordinal: p,
        startOffset: pageStart,
        endOffset: globalOffset + pageText.length,
        title: `Page ${p + 1}`,
      });

      globalOffset += pageText.length + 1; // +1 for the form-feed
    }

    // If pdf-parse didn't return page breaks, fall back to whole-document page
    if (locators.filter((l) => l.type === 'page').length === 0) {
      locators.push({
        type: 'page',
        ordinal: 0,
        startOffset: 0,
        endOffset: fullText.length,
        title: 'Page 1',
      });
    }

    return locators;
  }
}

/** Singleton instance for convenience. */
export const pdfParser: Parser = new PdfParser();
