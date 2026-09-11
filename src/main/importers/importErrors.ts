export type RosterImportErrorCode =
  | 'READ_FAILED'
  | 'PARSE_FAILED'
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_FILE';

export class RosterImportError extends Error {
  readonly code: RosterImportErrorCode;

  constructor(code: RosterImportErrorCode, message: string) {
    super(message);
    this.name = 'RosterImportError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
