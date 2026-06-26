/** Shape of Google's siteverify API response */
export interface RecaptchaVerifyResponse {
    success: boolean;
    score?: number;
    action?: string;
    challenge_ts?: string;
    hostname?: string;
    "error-codes"?: string[];
}

/** Parameters for reCAPTCHA verification */
export interface VerifyRecaptchaParams {
    token: string;
    remoteIp?: string;
    expectedAction?: string;
}
