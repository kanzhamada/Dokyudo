export interface RegisterParams {
    email: string;
    password: string;
    recaptchaToken: string;
    clientIp: string;
    userAgent: string;
    requestId: string;
    logContext?: Record<string, any>;
}

export interface LoginParams {
    email: string;
    password: string;
    recaptchaToken: string;
    clientIp: string;
    userAgent: string;
    requestId: string;
    logContext?: Record<string, any>;
}

export interface LoginAttemptParams {
    email: string;
    ipAddress: string;
    userAgent: string;
    isSuccess: boolean;
    authProvider?: string;
}

export interface LogoutParams {
    accessToken: string;
    logContext?: Record<string, any>;
}