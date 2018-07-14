import { Socket, SocketConnectOpts } from "net"
import { clientLogger } from "./Logger";
import { lf, localhost } from "./Constants";

const defaultOptions: ClientOptions = {
  logActivity: false,
  ipStack: 4,
  outboundEncoding: "utf8",
  inboundEncoding: "utf8"
}

enum Status {
  Disconnected,
  Connected,
  Idle,
  Errored
}

interface ClientCallbacks {
  onConnect?: (err?: Error) => void
  onDestroy?: () => void
}

export interface ClientOptions {
  logActivity?: boolean,
  ipStack?: 4 | 6,
  outboundEncoding?: string
  inboundEncoding?: string
}

export default class Client {

  readonly port: number
  readonly options: ClientOptions
  private socket: Socket
  private callbacks: ClientCallbacks
  private status: Status = Status.Disconnected

  constructor(port: number, options?: ClientOptions) {
    this.port = port
    this.options = Object.assign(defaultOptions, options)
    this.callbacks = {}
    this.socket = new Socket()
  }

  onConnect(callback: (err?: Error) => void): Client {
    this.callbacks.onConnect = callback
    return this
  }

  onDestroy(callback: () => void): Client {
    this.callbacks.onDestroy = callback
    return this
  }

  request(payload: string | object): Promise<SocketResponse> {
    const exchange = new SocketExchange(payload)
    if (exchange.payloadError) {
      return Promise.reject(exchange.payloadError)
    }
    return this.startExchange(exchange)
  }

  requestString(payload: string | object): Promise<string> {
    return this.request(payload)
      .then(response => response.toString())
  }

  requestJson(payload: string | object): Promise<object> {
    return this.request(payload)
      .then(response => response.toJson())
  }

  private startExchange(payload: SocketExchange): Promise<SocketResponse> {
    const buffer = new StreamBuffer(this.options.inboundEncoding!)
    return new Promise((resolve, reject) => {
      const options: SocketConnectOpts = {
        port: this.port,
        host: localhost,
        family: this.options.ipStack
      }
      this.socket.connect(options, () => {
        if (this.callbacks.onConnect)
          this.callbacks.onConnect()
        this.log("Receiver client connected")
        this.status = Status.Connected
        this.socket.write(payload.getOutbound(), this.options.outboundEncoding, () => {
          this.status = Status.Idle
        })
      })
      this.socket.on("error", err => {
        if (this.status == Status.Disconnected) {
          this.status = Status.Errored
          this.log("Connection Error", true)
          this.log(`Client is using IPV${this.options.ipStack}. Check the server is using the same IP stack`, true)
          if (this.callbacks.onConnect) {
            this.callbacks.onConnect(err)
          } else {
            reject(err)
          }
        } else {
          this.status = Status.Errored
          reject(err)
        }
      })
      this.socket.on("data", data => buffer.append(data))
      this.socket.on("close", () => {
        this.log("Client disconnected", this.status == Status.Errored)
        this.socket.destroy()
        if (this.callbacks.onDestroy) {
          this.callbacks.onDestroy()
        }
        this.log("Client connection destroyed", this.status == Status.Errored)
        this.status = Status.Disconnected
      })
      this.socket.on("end", () => resolve(new SocketResponse(buffer)))
    })
  }

  private log(message: string, isError: boolean = false) {
    if (this.options.logActivity) {
      clientLogger(this.port, message, isError)
    }
  }
}

class SocketExchange {

  private payload: string = ""
  readonly payloadError?: Error

  constructor(payload: string | object) {
    if (typeof payload == "string") {
      this.payload = payload
    } else if (typeof payload == "object") {
      try {
        this.payload = JSON.stringify(payload)
      } catch (err) {
        this.payloadError = new Error("Invalid JSON: " + payload)
      }
    } else {
      this.payloadError = new Error("Invalid message type. Expected string or object. Received " + typeof payload)
    }
  }

  getOutbound(): string {
    return this.payload.trim() + lf
  }
}

export class SocketResponse {

  private buffer: StreamBuffer
  constructor(buffer: StreamBuffer) {
    this.buffer = buffer
  }

  toString(): string {
    return this.buffer.toString()
  }

  toJson(): object {
    try {
      return JSON.parse(this.toString())
    } catch (e) {
      throw new Error("Response JSON parse error")
    }
  }
}

class StreamBuffer {
  private encoding: string
  private bufferString = ""

  constructor(encoding: string) {
    this.encoding = encoding
  }

  append(buffer: Buffer) {
    this.bufferString += buffer.toString(this.encoding)
  }

  toString() {
    return this.bufferString
  }
}
