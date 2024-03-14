import { LOGIN_PATH, TMP_TOKEN_COOKIE } from "../utils/constants";
import { readSetCookie } from "../utils/readSetCookie";
import isNode from "../utils/isNode";
import { RateLimited, WrongCredentials } from "../classes/Errors";

/** Logins to the web interface and returns the redirection path and temporary token. */
export const createLogin = async (username: string, password: string, origin: string): Promise<{
  redirectionPath: string
  tempToken: string
}> => {
  const url = `${origin}${LOGIN_PATH}`;
  const body = `ajax=1&username=${encodeURIComponent(username)}&realm=&credential=${encodeURIComponent(password)}`;
  const requestHeaders = {
    "Content-Type": "text/plain;charset=UTF-8",
    "Content-Length": body.length.toString()
  };

  let responseHeaders: Headers;
  let responseStatus: number;
  let responseText: string;

  if (isNode()) {
    const { nodeRequestTLS } = await import("../utils/httpTCP");

    const response = await nodeRequestTLS({
      method: "POST",
      href: url,
      headers: requestHeaders,
      body
    });

    responseHeaders = response.headers;
    responseStatus = response.statusCode;
    responseText = response.body.toString("utf8");
  }
  else {
    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body
    });

    responseHeaders = response.headers;
    responseStatus = response.status;
    responseText = await response.text();
  }

  const data = responseText.trim();
  const values = data.split(",").reduce((acc, curr) => {
    const [key, ...valueParts] = curr.split("=");
    acc[key] = valueParts.join("=");
    return acc;
  }, {} as Record<string, string>);

  if (responseStatus !== 200) throw new RateLimited();
  if (values.ret !== "1") {
    if (values.redir.indexOf("err=sslvpn_login_permission_denied") !== -1) throw new WrongCredentials();
    throw new Error(`FortiGate: Unknown error (${values.ret}:${values.redir})`);
  }

  // Read the magical cookie value.
  const temporaryToken = readSetCookie(responseHeaders.get("set-cookie") ?? "", TMP_TOKEN_COOKIE);
  if (!temporaryToken) throw new WrongCredentials();

  return {
    redirectionPath: values.redir,
    tempToken: temporaryToken
  };
};
