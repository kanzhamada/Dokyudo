export interface RegisterParams {
    email: string;
    password: string;
    recaptchaToken: string;
    clientIp: string;
    requestId: string;
}

export interface LoginParams {
    email: string;
    password: string;
    recaptchaToken: string;
    clientIp: string;
    userAgent: string;
    requestId: string;
}

export interface LoginAttemptParams {
    email: string;
    ipAddress: string;
    userAgent: string;
    isSuccess: boolean;
}