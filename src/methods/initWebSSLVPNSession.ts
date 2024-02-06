import { createLogin } from "./createLogin";
import { transformTemporaryToken } from "./transformTemporaryToken";
import FortiGateWebSSLVPN from "../classes/FortiGateWebSSLVPN";
import { readProxyID } from "./readProxyID";

/**
 * Entry point to create a new `FortiGateWebSSLVPN` instance.
 * This method will authenticate the user on the provided origin.
 */
export const initWebSSLVPNSession = async (username: string, password: string, origin: string): Promise<FortiGateWebSSLVPN> => {
  // Remove trailing slash from origin, if exists.
  origin = origin.replace(/\/$/, "");
  const { redirectionPath, tempToken } = await createLogin(username, password, origin);

  const token = await transformTemporaryToken(tempToken, origin + redirectionPath);
  return new FortiGateWebSSLVPN(token, origin);
};
