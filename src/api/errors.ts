export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId?: string;
  readonly details?: unknown;

  constructor(options: {
    message: string;
    code: string;
    status: number;
    retryable?: boolean;
    correlationId?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.correlationId = options.correlationId;
    this.details = options.details;
  }
}
