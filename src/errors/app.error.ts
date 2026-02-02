export enum ErrorCode {
  INVALID_SOURCE = 'INVALID_SOURCE',
  SEC_API_ERROR = 'SEC_API_ERROR',
  XML_PARSE_ERROR = 'XML_PARSE_ERROR',
  NO_FILINGS_FOUND = 'NO_FILINGS_FOUND',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ErrorCode.INVALID_SOURCE, message, 400);
    this.name = 'ValidationError';
  }
}

export class SECAPIError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(ErrorCode.SEC_API_ERROR, message, 500, originalError);
    this.name = 'SECAPIError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(ErrorCode.TIMEOUT_ERROR, message, 504, originalError);
    this.name = 'TimeoutError';
  }
}
