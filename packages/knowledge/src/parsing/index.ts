// ---------------------------------------------------------------------------
// Parsing module — barrel exports
// ---------------------------------------------------------------------------

export type {
  Locator,
  LocatorType,
  ParsedMetadata,
  ParsedDocument,
  ParserInput,
  Parser,
  ParserCategory,
} from './types.js';

export { ParserError, findParser, unsupportedFormatError } from './types.js';

export { PlainTextParser, plainTextParser } from './plain-text-parser.js';
export { PdfParser, pdfParser } from './pdf-parser.js';
export { DocxParser, docxParser } from './docx-parser.js';

export type { ExtractionLimits, CreateExtractionStageOptions } from './extraction-stage.js';
export { createExtractionStage } from './extraction-stage.js';
