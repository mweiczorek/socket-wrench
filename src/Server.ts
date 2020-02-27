import { createServer, Socket, Server as SocketServer } from "net"
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

  readonly port: number
  readonly host?: string
  private readonly options: ServerOptions
  private readonly callbacks: ClientCallbacks = {}
  private socketServer: SocketServer
  private listeners: Map<string, DirectiveCallback> = new Map()
  private defaultListener: DefaultCallback | undefined

  constructor(port: number, options?: ServerOptions) {
    this.port = port
    this.options = Object.assign(defaultOptions, options)
    if (this.options.localhostOnly) {
      this.host = this.options.ipStack == 4 ? localhostIPV4 : localhostIPV6
    }
  }

  acceptAny(callback: (data: string) => string | object | Promise<string | object>): Server {
    this.defaultListener = callback
    return this
  }

  accept(directive: string, callback: () => string | object | Promise<string | object>): Server {
    this.listeners.set(directive.trim(), callback)
    return this
  }

  onStart(callback: () => void): Server {
    this.callbacks.onStart = callback
    return this
  }

  onClientRejected(callback: (port?: number, host?: string) => void): Server {
    this.callbacks.onClientRejected = callback
    return this
  }

  onClientConnected(callback: (port?: number, host?: string) => void): Server {
    this.callbacks.onClientConnected = callback
    return this
  }

  onClientClosed(callback: (port?: number, host?: string) => void): Server {
    this.callbacks.onClientClosed = callback
    return this
  }

  onStop(callback: () => void): Server {
    this.callbacks.onStop = callback
    return this
  }

  start() {
    this.socketServer = createServer(socket => {
      const remote = socket.remoteAddress + ":" + socket.remotePort;
      if (!this.canConnect(socket)) {
        this.log("Client rejected from " + remote, true)
        this.rejectConnection(socket)
      } else {
        this.log("Client connected: " + remote)
        if (this.callbacks.onClientConnected) {
          this.callbacks.onClientConnected(socket.remotePort, socket.remoteAddress)
        }
        socket.on("close", () => {
          if (!socket.destroyed) {
            socket.destroy()
            this.log("Client closed: " + remote)
            if (this.callbacks.onClientClosed) {
              this.callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
            }
          }
        })
        socket.on("data", data => {
          const dataString = data.toString(this.options.encoding).trim()
          if (this.defaultListener) {
            const result = this.defaultListener(dataString);
            if (this.isPromise(result)) {
              (result as Promise<string | object>).then(value => {
                const emitString = this.parseListenerCallback(value)
                this.emit(socket, emitString)
              })
            } else {
              const emitString = this.parseListenerCallback(this.defaultListener(dataString))
              this.emit(socket, emitString)
            }
          } else {
            if (this.listeners.has(dataString)) {
              const listener = this.listeners.get(dataString)
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
    this.socketServer.listen(this.port, this.host, () => {
      this.log(`TCP server started on ${this.host}:${this.port}`)
      if (this.callbacks.onStart) {
        this.callbacks.onStart()
      }
    })
  }

  stop(callback?: () => void) {
    this.socketServer.close(() => {
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
    if (this.callbacks.onClientClosed) {
      this.callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
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
    if (!this.options.localhostOnly && socket.remoteAddress && this.options.whitelist)
      if (this.options.whitelist.indexOf(socket.remoteAddress) > -1)
        return true
    if (this.options.localhostOnly && socket.remoteAddress === this.host)
      return true
    return false
  }

  private rejectConnection(socket: Socket) {
    socket.end(this.options.clientRejectionMessage)
    if (this.callbacks.onClientRejected) {
      this.callbacks.onClientRejected(socket.localPort, socket.localAddress)
    }
  }

  private isPromise(obj: any): boolean {
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
  }

  private log(message: string, isError: boolean = false) {
    if (this.options.logActivity) {
      serverLogger(this.port, message, isError)
    }
  }
}