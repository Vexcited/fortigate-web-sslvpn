import { NETWORK_TOKEN_COOKIE, TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode";
import { encode } from "../utils/encoding";
import FileEntry, { FileData } from "./File";
import { readSetCookie } from "../utils/readSetCookie";

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
    public token: string,
    public origin: string
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

  /**
   * Creates a SMB session with the VPN.
   */
  public async readSMB (path: string, domain: string, credentials: {
    username: string
    password: string
  }): Promise<FileEntry[]> {
    // Remove trailing slash from path.
    if (path.endsWith("/")) path = path.slice(0, -1);

    const method = "POST";
    const href = `${this.origin}/remote/network`;
    const body = `fsuser=${encodeURIComponent(credentials.username)}&fspwd=${encodeURIComponent(credentials.password)}&login=Login&protocol=smb&rootpath=${encode(path)}&pname=fortigate-web-sslvpn(${Date.now()})&domain=${encode(domain)}`;

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `${TOKEN_COOKIE}=${this.token}`
    };

    let responseHeaders: Headers;
    let responseText: string;

    if (isNode()) {
      const { nodeRequestTLS } = await import("../utils/httpTCP");

      const response = await nodeRequestTLS({
        href,
        method,
        headers,
        body
      });

      responseHeaders = response.headers;
      responseText = response.body.toString("utf-8");
    }
    else {
      const response = await fetch(href, {
        method,
        headers,
        body
      });

      responseHeaders = response.headers;
      responseText = await response.text();
    }

    // Read the magical cookie value.
    const token = readSetCookie(responseHeaders.get("set-cookie") ?? "", NETWORK_TOKEN_COOKIE);
    if (!token) throw new Error("FortiGate: Temporary token cookie not found, can happen when you've entered invalid credentials.");

    const stringIndex = responseText.indexOf("var s = ") + 9;
    const stringEndIndex = responseText.indexOf("fgt_data = ", stringIndex) - 3;
    const rawJSON = responseText.slice(stringIndex, stringEndIndex);
    const json = JSON.parse(rawJSON) as Array<FileData>;

    return json.map((file) => new FileEntry(this, path, file, token, domain));
  }
}

export default FortiGateWebSSLVPN;
