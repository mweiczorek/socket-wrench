/// <reference types="node" />

export interface ServerOptions {
  localhostOnly?: boolean;
  clientRejectionMessage?: string;
  logActivity?: boolean;
  ipStack?: 4 | 6;
  encoding?: string;
}
export declare class Server {
  constructor(port: number, options?: ServerOptions);
  acceptAny(callback: (data: string) => string | object): Server;
  accept(directive: string, callback: () => string | object): Server;
  onStart(callback: () => void): Server;
  onClientRejected(callback: (port?: number, host?: string) => void): Server;
  onClientConnected(callback: (port?: number, host?: string) => void): Server;
  onClientClosed(callback: (port?: number, host?: string) => void): Server;
  onStop(callback: () => void): Server;
  start(): void;
}
export interface ClientOptions {
  logActivity?: boolean;
  ipStack?: 4 | 6;
  outboundEncoding?: string;
  inboundEncoding?: string;
}
export declare class Client {
  readonly port: number;
  readonly options: ClientOptions;
  constructor(port: number, options?: ClientOptions);
  onConnect(callback: (err?: Error) => void): Client;
  onDestroy(callback: () => void): Client;
  destroy(): void
  request(payload: string | object): Promise<SocketResponse>;
  requestString(payload: string | object): Promise<string>;
  requestJson(payload: string | object): Promise<object>;
}
declare class SocketResponse {
  private buffer;
  constructor(buffer: StreamBuffer);
  toString(): string;
  toJson(): object;
}
declare class StreamBuffer {
  private encoding;
  private bufferString;
  constructor(encoding: string);
  append(buffer: Buffer): void;
  toString(): string;
}

export interface ProvidedLogger {
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}
export declare class Log {
  setLogger(logger: ProvidedLogger): void
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}