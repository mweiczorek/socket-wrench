import { Socket, SocketConnectOpts } from "net"
import { clientLogger } from "./Logger";
import { lf, localhost } from "./Constants";

/**
 * Default client options to be merged 
 * with user selecte options
 */
const defaultOptions: ClientOptions = {
  logActivity: false,
  ipStack: 4,
  outboundEncoding: "utf8",
  inboundEncoding: "utf8"
}

/**
 * Possible status values of the request
 */
enum Status {
  Disconnected,
  Connected,
  Idle,
  Errored
}

/**
 * Possible callbacks that can be leveraged
 * during the request lifecycle
 */
interface ClientCallbacks {
  onConnect?: (err?: Error) => void
  onDestroy?: () => void
}

/**
 * Client options definitions
 */
export interface ClientOptions {
  logActivity?: boolean,
  ipStack?: 4 | 6,
  outboundEncoding?: string
  inboundEncoding?: string
}

/**
 * Main client class that will handle connecting
 * to a local socket server
 */
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

  /**
   * Callback invoked when the client connects to the socket server
   * with a callback to handle a possible connection error
   * @param callback 
   */
  onConnect(callback: (err?: Error) => void): Client {
    this.callbacks.onConnect = callback
    return this
  }

  /**
   * Callback for when the connection to the socket server is severed
   * @param callback 
   */
  onDestroy(callback: () => void): Client {
    this.callbacks.onDestroy = callback
    return this
  }

  /**
   * Destroy (close) the socket
   */
  destroy() {
    this.socket.destroy()
  }

  /**
   * Primitive request to socket server
   * @param payload string or object to send
   */
  request(payload: string | object): Promise<SocketResponse> {
    const exchange = new SocketExchange(payload)
    if (exchange.payloadError) {
      return Promise.reject(exchange.payloadError)
    }
    return this.startExchange(exchange)
  }

  /**
   * Request to socket server where the expected response
   * value is a string
   * @param payload string or object to serialize
   */
  requestString(payload: string | object): Promise<string> {
    return this.request(payload)
      .then(response => response.toString())
  }

  /**
   * Request to socket server where the expected response
   * can be deserialized as JSON
   * @param payload string or object to serialize
   */
  requestJson(payload: string | object): Promise<object> {
    return this.request(payload)
      .then(response => response.toJson())
  }

  /**
   * Start the exchange between client and server
   * @param payload SocketEchange object
   */
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

  /**
   * Write a logging message to stdout
   * @param message message to print
   * @param isError is this an error?
   */
  private log(message: string, isError: boolean = false) {
    if (this.options.logActivity) {
      clientLogger(this.port, message, isError)
    }
  }
}

/**
 * Wrapper class for preparing/serializing data
 * to and from the server
 */
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

  /**
   * Generate the outbound string to write to the socket,
   * automatically add line-feed after trimming
   */
  getOutbound(): string {
    return this.payload.trim() + lf
  }
}

/**
 * Wrap the response generated from the server and translate
 * to requested response format
 */
export class SocketResponse {

  private buffer: StreamBuffer
  constructor(buffer: StreamBuffer) {
    this.buffer = buffer
  }

  /**
   * Get the string value of the response
   */
  toString(): string {
    return this.buffer.toString()
  }

  /**
   * Generate a JSON object from serialized string,
   * throw on parsing error
   */
  toJson(): object {
    try {
      return JSON.parse(this.toString())
    } catch (e) {
      throw new Error("Response JSON parse error")
    }
  }
}

/**
 * Wrapper class around the buffer generated
 * by the socket response
 */
class StreamBuffer {
  private encoding: string
  private bufferString = ""

  constructor(encoding: string) {
    this.encoding = encoding
  }

  /**
   * Append any data from the buffer into the buffer string
   * @param buffer 
   */
  append(buffer: Buffer) {
    this.bufferString += buffer.toString(this.encoding)
  }

  /**
   * Get the string representation of the buffer, encoded
   * with the inboundEncoding type specified in options
   */
  toString() {
    return this.bufferString
  }
}
