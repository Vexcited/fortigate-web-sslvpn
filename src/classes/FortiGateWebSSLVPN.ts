import { TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode";

export interface VPNRequestInit {
  /** @default "GET" */
  method?: string
  headers?: Record<string, string>
  body?: string

  /** @default "utf-8" */
  encoding?: string
}

export interface VPNResponse {
  headers: Headers
  status: number
  data: string
}

class FortiGateWebSSLVPN {
  constructor (
    private proxyID: string,
    private token: string,
    private origin: string
  ) {}

  public async request (url: string, init: VPNRequestInit): Promise<VPNResponse> {
    const { method = "GET", headers = {}, body, encoding = "utf-8" } = init;
    const parsedURL = new URL(url);
    const requestURL = `${this.origin}/proxy/${this.proxyID}/${parsedURL.protocol.slice(0, -1)}/${parsedURL.host + parsedURL.pathname + parsedURL.search + parsedURL.hash}`;

    let responseHeaders: Headers;
    let responseStatus: number;
    let responseBuffer: ArrayBuffer | Buffer;

    const authenticationCookie = `${TOKEN_COOKIE}=${this.token}`;
    if (headers.Cookie) headers.Cookie += `; ${authenticationCookie}`;
    else headers.Cookie = authenticationCookie;

    if (isNode()) {
      const { nodeRequestTLS } = await import("../utils/httpTCP");

      const response = await nodeRequestTLS({
        method,
        href: requestURL,
        headers,
        body
      });

      responseHeaders = response.headers;
      responseStatus = response.statusCode;
      responseBuffer = response.body;
    }
    else {
      const response = await fetch(requestURL, {
        method,
        headers,
        body: method === "GET" ? void 0 : body
      });

      responseBuffer = await response.arrayBuffer();
      responseHeaders = response.headers;
      responseStatus = response.status;
    }

    const decoder = new TextDecoder(encoding);
    const responseText = decoder.decode(responseBuffer);

    return {
      headers: responseHeaders,
      status: responseStatus,
      data: responseText
    };
  }

  /**
   * Logs out of the VPN session.
   * @returns `true` if the logout was successful, `false` otherwise.
   */
  public async close (): Promise<boolean> {
    const method = "GET";
    const href = `${this.origin}/remote/logout`;
    const headers = { Cookie: `${TOKEN_COOKIE}=${this.token}` };

    let statusCode: number;

    if (isNode()) {
      const { nodeRequestTLS } = await import("../utils/httpTCP");

      const response = await nodeRequestTLS({
        href,
        method,
        headers
      });

      statusCode = response.statusCode;
    }
    else {
      const response = await fetch(href, {
        method,
        headers
      });

      statusCode = response.status;
    }

    return statusCode === 200;
  }
}

export default FortiGateWebSSLVPN;
