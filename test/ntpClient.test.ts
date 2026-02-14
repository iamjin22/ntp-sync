import { describe, it, expect, vi } from 'vitest'
import { NtpSync } from '../src'
import * as ntpUtils from '../src/ntp-utils'
import dgram from 'node:dgram'

// Mock dgram (UDP socket)
vi.mock('node:dgram', () => {
    const mockSocket = {
        on: vi.fn(),
        send: vi.fn((buf, port, host, cb) => cb(null)),
        close: vi.fn(),
    }

    return {
        default: {
            createSocket: vi.fn().mockReturnValue(mockSocket),
        },
    }
})

describe('NTP Client', () => {
    it('should fetch network time with custom packet', async () => {
        // Mock the socket 'message' event to simulate server response
        const mockSocket = (dgram.createSocket as any)()

        // Prepare fake server response buffer (minimal valid SNTP response)
        const fakeResponse = Buffer.alloc(48)
        fakeResponse[0] = 0x24          // LI=0, VN=4, Mode=4 (server)
        fakeResponse[1] = 2             // stratum = 2
        fakeResponse.writeInt32BE(0x000f4240, 4)   // root delay ~1ms (example)
        // ... you would normally fill more fields, especially timestamps

        // Simulate receiving response after send
        setTimeout(() => {
            const onMessageHandler = mockSocket.on.mock.calls.find(
                (call: any) => call[0] === 'message'
            )?.[1]

            if (onMessageHandler) {
                onMessageHandler(fakeResponse, { address: '127.0.0.1', port: 123, family: 'IPv4', size: 48 })
            }
        }, 10)

        const fakePacket = {
            stratum: 3,
            poll: 5,
            precision: -23,
            originTimestamp: ntpUtils.getCurrentNtpTimestamp(),
        }

        const response = await NtpSync.getNetworkTime(
            ['127.0.0.1'],  // use localhost to avoid real network
            fakePacket,
            { timeoutMs: 1000 }
        )

        expect(response).toBeDefined()
        expect(response.offsetMs).toBeGreaterThanOrEqual(-1000)
        expect(response.offsetMs).toBeLessThanOrEqual(1000)
        expect(response.server).toBe('127.0.0.1')
        expect(response.packet.stratum).toBeGreaterThan(0)  // at least something
    })
})