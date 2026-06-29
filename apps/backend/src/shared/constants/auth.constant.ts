export const AuthConstants = {
    /** Time window (in minutes) to evaluate failed login attempts */
    LOCKOUT_WINDOW_MINUTES: 15,
    /** Maximum allowed failed attempts before locking the account */
    MAX_FAILED_ATTEMPTS: 5,
    /** Duration (in minutes) for which the account remains locked */
    LOCKOUT_DURATION_MINUTES: 15,
};
