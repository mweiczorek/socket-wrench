"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const Logger_1 = require("./Logger");
const Constants_1 = require("./Constants");
const defaultOptions = {
    logActivity: false,
    ipStack: 4,
    encoding: "utf8",
    localhostOnly: true,
    whitelist: [],
    clientRejectionMessage: "Connection rejected",
};
class Server {
    constructor(port, options) {
        this.callbacks = {};
        this.listeners = new Map();
        this.port = port;
        this.options = Object.assign(defaultOptions, options);
        if (this.options.localhostOnly) {
            this.host = this.options.ipStack == 4 ? Constants_1.localhostIPV4 : Constants_1.localhostIPV6;
        }
    }
    acceptAny(callback) {
        this.defaultListener = callback;
        return this;
    }
    accept(directive, callback) {
        this.listeners.set(directive.trim(), callback);
        return this;
    }
    onStart(callback) {
        this.callbacks.onStart = callback;
        return this;
    }
    onClientRejected(callback) {
        this.callbacks.onClientRejected = callback;
        return this;
    }
    onClientConnected(callback) {
        this.callbacks.onClientConnected = callback;
        return this;
    }
    onStop(callback) {
        this.callbacks.onStop = callback;
        return this;
    }
    start() {
        this.socketServer = net_1.createServer(socket => {
            const remote = socket.remoteAddress + ":" + socket.remotePort;
            if (!this.canConnect(socket)) {
                this.log("Client rejected from " + remote, true);
                this.rejectConnection(socket);
            }
            else {
                this.log("Client connected from " + remote);
                if (this.callbacks.onClientConnected) {
                    this.callbacks.onClientConnected(socket.remotePort, socket.remoteAddress);
                }
                socket.on("end", () => socket.destroy());
                socket.on("data", data => {
                    const dataString = data.toString(this.options.encoding).trim();
                    if (this.defaultListener) {
                        const result = this.defaultListener(dataString);
                        if (this.isPromise(result)) {
                            result.then(value => {
                                const emitString = this.parseListenerCallback(value);
                                socket.end(emitString);
                            });
                        }
                        else {
                            const emitString = this.parseListenerCallback(this.defaultListener(dataString));
                            socket.end(emitString);
                        }
                    }
                    else {
                        if (this.listeners.has(dataString)) {
                            const listener = this.listeners.get(dataString);
                            if (listener) {
                                const listenerResult = listener();
                                if (this.isPromise(listenerResult)) {
                                    listenerResult.then(value => {
                                        const emitString = this.parseListenerCallback(value);
                                        socket.end(emitString);
                                    });
                                }
                                else {
                                    const emitString = this.parseListenerCallback(listener());
                                    socket.end(emitString);
                                }
                            }
                            else {
                                this.log("Error parsing callback value: " + dataString);
                                socket.end();
                            }
                        }
                        else {
                            this.log("Invalid directive: " + dataString);
                            socket.end();
                        }
                    }
                });
            }
        });
        this.socketServer.listen(this.port, this.host, () => {
            this.log(`TCP server started on ${this.host}:${this.port}`);
            if (this.callbacks.onStart) {
                this.callbacks.onStart();
            }
        });
    }
    stop(callback) {
        this.socketServer.close(() => {
            this.log("TCP server closed");
            callback && callback();
        });
    }
    restart() {
        this.log("Restarting TCP server...");
        this.stop(() => {
            this.start();
        });
    }
    parseListenerCallback(received) {
        if (typeof received == "string") {
            return received.trim();
        }
        else if (typeof received == "object") {
            try {
                return JSON.stringify(received);
            }
            catch (err) {
                this.log("Could not stringify JSON object: " + received.toString());
            }
        }
    }
    canConnect(socket) {
        if (!this.options.localhostOnly && socket.remoteAddress && this.options.whitelist)
            if (this.options.whitelist.indexOf(socket.remoteAddress) > -1)
                return true;
        if (this.options.localhostOnly && socket.remoteAddress === this.host)
            return true;
        return false;
    }
    rejectConnection(socket) {
        socket.end(this.options.clientRejectionMessage);
        if (this.callbacks.onClientRejected) {
            this.callbacks.onClientRejected(socket.localPort, socket.localAddress);
        }
    }
    isPromise(obj) {
        return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
    }
    log(message, isError = false) {
        if (this.options.logActivity) {
            Logger_1.serverLogger(this.port, message, isError);
        }
    }
}
exports.default = Server;
