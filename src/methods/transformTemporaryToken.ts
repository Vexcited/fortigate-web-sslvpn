import { TMP_TOKEN_COOKIE, TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode";
import { readSetCookie } from "../utils/readSetCookie";

/**
 * @param temporaryToken The temporary token to transform into a real authentication one.
 * @param hostCheckURL Concatenation of the origin and the redirection URL from the login response.
 * @returns Authentication token to use in the cookies of every request.
 */
export const transformTemporaryToken = async (temporaryToken: string, hostCheckURL: string): Promise<string> => {
  const requestHeaders = { Cookie: `${TMP_TOKEN_COOKIE}=${temporaryToken}` };
  let responseHeaders: Headers;

  if (isNode()) {
    const { nodeRequestTLS } = await import("../utils/httpTCP");

    const response = await nodeRequestTLS({
      method: "GET",
      href: hostCheckURL,
      headers: requestHeaders,
    });

    responseHeaders = response.headers;
  }
  else {
    const response = await fetch(hostCheckURL, {
      method: "GET",
      headers: requestHeaders
    });

    responseHeaders = response.headers;
  }
  
  const token = readSetCookie(responseHeaders.get("set-cookie") ?? "", TOKEN_COOKIE);
  if (!token) throw new Error("FortiGate: Could not retrieve authentication token from response.");

  return token;
};
