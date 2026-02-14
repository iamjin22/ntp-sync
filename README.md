# ntp-sync-ts

High-precision NTP client for Node.js (TypeScript).\
Supports multi-server fallback, custom packet injection, offset
calculation, and detailed diagnostics.

------------------------------------------------------------------------

## 🚀 Quick Start

``` ts
import { NtpSync } from 'ntp-sync';

async function main() {
  try {
    const response = await NtpSync.getNetworkTime();

    console.log('Accurate network time:', response.serverTime.toISOString());
    console.log('Local clock offset    :', response.offsetMs.toFixed(2), 'ms');
  } catch (err) {
    console.error('NTP synchronization failed:', err);
  }
}

main();
```

------------------------------------------------------------------------

## 📦 Installation

``` bash
npm install ntp-sync
```

------------------------------------------------------------------------

# 📘 API Overview

## `NtpSync.getNetworkTime(servers?, customPacket?, options?)`

``` ts
Promise<NtpResponse>
```

### Parameters

  -----------------------------------------------------------------------------------------------------------------------------------
  Parameter        Type                                Default                                                        Description
  ---------------- ----------------------------------- -------------------------------------------------------------- ---------------
  `servers`        `string[]`                          `['pool.ntp.org', 'time.google.com', 'time.cloudflare.com']`   List of servers
                                                                                                                      to try
                                                                                                                      (sequential
                                                                                                                      fallback)

  `customPacket`   `Partial<NtpPacket> \| NtpPacket`   ---                                                            Custom NTP
                                                                                                                      request packet
                                                                                                                      (overrides
                                                                                                                      defaults if
                                                                                                                      provided)

  `options`        `NtpQueryOptions`                   ---                                                            Configuration
                                                                                                                      object
  -----------------------------------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 📦 Return Type: `NtpResponse`

``` ts
interface NtpResponse {
  packet: NtpPacket;
  clientSendTime: Date;
  clientReceiveTime: Date;
  offsetMs: number;
  serverTime: Date;
  roundTripDelayMs: number;
  server: string;
}
```

------------------------------------------------------------------------

# 🧪 Usage Examples

## Basic Example

``` ts
import { NtpSync } from 'ntp-sync';

const response = await NtpSync.getNetworkTime();

console.log('Server Time:', response.serverTime.toISOString());
console.log('Offset:', response.offsetMs.toFixed(2), 'ms');
```

------------------------------------------------------------------------

## Custom Packet Example

``` ts
import { NtpSync, getCurrentNtpTimestamp } from 'ntp-sync';

const response = await NtpSync.getNetworkTime(undefined, {
  originTimestamp: getCurrentNtpTimestamp() - 7200,
  poll: 6,
  precision: -18
});

console.log('Offset:', response.offsetMs.toFixed(2), 'ms');
```

------------------------------------------------------------------------

# 📐 Offset & Delay Calculation (RFC 5905)

    offset = ((T2 - T1) + (T3 - T4)) / 2
    delay  = (T4 - T1) - (T3 - T2)

Where:

-   T1 = Client send time\
-   T2 = Server receive time\
-   T3 = Server transmit time\
-   T4 = Client receive time

------------------------------------------------------------------------

# 📜 License

MIT

------------------------------------------------------------------------

# 🤝 Contributing

Contributions are welcome!

-   Bug fixes\
-   New features\
-   Additional tests\
-   Documentation improvements

------------------------------------------------------------------------

Happy accurate timekeeping! ⏱️
