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

export interface ForgetPasswordParams {
    email: string;
    recaptchaToken: string;
    clientIp: string;
    userAgent: string;
    requestId: string;
    logContext?: Record<string, any>;
}

export interface ResetPasswordParams {
    email: string;
    otp: string;
    newPassword: string;
    clientIp: string;
    userAgent: string;
    requestId: string;
    logContext?: Record<string, any>;
}

export interface UpdatePasswordParams {
    accessToken: string;
    newPassword: string;
    logContext?: Record<string, any>;
}
