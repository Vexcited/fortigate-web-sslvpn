import { TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode";

export interface VPNRequestInit {
  /** @default "GET" */
  method?: string
  headers?: Record<string, string>
  body?: string
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

  async request (url: string, init: VPNRequestInit): Promise<VPNResponse> {
    const { method = "GET", headers = {}, body } = init;
    const parsedURL = new URL(url);
    const requestURL = `${this.origin}/proxy/${this.proxyID}/${parsedURL.protocol.slice(0, -1)}/${parsedURL.host + parsedURL.pathname + parsedURL.search + parsedURL.hash}`;

    let responseHeaders: Headers;
    let responseStatus: number;
    let responseText: string;

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
      responseText = response.body.toString("utf8");
    }
    else {
      const response = await fetch(requestURL, {
        method,
        headers,
        body: method === "GET" ? void 0 : body
      });

      responseText = await response.text();
      responseHeaders = response.headers;
      responseStatus = response.status;
    }

    return {
      headers: responseHeaders,
      status: responseStatus,
      data: responseText
    };
  }
}

export default FortiGateWebSSLVPN;
