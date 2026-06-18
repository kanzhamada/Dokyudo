export interface AppEnv {
    Variables: {
        requestId: string;
        logContext: Record<string, any>;
    };
}