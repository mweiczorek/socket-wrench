/// <reference types="node" />

export interface ServerOptions {
  localhostOnly?: boolean;
  clientRejectionMessage?: string;
  logActivity?: boolean;
  ipStack?: 4 | 6;
  encoding?: string;
}
export declare class Server {
  private readonly port;
  private readonly host?;
  private readonly options;
  private readonly callbacks;
  private socketServer;
  private listeners;
  private defaultListener;
  constructor(port: number, options?: ServerOptions);
  acceptAny(callback: (data: string) => string | object): Server;
  accept(directive: string, callback: () => string | object): Server;
  onStart(callback: () => void): Server;
  onClientRejected(callback: (port?: number, host?: string) => void): Server;
  onClientConnected(callback: (port?: number, host?: string) => void): Server;
  onClientClosed(callback: (port?: number, host?: string) => void): Server;
  onStop(callback: () => void): Server;
  start(): void;
  private parseListenerCallback;
  private rejectConnection;
  private log;
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
  private socket;
  private callbacks;
  private status;
  constructor(port: number, options?: ClientOptions);
  onConnect(callback: (err?: Error) => void): Client;
  onDestroy(callback: () => void): Client;
  destroy(): void
  request(payload: string | object): Promise<SocketResponse>;
  requestString(payload: string | object): Promise<string>;
  requestJson(payload: string | object): Promise<object>;
  private startExchange;
  private log;
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