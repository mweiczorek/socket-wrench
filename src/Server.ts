import { createServer, Socket, Server as SocketServer } from "net"
import { serverLogger } from "./Logger";
import { localhostIPV4, localhostIPV6 } from "./Constants";

type DirectiveCallback = () => string | object
type DefaultCallback = (data: string) => string | object

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

  private readonly port: number
  private readonly host?: string
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

  acceptAny(callback: (data: string) => string | object): Server {
    this.defaultListener = callback
    return this
  }

  accept(directive: string, callback: () => string | object): Server {
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
        this.log("Client connected from " + remote)
        if (this.callbacks.onClientConnected) {
          this.callbacks.onClientConnected(socket.remotePort, socket.remoteAddress)
        }
        socket.on("data", data => {
          const dataString = data.toString(this.options.encoding).trim()
          if (this.defaultListener) {
            const emitString = this.parseListenerCallback(this.defaultListener(dataString))
            socket.end(emitString)
          } else {
            if (this.listeners.has(dataString)) {
              const listener = this.listeners.get(dataString)
              if (listener) {
                const emitString = this.parseListenerCallback(listener())
                socket.end(emitString)
              } else {
                this.log("Error parsing callback value: " + dataString)
                socket.end()
              }
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

  private log(message: string, isError: boolean = false) {
    if (this.options.logActivity) {
      serverLogger(this.port, message, isError)
    }
  }
}