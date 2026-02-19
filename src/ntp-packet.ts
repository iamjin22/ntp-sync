/**
 * Constants used across NTP packet handling
 */
export const NTP_PORT = 123;
export const NTP_DEFAULT_SERVERS = ['pool.ntp.org', 'time.google.com', 'time.cloudflare.com'];
export const NTP_EPOCH_OFFSET = 2208988800; // seconds from 1900 to 1970
export const NTP_TIMESTAMP_SCALE = 4294967296; // 2^32

/**
 * Structured representation of an NTP packet (48-byte header)
 * Follows RFC 5905 basic format (no extensions/auth)
 */
export interface NtpPacket {
    leapIndicator: number;        // 0–3
    version: number;              // usually 4
    mode: number;                 // 3 = client
    stratum: number;              // 1–15, 16 = unsynchronized
    poll: number;                 // log2 seconds
    precision: number;            // log2 seconds (negative)
    rootDelay: number;            // fixed-point seconds
    rootDispersion: number;       // fixed-point seconds
    referenceId: string | number; // Stratum 1: ASCII ID, else IP/hash
    referenceTimestamp: number;   // seconds since 1900
    originTimestamp: number;      // T1 - client send time
    receiveTimestamp: number;     // T2 - server receive time
    transmitTimestamp: number;    // T3 - server transmit time
}

export interface NtpResponse {
    packet: NtpPacket;
    clientSendTime: Date;
    clientReceiveTime: Date;
    offsetMs: number;
    serverTime: Date;
    roundTripDelayMs: number;
    server: string;
}