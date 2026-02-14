/**
 * Custom error class for NTP synchronization related failures.
 * Provides structured error codes and better debugging experience.
 */
export class NtpSyncError extends Error {
    /** Unique code identifying the type of NTP failure */
    public readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'NtpSyncError';
        this.code = code;

        // Maintain proper prototype chain in ES5 environments
        Object.setPrototypeOf(this, NtpSyncError.prototype);
    }

    /**
     * Factory method: Timeout while waiting for NTP server response
     */
    public static timeout(server: string, timeoutMs: number): NtpSyncError {
        return new NtpSyncError(
            `NTP request to ${server} timed out after ${timeoutMs}ms`,
            'NTP_TIMEOUT'
        );
    }

    /**
     * Factory method: All configured NTP servers failed to respond successfully
     */
    public static allServersFailed(servers: readonly string[]): NtpSyncError {
        return new NtpSyncError(
            `All NTP servers failed (${servers.join(', ')})`,
            'NTP_ALL_SERVERS_FAILED'
        );
    }

    /**
     * Factory method: Network/socket related error (connection refused, unreachable, etc.)
     */
    public static networkError(server: string, originalError: Error): NtpSyncError {
        return new NtpSyncError(
            `Network error while contacting ${server}: ${originalError.message}`,
            'NTP_NETWORK_ERROR',
        );
    }

    /**
     * Factory method: Received invalid or malformed NTP packet
     */
    public static invalidPacket(server: string, reason: string): NtpSyncError {
        return new NtpSyncError(
            `Invalid NTP response from ${server}: ${reason}`,
            'NTP_INVALID_PACKET'
        );
    }

    /**
     * Factory method: Server replied with leap second warning or unsynchronized state
     */
    public static serverUnsynchronized(server: string, leapIndicator: number): NtpSyncError {
        const liText = leapIndicator === 3 ? 'alarm condition' : `leap indicator ${leapIndicator}`;
        return new NtpSyncError(
            `NTP server ${server} is unsynchronized (${liText})`,
            'NTP_SERVER_UNSYNCHRONIZED'
        );
    }

    /**
     * Factory method: Clock offset is unreasonably large (possible misconfiguration or attack)
     */
    public static excessiveOffset(server: string, offsetMs: number, thresholdMs: number): NtpSyncError {
        return new NtpSyncError(
            `Offset from ${server} is too large (${offsetMs.toFixed(0)}ms, threshold: ${thresholdMs}ms)`,
            'NTP_EXCESSIVE_OFFSET'
        );
    }
}

/**
 * Type guard to check if an unknown value is an NtpSyncError
 */
export function isNtpSyncError(error: unknown): error is NtpSyncError {
    return error instanceof NtpSyncError;
}