export interface VPNRequestInit {
  /** @default "GET" */
  method?: string
  headers: Record<string, string>
}

class FortiGateWebSSLVPN {
  constructor (
    private proxyID: string,
    private token: string,
    private origin: string
  ) {}
}

export default FortiGateWebSSLVPN;