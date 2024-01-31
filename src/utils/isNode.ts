/**
 * Should return `true` ONLY when running in Node.JS environment.
 * `false` has been tested in browser, Deno and Bun.
 */
export default function isNode (): boolean {
  return typeof process !== "undefined" && typeof process?.versions?.node === "string" && typeof process?.versions?.bun === "undefined";
}
