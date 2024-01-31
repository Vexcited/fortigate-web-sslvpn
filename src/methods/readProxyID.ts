import { PORTAL_PATH, TOKEN_COOKIE } from "../utils/constants";
import isNode from "../utils/isNode"

export const readProxyID = async (token: string, origin: string): Promise<string> => {
  const url = `${origin}${PORTAL_PATH}`;
  const requestHeaders = { Cookie: `${TOKEN_COOKIE}=${token}` };

  let responseHeaders: Headers;
  let responseStatus: number;
  let responseText: string;

  if (isNode()) {
    const { nodeRequestTLS } = await import("../utils/httpTCP");

    const response = await nodeRequestTLS({
      method: "GET",
      href: url,
      headers: requestHeaders,
    });

    responseHeaders = response.headers;
    responseStatus = response.statusCode;
    responseText = response.body.toString("utf8");
  }
  else {
    const response = await fetch(url, {
      method: "GET",
      headers: requestHeaders,
    });

    responseHeaders = response.headers;
    responseStatus = response.status;
    responseText = await response.text();
  }

  // We do manual parsing, since the data can be malformed.
  // Remove all the white spaces for easier parsing.
  const data = responseText.replace(" ", "");

  const key = "fgt_sslvpn_sid"; // Key containing the proxy ID.
  const startIndex = data.indexOf(key) + key.length + 4; // `+ 4` for the `":"`
  const endIndex = data.indexOf('"', startIndex);

  return data.slice(startIndex, endIndex);
}