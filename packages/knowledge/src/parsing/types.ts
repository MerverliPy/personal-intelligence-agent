// ---------------------------------------------------------------------------
// Parser interface and normalized document model
// ---------------------------------------------------------------------------
// Per FR-ING-006: Parsing MUST retain page, section, heading, paragraph,
// table, and character locators when available.
// ---------------------------------------------------------------------------

/**
 * Structural locator within a parsed document.
 *
 * Every locator references a continuous span of character offsets
 * within the normalized full-text output.
 */
export interface Locator {
  /** Type of structural element. */
  readonly type: LocatorType;
  /** Zero-based ordinal within the document for this locator type. */
  readonly ordinal: number;
  /** Zero-based character offset where this element starts. */
  readonly startOffset: number;
  /** Zero-based character offset where this element ends (exclusive). */
  readonly endOffset: number;
  /** Optional display title (e.g. heading text, page label). */
  readonly title?: string;
  /** Hierarchy level (1 = top-level heading, 2 = sub-heading, etc.). */
  readonly level?: number;
  /** Additional format-specific metadata. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Recognised structural element types.
 */
export type LocatorType =
  | 'page'
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'table'
  | 'list'
  | 'list_item'
  | 'line';

/**
 * Metadata produced during parsing.
 */
export interface ParsedMetadata {
  /** Number of pages (1 for non-paginated formats). */
  readonly pageCount?: number;
  /** Number of paragraphs. */
  readonly paragraphCount?: number;
  /** Total number of characters in the extracted text. */
  readonly characterCount?: number;
  /** The IANA media type that was parsed. */
  readonly format: string;
  /** The parser implementation identifier. */
  readonly parserId: string;
  /** The parser implementation version. */
  readonly parserVersion: string;
  /** Wall-clock time spent parsing in milliseconds. */
  readonly parsingTimeMs: number;
  /** Format-specific metadata (e.g. PDF producer, DOCX author). */
  readonly sourceMetadata?: Record<string, unknown>;
}

/**
 * Normalized output from a successful parse operation.
 *
 * All character offsets in locators are relative to `text`.
 */
export interface ParsedDocument {
  /** Full normalized text content. */
  readonly text: string;
  /** Structural locators within the text. */
  readonly locators: Locator[];
  /** Parse metadata. */
  readonly metadata: ParsedMetadata;
}

// ---------------------------------------------------------------------------
// Parser contract
// ---------------------------------------------------------------------------

/**
 * Input provided to a {@link Parser.parse} call.
 */
export interface ParserInput {
  /** Raw file content as a buffer. */
  readonly content: Buffer;
  /** Original filename (used for extension-based detection fallback). */
  readonly filename: string;
  /** MIME type as detected by the storage layer. */
  readonly mimeType: string;
  /** Maximum allowed file size in bytes. */
  readonly maxSizeBytes: number;
  /** Maximum wall-clock time for parsing in milliseconds. */
  readonly timeoutMs: number;
}

/**
 * Error thrown when parsing encounters a non-recoverable condition.
 */
export class ParserError extends Error {
  /** Machine-readable reason code. */
  public readonly reasonCode: string;
  /** The parser that threw this error, if known. */
  public readonly parserId?: string | undefined;

  constructor(message: string, reasonCode: string, parserId?: string) {
    super(message);
    this.name = 'ParserError';
    this.reasonCode = reasonCode;
    this.parserId = parserId;
  }
}

/**
 * Abstraction over a document format parser.
 *
 * Implementations MUST NOT perform network access and MUST respect
 * the configured resource limits (size, time).
 */
export interface Parser {
  /** Stable identifier for this parser (e.g. `"pdf-v1"`). */
  readonly id: string;
  /** Semantic version of this parser implementation. */
  readonly version: string;
  /** IANA media types this parser supports. */
  readonly supportedMimeTypes: readonly string[];
  /** File extensions this parser supports (for format detection fallback). */
  readonly supportedExtensions: readonly string[];

  /**
   * Parse a single document into normalized text and locators.
   *
   * @throws {@link ParserError} when the input is malformed, encrypted,
   *         or cannot be parsed for any other non-transient reason.
   */
  parse(input: ParserInput): Promise<ParsedDocument>;

  /**
   * Returns `true` when this parser claims to support the given input
   * based on MIME type or filename extension.
   */
  canParse(mimeType: string, filename: string): boolean;
}

// ---------------------------------------------------------------------------
// Parser registry
// ---------------------------------------------------------------------------

/**
 * Registered category of a parser, used for coarse-grained selection.
 */
export type ParserCategory = 'text' | 'pdf' | 'office';

/**
 * Selects a parser for the given input.
 *
 * Returns `undefined` when no registered parser supports the input.
 */
export function findParser(input: ParserInput, parsers: readonly Parser[]): Parser | undefined {
  return parsers.find((p) => p.canParse(input.mimeType, input.filename));
}

/**
 * Returns a standard ParserError for unsupported input types.
 */
export function unsupportedFormatError(input: ParserInput): ParserError {
  return new ParserError(
    `Unsupported format: ${input.mimeType || input.filename}`,
    'UNSUPPORTED_FORMAT',
  );
}
