import { NETWORK_TOKEN_COOKIE, TOKEN_COOKIE } from "../utils/constants";
import { encode } from "../utils/encoding";
import isNode from "../utils/isNode";
import FortiGateWebSSLVPN from "./FortiGateWebSSLVPN";

export interface FileData {
  /** Encoded name. */
  name: string

  /** Decoded name. */
  newName: string

  /** A number describing the type of the file. */
  type: string

  /** @example "Sat Jan 13 21:19:05 2024\\n" */
  dateModified: string

  pathType: "file_desc" | "folder_desc"

  /**
   * JavaScript function used in the original HTML page.
   * Useless in this package.
   */
  href: string

  /**
   * Empty string on folders.
   * @example "402"
   */
  size: string
}

class FileEntry {
  public name: string;
  public path: string;
  public lastModified: Date;
  /** `0` when it's a folder. */
  public size: number;
  public type: number;

  constructor (
    private client: FortiGateWebSSLVPN,
    public parentPath: string,
    raw: FileData,
    private token: string,
    private domain: string
  ) {
    this.name = raw.newName;
    this.path = `${parentPath}/${raw.newName}`;
    this.lastModified = new Date(raw.dateModified.replace(/\\n/g, ""));
    this.size = parseInt(raw.size || "0");
    this.type = parseInt(raw.type);
  }

  public async enterFolder (): Promise<FileEntry[]> {
    if (this.type !== 5) throw new Error("This file is not a folder.");

    const method = "POST";
    const href = `${this.client.origin}/remote/network`;
    const headers = {
      Cookie: `${TOKEN_COOKIE}=${this.client.token}; ${NETWORK_TOKEN_COOKIE}=${this.token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const body = `protocol=smb&path=${encode(this.path)}&workpath=${encode(this.parentPath)}&rootpath=${encode(this.parentPath)}&domain=${encode(this.domain)}&type=${this.type}&type_flag=`;
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

    const stringIndex = responseText.indexOf("var s = ") + 9;
    const stringEndIndex = responseText.indexOf("fgt_data = ", stringIndex) - 3;
    const rawJSON = responseText.slice(stringIndex, stringEndIndex);
    const json = JSON.parse(rawJSON) as Array<FileData>;

    return json.map((file) => new FileEntry(this.client, this.path, file, this.token, this.domain));
  }

}

export default FileEntry;
