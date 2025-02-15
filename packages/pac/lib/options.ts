export interface IOptions {
  allowIcannDomains: boolean;
  allowPrivateDomains: boolean;
  detectIp: boolean;
  extractHostname: boolean;
  mixedInputs: boolean;
  validHosts: string[] | null;
  validateHostname: boolean;
}
