import os from 'os';
import { NTP_EPOCH_OFFSET, NTP_TIMESTAMP_SCALE, NtpPacket } from './ntp-packet';
/**
 * Get current system time as NTP timestamp (seconds since 1900-01-01)
 */
export function getCurrentNtpTimestamp(): number {
    return Date.now() / 1000 + NTP_EPOCH_OFFSET;
}

/**
 * Write 64-bit NTP timestamp (32s + 32fraction) to buffer
 */
export function writeNtpTimestamp(buffer: Buffer, timestamp: number, offset: number): void {
    const seconds = Math.floor(timestamp);
    const fraction = Math.floor((timestamp - seconds) * NTP_TIMESTAMP_SCALE);

    buffer.writeUInt32BE(seconds, offset);
    buffer.writeUInt32BE(fraction, offset + 4);
}

/**
 * Read 64-bit NTP timestamp from buffer
 */
export function readNtpTimestamp(buffer: Buffer, offset: number): number {
    const seconds = buffer.readUInt32BE(offset);
    const fraction = buffer.readUInt32BE(offset + 4) / NTP_TIMESTAMP_SCALE;
    return seconds + fraction;
}

/**
 * Convert NTP seconds → JavaScript Date
 */
export function ntpTimestampToDate(ntpSeconds: number): Date {
    const unixMs = (ntpSeconds - NTP_EPOCH_OFFSET) * 1000;
    return new Date(unixMs);
}

/**
 * Serialize NTP packet object to 48-byte UDP payload
 */
export function serializeNtpPacket(packet: NtpPacket): Buffer {
    const buf = Buffer.alloc(48, 0);

    // LI VN Mode
    buf[0] = (packet.leapIndicator << 6) | (packet.version << 3) | packet.mode;

    buf[1] = packet.stratum;
    buf[2] = packet.poll & 0xff;
    buf[3] = packet.precision & 0xff;

    // Root delay & dispersion (scaled to fixed-point 16.16)
    buf.writeInt32BE(Math.round(packet.rootDelay * 65536), 4);
    buf.writeInt32BE(Math.round(packet.rootDispersion * 65536), 8);

    // Reference ID
    if (typeof packet.referenceId === 'string') {
        buf.write(packet.referenceId.padEnd(4, '\0'), 12, 4, 'ascii');
    } else {
        buf.writeUInt32BE(packet.referenceId >>> 0, 12);
    }

    writeNtpTimestamp(buf, packet.referenceTimestamp, 16);
    writeNtpTimestamp(buf, packet.originTimestamp, 24);
    writeNtpTimestamp(buf, packet.receiveTimestamp, 32);
    writeNtpTimestamp(buf, packet.transmitTimestamp, 40);

    return buf;
}

/**
 * Parse 48-byte NTP response into structured object
 */
export function deserializeNtpPacket(buffer: Buffer): NtpPacket {
    if (buffer.length < 48) {
        throw new Error('Invalid NTP packet: length < 48 bytes');
    }

    const refIdStr = buffer.toString('ascii', 12, 16).replace(/\0+$/, '');

    return {
        leapIndicator: (buffer[0] >> 6) & 0x03,
        version: (buffer[0] >> 3) & 0x07,
        mode: buffer[0] & 0x07,
        stratum: buffer[1],
        poll: buffer[2],
        precision: buffer.readInt8(3),
        rootDelay: buffer.readInt32BE(4) / 65536,
        rootDispersion: buffer.readInt32BE(8) / 65536,
        referenceId: buffer[1] <= 1 ? refIdStr : buffer.readUInt32BE(12),
        referenceTimestamp: readNtpTimestamp(buffer, 16),
        originTimestamp: readNtpTimestamp(buffer, 24),
        receiveTimestamp: readNtpTimestamp(buffer, 32),
        transmitTimestamp: readNtpTimestamp(buffer, 40),
    };
}

/**
 * Estimate system timer resolution using process.hrtime.bigint()
 * Returns estimated resolution in nanoseconds.
 */
export function estimateSystemResolution(iterations = 100000): number {
    let minDiff = BigInt(Number.MAX_SAFE_INTEGER);
    let prev = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
        const now = process.hrtime.bigint();
        const diff = now - prev;

        if (diff > 0n && diff < minDiff) {
            minDiff = diff;
        }

        prev = now;
    }

    return Number(minDiff); // nanoseconds
}

/**
 * Convert system resolution (ns) to NTP precision value.
 * precision = floor(log2(resolution_seconds))
 */
export function calculateNtpPrecision(resolutionNs: number): number {
    const resolutionSeconds = resolutionNs / 1e9;
    return Math.floor(Math.log2(resolutionSeconds));
}

/**
 * Clamp precision to requested OS ranges
 */
function clampPrecisionByOS(precision: number): number {
    const platform = os.platform();

    if (platform === 'win32') {
        // Windows: -6 ~ -10
        return clamp(precision, -10, -6);
    }

    if (platform === 'linux') {
        // Linux: -11 ~ -18
        return clamp(precision, -18, -11);
    }

    if (platform === 'darwin') {
        // macOS: -19 ~ -23
        return clamp(precision, -23, -19);
    }

    // Fallback safe range
    return clamp(precision, -25, -24);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Automatically estimate and return NTP precision value.
 */
export function getAutoNtpPrecision(): number {
    const resolutionNs = estimateSystemResolution();
    const rawPrecision = calculateNtpPrecision(resolutionNs);
    return clampPrecisionByOS(rawPrecision);
}
