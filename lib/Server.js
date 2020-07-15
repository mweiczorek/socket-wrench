"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const Constants_1 = require("./Constants");
const Logger_1 = require("./Logger");
const defaultOptions = {
    logActivity: false,
    ipStack: 4,
    encoding: 'utf8',
    localhostOnly: true,
    whitelist: [],
    clientRejectionMessage: 'Connection rejected',
};
class Server {
    constructor(port, options) {
        this._callbacks = {};
        this._listeners = new Map();
        this._port = port;
        this._options = Object.assign({}, defaultOptions, options);
        if (this._options.localhostOnly) {
            this._host = this._options.ipStack == 4 ? Constants_1.localhostIPV4 : Constants_1.localhostIPV6;
        }
    }
    get port() {
        return this._port;
    }
    acceptAny(callback) {
        this._defaultListener = callback;
        return this;
    }
    accept(directive, callback) {
        this._listeners.set(directive.trim(), callback);
        return this;
    }
    onStart(callback) {
        this._callbacks.onStart = callback;
        return this;
    }
    onClientRejected(callback) {
        this._callbacks.onClientRejected = callback;
        return this;
    }
    onClientConnected(callback) {
        this._callbacks.onClientConnected = callback;
        return this;
    }
    onClientClosed(callback) {
        this._callbacks.onClientClosed = callback;
        return this;
    }
    onStop(callback) {
        this._callbacks.onStop = callback;
        return this;
    }
    start() {
        this._socketServer = net_1.createServer(socket => {
            const remote = socket.remoteAddress + ':' + socket.remotePort;
            if (!this.canConnect(socket)) {
                Logger_1.Log.debug('Client rejected from ' + remote);
                this.rejectConnection(socket);
            }
            else {
                Logger_1.Log.debug('Client connected: ' + remote);
                if (this._callbacks.onClientConnected) {
                    this._callbacks.onClientConnected(socket.remotePort, socket.remoteAddress);
                }
                socket.on('close', () => {
                    if (!socket.destroyed) {
                        socket.destroy();
                        Logger_1.Log.debug('Client closed: ' + remote);
                        if (this._callbacks.onClientClosed) {
                            this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress);
                        }
                    }
                });
                socket.on('data', data => {
                    const dataString = data.toString(this._options.encoding).trim();
                    if (this._defaultListener) {
                        const result = this._defaultListener(dataString);
                        if (this.isPromise(result)) {
                            result.then(value => {
                                const emitString = this.parseListenerCallback(value);
                                this.emit(socket, emitString);
                            });
                        }
                        else {
                            const emitString = this.parseListenerCallback(this._defaultListener(dataString));
                            this.emit(socket, emitString);
                        }
                    }
                    else {
                        if (this._listeners.has(dataString)) {
                            const listener = this._listeners.get(dataString);
                            if (listener) {
                                const listenerResult = listener();
                                if (this.isPromise(listenerResult)) {
                                    listenerResult.then(value => {
                                        const emitString = this.parseListenerCallback(value);
                                        this.emit(socket, emitString);
                                    });
                                }
                                else {
                                    const emitString = this.parseListenerCallback(listener());
                                    this.emit(socket, emitString);
                                }
                            }
                            else {
                                Logger_1.Log.warn('Error parsing callback value: ' + dataString);
                                this.emit(socket, '');
                            }
                        }
                        else {
                            Logger_1.Log.warn('Invalid directive: ' + dataString);
                            this.emit(socket, '');
                        }
                    }
                });
            }
        });
        this._socketServer.listen(this._port, this._host, () => {
            this._port = this._socketServer.address().port;
            Logger_1.Log.info(`TCP server started on ${this._host}:${this._port}`);
            if (this._callbacks.onStart) {
                this._callbacks.onStart();
            }
        });
    }
    stop(callback) {
        this._socketServer.close(() => {
            Logger_1.Log.debug('TCP server closed');
            callback && callback();
        });
    }
    restart() {
        Logger_1.Log.debug('Restarting TCP server...');
        this.stop(() => {
            this.start();
        });
    }
    emit(socket, message) {
        socket.end(message + Constants_1.lf);
        Logger_1.Log.debug('Client closed: ' + socket.remoteAddress + ':' + socket.remotePort);
        if (this._callbacks.onClientClosed) {
            this._callbacks.onClientClosed(socket.remotePort, socket.remoteAddress);
        }
        socket.destroy();
    }
    parseListenerCallback(received) {
        if (typeof received == 'string') {
            return received.trim();
        }
        else if (typeof received == 'object') {
            try {
                return JSON.stringify(received);
            }
            catch (err) {
                Logger_1.Log.debug('Could not stringify JSON object: ' + received.toString());
            }
        }
    }
    canConnect(socket) {
        if (!this._options.localhostOnly && socket.remoteAddress && this._options.whitelist)
            if (this._options.whitelist.indexOf(socket.remoteAddress) > -1)
                return true;
        if (this._options.localhostOnly && socket.remoteAddress === this._host)
            return true;
        return false;
    }
    rejectConnection(socket) {
        if (this._options.clientRejectionMessage)
            socket.write(this._options.clientRejectionMessage);
        socket.end();
        if (this._callbacks.onClientRejected) {
            this._callbacks.onClientRejected(socket.localPort, socket.localAddress);
        }
    }
    isPromise(obj) {
        return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
    }
}
exports.default = Server;
