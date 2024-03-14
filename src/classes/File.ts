import { NETWORK_TOKEN_COOKIE, TOKEN_COOKIE } from "../utils/constants";
import { encode } from "../utils/encoding";
import isNode from "../utils/isNode";
import readNetworkFiles from "../utils/readNetworkFiles";
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
  /** `0` when it's a directory. */
  public size: number;
  public type: number;

  constructor (
    private client: FortiGateWebSSLVPN,
    parentPath: string,
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

  public async readDirectory (): Promise<FileEntry[]> {
    if (this.type !== 5) throw new Error("This file is not a directory.");
    return this.client.readDirectoryFromSMB(this.path, this.domain, this.token);
  }

  // public async downloadFile (): Promise<string> {
  //   if (this.type !== 6) throw new Error("This file is not a file.");
  //   const directory = this.path.split("/")

  //   return this.client.downloadFileFromSMB(this.path, this.domain, this.token);
  // }
}

export default FileEntry;
