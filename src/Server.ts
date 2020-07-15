import { createServer, Socket, Server as SocketServer, AddressInfo } from 'net'
import { localhostIPV4, localhostIPV6, lf } from './Constants'
import { Log } from './Logger'

type DirectiveCallback = () => string | object | Promise<string | object>
type DefaultCallback = (data: string) => string | object | Promise<string | object>

const defaultOptions: ServerOptions = {
  logActivity: false,
  ipStack: 4,
  encoding: 'utf8',
  localhostOnly: true,
  whitelist: [],
  clientRejectionMessage: 'Connection rejected',
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
      const remote = socket.remoteAddress + ':' + socket.remotePort
      if (!this.canConnect(socket)) {
        Log.debug('Client rejected from ' + remote)
        this.rejectConnection(socket)
      } else {
        Log.debug('Client connected: ' + remote)
        if (this._callbacks.onClientConnected) {
          this._callbacks.onClientConnected(socket.remotePort, socket.remoteAddress)
        }
        socket.on('close', () => {
          if (!socket.destroyed) {
            socket.destroy()
            Log.debug('Client closed: ' + remote)
            if (this._callbacks.onClientClosed) {
              this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
            }
          }
        })
        socket.on('data', data => {
          const dataString = data.toString(this._options.encoding).trim()
          if (this._defaultListener) {
            const result = this._defaultListener(dataString)
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
                Log.warn('Error parsing callback value: ' + dataString)
                this.emit(socket, '')
              }
            } else {
              Log.warn('Invalid directive: ' + dataString)
              this.emit(socket, '')
            }
          }
        })
      }
    })
    this._socketServer.listen(this._port, this._host, () => {
      this._port = (this._socketServer.address() as AddressInfo).port
      Log.info(`TCP server started on ${this._host}:${this._port}`)
      if (this._callbacks.onStart) {
        this._callbacks.onStart()
      }
    })
  }

  stop(callback?: () => void) {
    this._socketServer.close(() => {
      Log.debug('TCP server closed')
      callback && callback()
    })
  }

  restart() {
    Log.debug('Restarting TCP server...')
    this.stop(() => {
      this.start()
    })
  }

  private emit(socket: Socket, message?: string) {
    socket.end(message + lf)
    Log.debug('Client closed: ' + socket.remoteAddress + ':' + socket.remotePort)
    if (this._callbacks.onClientClosed) {
      this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress)
    }
    socket.destroy()
  }

  private parseListenerCallback(received: string | object): string | undefined {
    if (typeof received == 'string') {
      return received.trim()
    } else if (typeof received == 'object') {
      try {
        return JSON.stringify(received)
      } catch (err) {
        Log.debug('Could not stringify JSON object: ' + received.toString())
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
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function'
  }
}
