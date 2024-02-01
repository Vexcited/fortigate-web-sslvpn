import net from "node:net";
import tls from "node:tls";

import { HTTPParser } from "http-parser-js";

const DEFAULT_HEADERS = {
  Connection: "close", // Close the socket after the response is received.
  Accept: "*/*" // Accept all types of content.
};

/**
 * A simple HTTP client that uses TLS, only
 * for Node.js.
 *
 * This is used to prevent an error that occurs
 * when parsing the response of the VPN.
 */
export const nodeRequestTLS = async (init: {
  href: string,
  method: string
  headers: Record<string, string>
  body?: string
}) => new Promise<{
  statusCode: number
  statusMessage: string
  headers: Headers
  body: Buffer
}>((resolve) => {
  const url = new URL(init.href);
  const port = parseInt(url.port || (url.protocol === "https:" ? "443" : "80"));
  const socket = url.protocol === "https:" ? tls.connect(port, url.host) : net.connect(port, url.host);

  socket.once("connect", () => {
    const shouldAppendBody = init.body && init.method !== "GET";

    const requestBuilder = [
      `${init.method} ${url.pathname + url.search + url.hash} HTTP/1.1`,
      `Host: ${url.host}`
    ];

    for (const [key, value] of Object.entries({ ...DEFAULT_HEADERS, ...init.headers })) {
      const lowerCased = key.toLowerCase();
      if (lowerCased === "content-length" || lowerCased === "host") continue;

      requestBuilder.push(key + ": " + value);
    }

    if (shouldAppendBody) {
      requestBuilder.push("Content-Length: " + init.body!.length);
    }

    requestBuilder.push(""); // Empty line to separate headers from body.

    // Add body if it exists.
    if (shouldAppendBody) {
      requestBuilder.push(init.body!);
    }

    // Add empty line to indicate end of request.
    requestBuilder.push("");

    socket.write(requestBuilder.join("\r\n"));
  });

  const bodyChunks: Buffer[] = [];
  const parser = new HTTPParser(HTTPParser.RESPONSE);
  let statusCode: number | undefined;
  let statusMessage: string | undefined;
  const headers = new Headers();

  parser[HTTPParser.kOnHeadersComplete] = function (res) {
    statusCode = res.statusCode;
    statusMessage = res.statusMessage;

    for (let i = 0; i < res.headers.length; i += 2) {
      headers.append(res.headers[i], res.headers[i + 1]);
    }
  };

  parser[HTTPParser.kOnBody] = function (chunk, offset, length) {
    bodyChunks.push(chunk.subarray(offset, offset + length));
  };

  parser[HTTPParser.kOnMessageComplete] = function () {
    socket.end();
  };

  socket.on("data", (chunk: Buffer) => {
    parser.execute(chunk);
  });

  socket.on("end", () => {
    parser.finish();

    resolve({
      statusCode: statusCode!,
      statusMessage: statusMessage!,
      headers,
      body: Buffer.concat(bodyChunks)
    });
  });
});
