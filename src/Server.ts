import { createServer, Socket, Server as SocketServer, AddressInfo } from "net"
import { serverLogger } from "./Logger";
import { localhostIPV4, localhostIPV6, lf } from "./Constants";

type DirectiveCallback = () => string | object | Promise<string | object>
type DefaultCallback = (data: string) => string | object | Promise<string | object>

const defaultOptions: ServerOptions = {
  logActivity: false,
  ipStack: 4,
  encoding: "utf8",
  localhostOnly: true,
  whitelist: [],
  clientRejectionMessage: "Connection rejected",
}

interface ClientCallbacks {
  onStart?: () => void
  onClientRejected?: (port?: number, host?: string) => void
  onClientConnected?: (port?: number, host?: string) => void
  onClientClosed?: (port?: number, host?: string) => void
  onStop?: () => void
}

export interface ServerOptions {
  logActivity?: boolean
  ipStack?: 4 | 6,
  encoding?: string
  localhostOnly?: boolean
  whitelist?: string[]
  clientRejectionMessage?: string
}

export default class Server {

  private _port: number
  private readonly _host?: string
  private readonly _options: ServerOptions
  private readonly _callbacks: ClientCallbacks = {}
  private _socketServer: SocketServer
  private _listeners: Map<string, DirectiveCallback> = new Map()
  private _defaultListener: DefaultCallback | undefined

  constructor(port: number, options?: ServerOptions) {
    this._port = port
    this._options = { ...defaultOptions, ...options }
    if (this._options.localhostOnly) {
      this._host = this._options.ipStack == 4 ? localhostIPV4 : localhostIPV6
    }
  }

  get port(): number {
    return this._port
  }

  acceptAny(callback: (data: string) => string | object | Promise<string | object>): Server {
    this._defaultListener = callback
    return this
  }

  accept(directive: string, callback: () => string | object | Promise<string | object>): Server {
    this._listeners.set(directive.trim(), callback)
    return this
  }

  onStart(callback: () => void): Server {
    this._callbacks.onStart = callback
    return this
  }

  onClientRejected(callback: (port?: number, host?: string) => void): Server {
    this._callbacks.onClientRejected = callback
    return this
  }

  onClientConnected(callback: (port?: number, host?: string) => void): Server {
    this._callbacks.onClientConnected = callback
    return this
  }

  onClientClosed(callback: (port?: number, host?: string) => void): Server {
    this._callbacks.onClientClosed = callback
    return this
  }

  onStop(callback: () => void): Server {
    this._callbacks.onStop = callback
    return this
  }

  start() {
    this._socketServer = createServer(socket => {
      const remote = socket.remoteAddress + ":" + socket.remotePort;
      if (!this.canConnect(socket)) {
        this.log("Client rejected from " + remote, true)
        this.rejectConnection(socket)
      } else {
        this.log("Client connected: " + remote)
        if (this._callbacks.onClientConnected) {
          this._callbacks.onClientConnected(socket.remotePort, socket.remoteAddress)
        }
        socket.on("close", () => {
          if (!socket.destroyed) {
            socket.destroy()
            this.log("Client closed: " + remote)
            if (this._callbacks.onClientClosed) {
              this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
            }
          }
        })
        socket.on("data", data => {
          const dataString = data.toString(this._options.encoding).trim()
          if (this._defaultListener) {
            const result = this._defaultListener(dataString);
            if (this.isPromise(result)) {
              (result as Promise<string | object>).then(value => {
                const emitString = this.parseListenerCallback(value)
                this.emit(socket, emitString)
              })
            } else {
              const emitString = this.parseListenerCallback(this._defaultListener(dataString))
              this.emit(socket, emitString)
            }
          } else {
            if (this._listeners.has(dataString)) {
              const listener = this._listeners.get(dataString)
              if (listener) {
                const listenerResult = listener()
                if (this.isPromise(listenerResult)) {
                  (listenerResult as Promise<string | object>).then(value => {
                    const emitString = this.parseListenerCallback(value)
                    this.emit(socket, emitString)
                  })
                } else {
                  const emitString = this.parseListenerCallback(listener())
                  this.emit(socket, emitString)
                }
              } else {
                this.log("Error parsing callback value: " + dataString)
                this.emit(socket, "")
              }
            } else {
              this.log("Invalid directive: " + dataString)
              this.emit(socket, "")
            }
          }
        })
      }
    })
    this._socketServer.listen(this._port, this._host, () => {
      this._port = (this._socketServer.address() as AddressInfo).port
      this.log(`TCP server started on ${this._host}:${this._port}`)
      if (this._callbacks.onStart) {
        this._callbacks.onStart()
      }
    })
  }

  stop(callback?: () => void) {
    this._socketServer.close(() => {
      this.log("TCP server closed")
      callback && callback()
    })
  }

  restart() {
    this.log("Restarting TCP server...")
    this.stop(() => {
      this.start()
    })
  }

  private emit(socket: Socket, message?: string) {
    socket.end(message + lf)
    this.log("Client closed: " + socket.remoteAddress + ":" + socket.remotePort)
    if (this._callbacks.onClientClosed) {
      this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
    }
    socket.destroy()
  }

  private parseListenerCallback(received: string | object): string | undefined {
    if (typeof received == "string") {
      return received.trim()
    } else if (typeof received == "object") {
      try {
        return JSON.stringify(received)
      } catch (err) {
        this.log("Could not stringify JSON object: " + received.toString())
      }
    }
  }

  private canConnect(socket: Socket): boolean {
    if (!this._options.localhostOnly && socket.remoteAddress && this._options.whitelist)
      if (this._options.whitelist.indexOf(socket.remoteAddress) > -1)
        return true
    if (this._options.localhostOnly && socket.remoteAddress === this._host)
      return true
    return false
  }

  private rejectConnection(socket: Socket) {
    if (this._options.clientRejectionMessage)
      socket.write(this._options.clientRejectionMessage)
    socket.end()
    if (this._callbacks.onClientRejected) {
      this._callbacks.onClientRejected(socket.localPort, socket.localAddress)
    }
  }

  private isPromise(obj: any): boolean {
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
  }

  private log(message: string, isError: boolean = false) {
    if (this._options.logActivity) {
      serverLogger(this.port, message, isError)
    }
  }
}