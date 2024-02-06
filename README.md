# `fortigate-web-sslvpn`

This module focuses on the **web mode** of FortiGate SSL VPN, if you are looking for the **tunnel mode** check out [`openfortivpn`](https://github.com/adrienverge/openfortivpn).

## Motivations

### What is the "web mode" ?

According to <https://docs.fortinet.com/document/fortigate/7.4.2/administration-guide/869159/ssl-vpn-best-practices>, web-only mode provides clientless network access using a web browser with built-in SSL encryption.

You can find a documentation about this mode at <https://docs.fortinet.com/document/fortigate/7.4.2/administration-guide/100733/ssl-vpn-web-mode>.

### Why use it over the "tunnel" mode ?

You may need a script to connect over a service through SSL VPN but you don't want to (or can't) setup FortiClient or `openfortivpn` on the machine running the script : this is where this module comes in handy.

In my case, I needed to connect to a service through SSL VPN from a serverless API. I couldn't use `openfortivpn` because it requires root access to setup the VPN tunnel. Also I would've only one connection at a time, while I needed multiple connections at the same time. In that case, using the "web mode" is the only solution.

## Installation

You can use any package manager you want, here are some examples:

```bash
# NPM
npm install fortigate-web-sslvpn

# Yarn
yarn add fortigate-web-sslvpn

# pnpm
pnpm add fortigate-web-sslvpn
```

## Usage

```typescript
import { initWebSSLVPNSession } from "fortigate-web-sslvpn";

// Authenticate and create a VPN session.
const vpn = await initWebSSLVPNSession(
  "username",
  "password",
  "https://sslvpn.example.com" // No trailing slash or path.
);

// Use the VPN session to make requests.
const response = await vpn.request("https://service.example.com", {
  method: "POST",
  body: JSON.stringify({ hello: "world" }),
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer DummyTokenForExample"
  }
});

// Returns a `Headers` object containing the response headers.
// Learn more at <https://developer.mozilla.org/docs/Web/API/Headers>
console.log(response.headers);

// Status code of the response as a number, e.g. `200`
console.log(response.status);

// The response body as a string.
console.log(response.data); // e.g. `{"hello":"world"}`

// You can also close the VPN session when you're done.
// Otherwise, it usually expires after 5 minutes.
await vpn.close();
```
