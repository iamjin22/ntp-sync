import dgram from 'node:dgram';
import { NtpSyncError } from './ntp-errors';
import {
    deserializeNtpPacket,
    getAutoNtpPrecision,
    getCurrentNtpTimestamp,
    ntpTimestampToDate,
    serializeNtpPacket,
} from './ntp-utils';
import { NTP_DEFAULT_SERVERS, NTP_PORT, NtpPacket, NtpResponse } from './ntp-packet';

export interface NtpQueryOptions {
    port?: number;
    timeoutMs?: number;
    maxAcceptableOffsetMs?: number;
}

/**
 * Modern, robust NTP client with fallback, proper offset calculation,
 * and structured error handling.
 */
export class NtpSync {
    /**
     * Query a single NTP server and return the computed network time
     */
    private static async queryServer(
        server: string,
        customPacket: Partial<NtpPacket> | NtpPacket | undefined,
        options: Required<NtpQueryOptions>
    ): Promise<NtpResponse> {
        return new Promise((resolve, reject) => {
            const socket = dgram.createSocket('udp4');

            let packet: NtpPacket;

            if (customPacket) {
                packet = {
                    leapIndicator: 0,
                    version: 4,
                    mode: 3,                    // client
                    stratum: 0,
                    poll: 4,
                    precision: getAutoNtpPrecision(),
                    rootDelay: 0,
                    rootDispersion: 0,
                    referenceId: 0,
                    referenceTimestamp: 0,
                    originTimestamp: getCurrentNtpTimestamp(),
                    receiveTimestamp: 0,
                    transmitTimestamp: 0,
                    ...customPacket,
                };

                if (customPacket.originTimestamp === undefined) {
                    packet.originTimestamp = getCurrentNtpTimestamp();
                }
            } else {
                packet = {
                    leapIndicator: 0,
                    version: 4,
                    mode: 3,
                    stratum: 0,
                    poll: 0,
                    precision: getAutoNtpPrecision(),
                    rootDelay: 0,
                    rootDispersion: 0,
                    referenceId: 0,
                    referenceTimestamp: 0,
                    originTimestamp: getCurrentNtpTimestamp(),
                    receiveTimestamp: 0,
                    transmitTimestamp: 0,
                };
            }

            const request = serializeNtpPacket(packet);
            const t1 = Date.now();

            const timeout = setTimeout(() => {
                socket.close();
                reject(NtpSyncError.timeout(server, options.timeoutMs));
            }, options.timeoutMs);

            socket.on('message', (msg) => {
                const t4 = Date.now();         // client receive
                clearTimeout(timeout);
                socket.close();

                let reply: NtpPacket;
                try {
                    reply = deserializeNtpPacket(msg);
                } catch (err) {
                    reject(NtpSyncError.invalidPacket(server, (err as Error).message));
                    return;
                }

                if (reply.leapIndicator === 3 || reply.stratum >= 16) {
                    reject(NtpSyncError.serverUnsynchronized(server, reply.leapIndicator));
                    return;
                }

                const t2 = ntpTimestampToDate(reply.receiveTimestamp).getTime();   // server receive
                const t3 = ntpTimestampToDate(reply.transmitTimestamp).getTime(); // server transmit

                const offset = (t2 - t1 + t3 - t4) / 2;
                const roundTrip = (t4 - t1) - (t3 - t2); // or (t4 - t1)

                if (Math.abs(offset) > options.maxAcceptableOffsetMs) {
                    reject(NtpSyncError.excessiveOffset(server, offset, options.maxAcceptableOffsetMs));
                    return;
                }

                const serverTimeMs = t4 + offset;

                resolve({
                    packet: reply,
                    clientSendTime: new Date(t1),
                    clientReceiveTime: new Date(t4),
                    offsetMs: offset,
                    serverTime: new Date(serverTimeMs),
                    roundTripDelayMs: roundTrip,
                    server,
                });
            });

            socket.on('error', (err) => {
                clearTimeout(timeout);
                socket.close();
                reject(NtpSyncError.networkError(server, err));
            });

            socket.send(request, options.port, server, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    socket.close();
                    reject(NtpSyncError.networkError(server, err));
                }
            });
        });
    }

    /**
     * Get accurate network time, automatically falling back between servers
     */
    public static async getNetworkTime(
        servers: string[] = [],
        customPacket?: Partial<NtpPacket> | NtpPacket,
        options: NtpQueryOptions = {}
    ): Promise<NtpResponse> {
        const allServers = [...servers, ...NTP_DEFAULT_SERVERS]

        const opts: Required<NtpQueryOptions> = {
            port: options.port ?? NTP_PORT,
            timeoutMs: options.timeoutMs ?? 5000,
            maxAcceptableOffsetMs: options.maxAcceptableOffsetMs ?? 30000,
        };

        const errors: string[] = [];

        for (const server of allServers) {
            try {
                return await NtpSync.queryServer(server, customPacket, opts);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                errors.push(`${server}: ${msg}`);
                console.warn(`[ntp-sync] ${server} failed → ${msg}`);
            }
        }

        throw NtpSyncError.allServersFailed(allServers);
    }
}