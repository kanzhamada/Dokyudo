export type ErrorCode =
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "FEATURE_DISABLED"
    | "RATE_LIMIT_EXCEEDED"
    | "QUOTA_EXCEEDED"
    | "DOCUMENT_NOT_READY"
    | "PROVIDER_UNAVAILABLE"
    | "INTERNAL_ERROR";

interface AppErrorOptions {
    code: ErrorCode;
    message: string;
    status: number;
    retryAfter?: number;
}

export class AppError extends Error {
    readonly code: ErrorCode;
    readonly status: number;
    readonly retryAfter?: number;

    constructor({ code, message, status, retryAfter }: AppErrorOptions) {
        super(message);
        this.code = code;
        this.status = status;
        this.retryAfter = retryAfter;
    }

    toJSON(requestId: string) {
        return {
            error: {
                code: this.code,
                message: this.message,
                ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
                requestId,
            },
        };
    }
}
