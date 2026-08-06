declare module "otplib" {
  export interface Authenticator {
    generateSecret(): string;
    keyuri(account: string, service: string, secret: string): string;
    verify(opts: { token: string; secret: string }): boolean;
  }
  export const authenticator: Authenticator;
}
