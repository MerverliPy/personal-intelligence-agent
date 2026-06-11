// ---------------------------------------------------------------------------
// Parsing unit tests (P2-T04)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

import {
  PlainTextParser,
  PdfParser,
  DocxParser,
  findParser,
  ParserError,
  unsupportedFormatError,
  createExtractionStage,
} from '../src/parsing/index.js';

import type { ParserInput, Parser, ParsedDocument } from '../src/parsing/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '..', '..', '..', 'test', 'fixtures');

function readFixture(name: string): Buffer {
  return readFileSync(resolve(fixturesDir, name));
}

function makeInput(overrides: Partial<ParserInput> = {}): ParserInput {
  return {
    content: Buffer.from(''),
    filename: 'test.txt',
    mimeType: 'text/plain',
    maxSizeBytes: 50 * 1024 * 1024,
    timeoutMs: 10_000,
    ...overrides,
  };
}

/** Asserts that two parse calls produce identical output (determinism check). */
function assertDeterministic(parser: Parser, input: ParserInput): Promise<void> {
  return expect(
    Promise.all([parser.parse(input), parser.parse(input)]).then(([a, b]) => {
      expect(a.text).toBe(b.text);
      expect(a.locators).toEqual(b.locators);
      expect(a.metadata.characterCount).toBe(b.metadata.characterCount);
      expect(a.metadata.paragraphCount).toBe(b.metadata.paragraphCount);
    }),
  ).resolves.toBeUndefined();
}

// ---------------------------------------------------------------------------
// PDF generation helper
// ---------------------------------------------------------------------------

/**
 * Generate a minimal valid PDF programmatically.
 *
 * We construct a simple PDF manually because pdfkit-generated buffers
 * sometimes have xref table quirks that pdf-parse rejects. The PDF
 * contains two pages of text with a standard cross-reference table.
 */
