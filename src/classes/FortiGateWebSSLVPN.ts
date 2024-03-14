import { NETWORK_TOKEN_COOKIE, TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode";
import { encode } from "../utils/encoding";
import FileEntry, { FileData } from "./File";
import { readSetCookie } from "../utils/readSetCookie";
import readNetworkFiles from "../utils/readNetworkFiles";
import { readProxyID } from "../methods/readProxyID";
import { AccessDeniedSMB } from "./Errors";

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
  public proxyID: string | undefined;

  constructor (
    public token: string,
    public origin: string
  ) {}

  public async request (url: string, init: VPNRequestInit): Promise<VPNResponse> {
    if (!this.proxyID) { // Read the proxy ID if it's not already set.
      this.proxyID = await readProxyID(this.token, this.origin);
    }

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
  public async initSMB (path: string, domain: string, credentials: {
    username: string
    password: string
  }): Promise<{
    /** Files contained in the path given. */
      files: FileEntry[]
      /** Token that can be used to do more requests to the SMB without initializing a new session. */
      token: string
    }> {
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

    const json = readNetworkFiles(responseText);

    return {
      files: json.map((file) => new FileEntry(this, path, file, token, domain)),
      token
    };
  }

  /**
   * A way to read a directory from an SMB drive using the VPN.
   * @param token - Obtained using `.initSMB()`. Just read the `token` property in the returned object.
   *
   * @example
   * // You can use this to recover a full session from tokens
   * const vpn = new FortiGateWebSSLVPN("VPN_TOKEN_STILL_AVAILABLE", "https://ssl-vpn.example.com");
   * const files = await vpn.readDirectoryFromSMB("//smb.example.com/some/path", "AD", "SMB_TOKEN");
   */
  public async readDirectoryFromSMB (path: string, domain: string, token: string) {
    const method = "POST";
    const href = `${this.origin}/remote/network`;
    const headers = {
      Cookie: `${TOKEN_COOKIE}=${this.token}; ${NETWORK_TOKEN_COOKIE}=${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const body = `protocol=smb&path=${encode(path)}&rootpath=${encode(path)}&workpath=${encode(path)}&domain=${encode(domain)}&type=5&type_flag=`;
    let responseText: string;

    if (isNode()) {
      const { nodeRequestTLS } = await import("../utils/httpTCP");

      const response = await nodeRequestTLS({
        href,
        method,
        headers,
        body
      });

      responseText = response.body.toString("utf-8");
    }
    else {
      const response = await fetch(href, {
        method,
        headers,
        body
      });


      responseText = await response.text();
    }

    // This script is injected in the HTML page, whenever the access is denied.
    if (responseText.includes("alert(fgt_lang['sslvpn_networkplaces_err_access_dir'])"))
      throw new AccessDeniedSMB();

    const files = readNetworkFiles(responseText);
    return files.map((file) => new FileEntry(this, path, file, this.token, domain));
  }

  /**
   * Get the binary data of a file from an SMB drive using the web VPN.
   * This function is available as a quick helper in SMB's `FileEntry` instances.
   *
   * @example
   * const rootPath = "//smb.example.com/a/folder";
   * const fileName = "Some file.txt"; // should be in the `rootPath`
   * const domain = "AD";
   *
   * const binary = await vpn.downloadFileFromSMB(rootPath, fileName, domain, SMB_TOKEN);
   * // can throw a `AccessDeniedSMB` error if the file is not accessible.
   */
  public async downloadFileFromSMB (rootPath: string, fileName: string, domain: string, token: string) {
    const method = "POST";
    const href = `${this.origin}/remote/network/download`;
    const headers = {
      Cookie: `${TOKEN_COOKIE}=${this.token}; ${NETWORK_TOKEN_COOKIE}=${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const body = `protocol=smb&path=${encode(rootPath)}&rootpath=${encode(rootPath)}&filename=${encode(encodeURIComponent(fileName))}&domain=${encode(domain)}&type=6`;
    let responseText: string;

    if (isNode()) {
      const { nodeRequestTLS } = await import("../utils/httpTCP");

      const response = await nodeRequestTLS({
        href,
        method,
        headers,
        body
      });

      responseText = response.body.toString("utf-8");
    }
    else {
      const response = await fetch(href, {
        method,
        headers,
        body
      });

      responseText = await response.text();
    }

    return responseText;
  }
}

export default FortiGateWebSSLVPN;
