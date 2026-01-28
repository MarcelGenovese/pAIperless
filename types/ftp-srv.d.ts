/**
 * Type definitions for ftp-srv
 * https://github.com/autovance/ftp-srv
 */

declare module 'ftp-srv' {
  import { EventEmitter } from 'events';
  import { TlsOptions } from 'tls';

  export interface FtpServerOptions {
    url?: string;
    pasv_url?: string;
    pasv_min?: number;
    pasv_max?: number;
    anonymous?: boolean;
    greeting?: string | string[];
    tls?: boolean | TlsOptions;
    timeout?: number;
    blacklist?: string[];
    whitelist?: string[];
    file_format?: 'ls' | 'ep' | 'mlsd';
    log?: any;
  }

  export interface FtpConnection extends EventEmitter {
    close(): Promise<void>;
  }

  export class FtpSrv extends EventEmitter {
    constructor(options?: FtpServerOptions);
    listen(): Promise<void>;
    close(): Promise<void>;
    on(event: 'login', listener: (data: { connection: FtpConnection; username: string; password: string }, resolve: (options?: { root?: string; cwd?: string }) => void, reject: (error?: Error) => void) => void): this;
    on(event: 'client-error', listener: (connection: FtpConnection, context: any, error: Error) => void): this;
    on(event: 'disconnect', listener: (connection: FtpConnection) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    url: string;
  }

  export default FtpSrv;
}