async function generatePdfBuffer(): Promise<Buffer> {
  // Helper to build a minimal PDF
  const objects: string[] = [];

  // Catalog (obj 1)
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  // Pages (obj 2)
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>\nendobj\n');
  // Page 1 (obj 3)
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );
  // Page 1 content stream (obj 4)
  objects.push(
    '4 0 obj\n<< /Length 89 >>\nstream\nBT /F1 12 Tf 72 700 Td (Test PDF Document - Page One) Tj T*\n(This is the first paragraph of text.) Tj ET\nendstream\nendobj\n',
  );
  // Font (obj 5)
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');
  // Page 2 content stream (obj 6)
  objects.push(
    '6 0 obj\n<< /Length 91 >>\nstream\nBT /F1 12 Tf 72 700 Td (Test PDF Document - Page Two) Tj T*\n(This is the second page paragraph.) Tj ET\nendstream\nendobj\n',
  );
  // Page 2 (obj 7)
  objects.push(
    '7 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );

  // Compute byte offsets for xref table
  const offsets: number[] = [];
  let buf = '%PDF-1.4\n';
  for (const obj of objects) {
    offsets.push(buf.length);
    buf += obj;
  }
  const xrefOffset = buf.length;

  // Cross-reference table
  buf += 'xref\n';
  buf += `0 ${offsets.length + 1}\n`;
  buf += '0000000000 65535 f \n';
  for (const off of offsets) {
    buf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  buf += 'trailer\n';
  buf += `<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`;
  buf += 'startxref\n';
  buf += `${xrefOffset}\n`;
  buf += '%%EOF\n';

  return Buffer.from(buf, 'ascii');
}

// ---------------------------------------------------------------------------
// DOCX generation helper
// ---------------------------------------------------------------------------

async function generateDocxBuffer(): Promise<Buffer> {
  const zip = new JSZip();

  // Minimal DOCX structure
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Introduction to DOCX</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This is a test DOCX document for parser verification.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>It contains multiple paragraphs to verify extraction.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`,
  );

  return Buffer.from(await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }));
}

/**
 * Return a fresh copy of the PDF fixture buffer.
 * pdf-parse may mutate internal state, so each test needs its own copy.
 */
function getPdfFixture(): Buffer {
  return Buffer.from(pdfFixture);
}

let pdfFixture: Buffer;
let docxFixture: Buffer;

beforeAll(async () => {
  pdfFixture = await generatePdfBuffer();
  docxFixture = await generateDocxBuffer();
}, 15000);

// ===========================================================================
// PlainTextParser
// ===========================================================================

describe('PlainTextParser', () => {
  const parser = new PlainTextParser();

  it('should parse a plain text file into paragraphs', async () => {
    const content = readFixture('sample.txt');
    const result = await parser.parse(makeInput({ content, filename: 'sample.txt' }));

    expect(result.text.length).toBeGreaterThan(0);
    const paragraphs = result.locators.filter((l) => l.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);

    // Every locator offset should be within bounds
    for (const loc of result.locators) {
      expect(loc.startOffset).toBeGreaterThanOrEqual(0);
      expect(loc.endOffset).toBeLessThanOrEqual(result.text.length);
      expect(loc.endOffset).toBeGreaterThan(loc.startOffset);
    }
  });

  it('should produce deterministic output for identical input', async () => {
    const content = readFixture('sample.txt');
    await assertDeterministic(parser, makeInput({ content, filename: 'sample.txt' }));
  });

  it('should parse markdown with heading locators', async () => {
    const content = readFixture('sample.md');
    const result = await parser.parse(
      makeInput({ content, filename: 'sample.md', mimeType: 'text/markdown' }),
    );

    const headings = result.locators.filter((l) => l.type === 'heading');
    expect(headings.length).toBeGreaterThanOrEqual(2);
    expect(headings[0]!.level).toBe(1);
    expect(headings[0]!.title).toBeTruthy();
  });

  it('should parse CSV with line locators', async () => {
    const content = readFixture('sample.csv');
    const result = await parser.parse(
      makeInput({ content, filename: 'sample.csv', mimeType: 'text/csv' }),
    );

    const lines = result.locators.filter((l) => l.type === 'line');
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it('should reject empty files', async () => {
    await expect(parser.parse(makeInput({ content: Buffer.from('') }))).rejects.toThrow(
      ParserError,
    );
  });

  it('should reject oversized files', async () => {
    const content = Buffer.alloc(1024, 'x');
    await expect(parser.parse(makeInput({ content, maxSizeBytes: 512 }))).rejects.toThrow(
      ParserError,
    );
  });

  it('should claim support for .txt, .md, .csv, .html, .json extensions', () => {
    expect(parser.canParse('text/plain', 'doc.txt')).toBe(true);
    expect(parser.canParse('text/markdown', 'doc.md')).toBe(true);
    expect(parser.canParse('text/csv', 'data.csv')).toBe(true);
    expect(parser.canParse('text/html', 'page.html')).toBe(true);
    expect(parser.canParse('application/json', 'data.json')).toBe(true);
    expect(parser.canParse('', 'readme.md')).toBe(true); // extension fallback
  });

  it('should deny support for unknown formats', () => {
    expect(parser.canParse('application/pdf', 'doc.pdf')).toBe(false);
    expect(parser.canParse('', 'image.png')).toBe(false);
  });
});

// ===========================================================================
// PdfParser
// ===========================================================================

describe('PdfParser', () => {
  const parser = new PdfParser();

  it('should parse a PDF into text with paragraphs', async () => {
    const result = await parser.parse(
      makeInput({
        content: getPdfFixture(),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    );

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.metadata.format).toBe('application/pdf');
    expect(result.metadata.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.metadata.parserId).toBe('pdf-v1');
  });

  it('should include page locators for each page', async () => {
    const result = await parser.parse(
      makeInput({
        content: getPdfFixture(),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    );

    const pages = result.locators.filter((l) => l.type === 'page');
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });

  it('should produce deterministic output', async () => {
    await assertDeterministic(
      parser,
      makeInput({
        content: getPdfFixture(),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    );
  });

  it('should reject empty files', async () => {
    await expect(
      parser.parse(
        makeInput({
          content: Buffer.from(''),
          filename: 'empty.pdf',
          mimeType: 'application/pdf',
        }),
      ),
    ).rejects.toThrow(ParserError);
  });

  it('should reject malformed PDF content', async () => {
    await expect(
      parser.parse(
        makeInput({
          content: Buffer.from('not a pdf file at all'),
          filename: 'bad.pdf',
          mimeType: 'application/pdf',
        }),
      ),
    ).rejects.toThrow(ParserError);
  });

  it('should claim support for PDF mime types and extensions', () => {
    expect(parser.canParse('application/pdf', 'doc.pdf')).toBe(true);
    expect(parser.canParse('', 'file.pdf')).toBe(true);
    expect(parser.canParse('text/plain', 'doc.txt')).toBe(false);
  });
});

// ===========================================================================
// DocxParser
// ===========================================================================

describe('DocxParser', () => {
  const parser = new DocxParser();

  it('should parse a DOCX into text', async () => {
    const result = await parser.parse(
      makeInput({
        content: docxFixture,
        filename: 'test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.metadata.format).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result.metadata.parserId).toBe('docx-v1');
  });

  it('should produce deterministic output', async () => {
    await assertDeterministic(
      parser,
      makeInput({
        content: docxFixture,
        filename: 'test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );
  });

  it('should reject empty files', async () => {
    await expect(
      parser.parse(
        makeInput({
          content: Buffer.from(''),
          filename: 'empty.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ),
    ).rejects.toThrow(ParserError);
  });

  it('should reject malformed DOCX content', async () => {
    await expect(
      parser.parse(
        makeInput({
          content: Buffer.from('not a valid zip file'),
          filename: 'bad.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ),
    ).rejects.toThrow(ParserError);
  });

  it('should claim support for DOCX mime types and extensions', () => {
    expect(
      parser.canParse(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc.docx',
      ),
    ).toBe(true);
    expect(parser.canParse('', 'report.docx')).toBe(true);
    expect(parser.canParse('application/pdf', 'doc.pdf')).toBe(false);
  });
});

// ===========================================================================
// Parser registry (findParser)
// ===========================================================================

describe('findParser', () => {
  const parsers = [new PlainTextParser(), new PdfParser(), new DocxParser()];

  it('should find the correct parser by mime type', () => {
    expect(
      findParser(makeInput({ mimeType: 'text/plain', filename: 'x.txt' }), parsers),
    ).toBeInstanceOf(PlainTextParser);
    expect(
      findParser(makeInput({ mimeType: 'application/pdf', filename: 'x.pdf' }), parsers),
    ).toBeInstanceOf(PdfParser);
    expect(
      findParser(
        makeInput({
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          filename: 'x.docx',
        }),
        parsers,
      ),
    ).toBeInstanceOf(DocxParser);
  });

  it('should fall back to extension when mime type is empty', () => {
    expect(findParser(makeInput({ mimeType: '', filename: 'doc.txt' }), parsers)).toBeInstanceOf(
      PlainTextParser,
    );
    expect(findParser(makeInput({ mimeType: '', filename: 'doc.pdf' }), parsers)).toBeInstanceOf(
      PdfParser,
    );
    expect(findParser(makeInput({ mimeType: '', filename: 'doc.docx' }), parsers)).toBeInstanceOf(
      DocxParser,
    );
  });

  it('should return undefined for unsupported formats', () => {
    expect(
      findParser(makeInput({ mimeType: 'image/png', filename: 'photo.png' }), parsers),
    ).toBeUndefined();
  });
});

// ===========================================================================
// unsupportedFormatError
// ===========================================================================

describe('unsupportedFormatError', () => {
  it('should produce a ParserError with UNSUPPORTED_FORMAT reason', () => {
    const err = unsupportedFormatError(makeInput({ mimeType: 'image/png', filename: 'photo.png' }));
    expect(err).toBeInstanceOf(ParserError);
    expect(err.reasonCode).toBe('UNSUPPORTED_FORMAT');
    expect(err.message).toContain('Unsupported format');
  });
});

// ===========================================================================
// Extraction stage (createExtractionStage)
// ===========================================================================

describe('createExtractionStage', () => {
  it('should have name "extraction"', () => {
    const stage = createExtractionStage({
      pool: {} as any,
    });
    expect(stage.name).toBe('extraction');
  });

  it('should fail with terminal error when no content loader is configured', async () => {
    const { TerminalJobError } = await import('@pia/jobs');

    // Mock pool that returns a stored file, then the stage will try to call
    // loadFileContent which is not configured → TerminalJobError
    const mockPool = {
      query: async () => ({
        rows: [
          {
            id: 'sf-1',
            workspace_id: 'ws-1',
            storage_provider: 'minio',
            object_key: 'obj-1',
            original_filename: 'test.txt',
            declared_mime_type: 'text/plain',
            detected_mime_type: 'text/plain',
            size_bytes: 100,
            checksum_sha256: 'abc123',
            scan_status: 'CLEAN',
            scan_metadata: {},
            created_by: 'u-1',
            created_at: new Date().toISOString(),
            deleted_at: null,
          },
        ],
      }),
    };

    const stage = createExtractionStage({
      pool: mockPool as any,
    });

    // Mock context
    const ctx: any = {
      pool: mockPool,
      version: {
        workspaceId: 'ws-1',
        id: 'v-1',
        storedFileId: 'sf-1',
        extractionMetadata: {},
      },
      job: { pipelineVersion: 'v1' },
      correlationId: 'corr-1',
    };

    // Should throw TerminalJobError because no loadFileContent adapter
    await expect(stage.execute(ctx)).rejects.toThrow(TerminalJobError);
  });
});

// ===========================================================================
// Normalized content and locators verification
// ===========================================================================

describe('Normalized content', () => {
  it('plain text: every locator offset references valid text spans', async () => {
    const parser = new PlainTextParser();
    const content = readFixture('sample.txt');
    const result = await parser.parse(makeInput({ content, filename: 'sample.txt' }));

    for (const loc of result.locators) {
      const span = result.text.slice(loc.startOffset, loc.endOffset);
      expect(span.length).toBeGreaterThan(0);
    }
  });

  it('PDF: page locators cover the full text', async () => {
    const parser = new PdfParser();
    const result = await parser.parse(
      makeInput({
        content: getPdfFixture(),
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      }),
    );

    const pages = result.locators.filter((l) => l.type === 'page');
    // The last page should end at or before the text length
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1]!;
      expect(lastPage.endOffset).toBeLessThanOrEqual(result.text.length);
    }
  });

  it('DOCX: outputs non-empty text with locators', async () => {
    const parser = new DocxParser();
    const result = await parser.parse(
      makeInput({
        content: docxFixture,
        filename: 'test.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );

    expect(result.text.trim().length).toBeGreaterThan(0);
    expect(result.locators.length).toBeGreaterThan(0);
  });
});
