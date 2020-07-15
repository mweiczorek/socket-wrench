"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const Constants_1 = require("./Constants");
const Logger_1 = require("./Logger");
const defaultOptions = {
    logActivity: false,
    ipStack: 4,
    outboundEncoding: 'utf8',
    inboundEncoding: 'utf8'
};
var Status;
(function (Status) {
    Status[Status["Disconnected"] = 0] = "Disconnected";
    Status[Status["Connected"] = 1] = "Connected";
    Status[Status["Idle"] = 2] = "Idle";
    Status[Status["Errored"] = 3] = "Errored";
})(Status || (Status = {}));
class Client {
    constructor(port, options) {
        this.status = Status.Disconnected;
        this.port = port;
        this.options = Object.assign(defaultOptions, options);
        this.callbacks = {};
        this.socket = new net_1.Socket();
    }
    onConnect(callback) {
        this.callbacks.onConnect = callback;
        return this;
    }
    onDestroy(callback) {
        this.callbacks.onDestroy = callback;
        return this;
    }
    destroy() {
        this.socket.destroy();
    }
    request(payload) {
        const exchange = new SocketExchange(payload);
        if (exchange.payloadError) {
            return Promise.reject(exchange.payloadError);
        }
        return this.startExchange(exchange);
    }
    requestString(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(payload)
                .then(response => response.toString());
        });
    }
    requestJson(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(payload)
                .then(response => response.toJson());
        });
    }
    startExchange(payload) {
        const buffer = new StreamBuffer(this.options.inboundEncoding);
        return new Promise((resolve, reject) => {
            const options = {
                port: this.port,
                host: Constants_1.localhost,
                family: this.options.ipStack
            };
            this.socket.connect(options, () => {
                if (this.callbacks.onConnect)
                    this.callbacks.onConnect();
                Logger_1.Log.info('Receiver client connected');
                this.status = Status.Connected;
                this.socket.write(payload.getOutbound(), this.options.outboundEncoding, () => {
                    this.status = Status.Idle;
                });
            });
            this.socket.on('error', err => {
                if (this.status == Status.Disconnected) {
                    this.status = Status.Errored;
                    Logger_1.Log.warn('Connection Error', true);
                    Logger_1.Log.warn(`Client is using IPV${this.options.ipStack}. Check the server is using the same IP stack`);
                    if (this.callbacks.onConnect) {
                        this.callbacks.onConnect(err);
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    this.status = Status.Errored;
                    reject(err);
                }
            });
            this.socket.on('data', data => buffer.append(data));
            this.socket.on('close', () => {
                Logger_1.Log.debug('Client disconnected');
                this.socket.destroy();
                if (this.callbacks.onDestroy) {
                    this.callbacks.onDestroy();
                }
                Logger_1.Log.debug('Client connection destroyed');
                this.status = Status.Disconnected;
            });
            this.socket.on('end', () => resolve(new SocketResponse(buffer)));
        });
    }
}
exports.default = Client;
class SocketExchange {
    constructor(payload) {
        this.payload = '';
        if (typeof payload == 'string') {
            this.payload = payload;
        }
        else if (typeof payload == 'object') {
            try {
                this.payload = JSON.stringify(payload);
            }
            catch (err) {
                this.payloadError = new Error('Invalid JSON: ' + payload);
            }
        }
        else {
            this.payloadError = new Error('Invalid message type. Expected string or object. Received ' + typeof payload);
        }
    }
    getOutbound() {
        return this.payload.trim() + Constants_1.lf;
    }
}
class SocketResponse {
    constructor(buffer) {
        this.buffer = buffer;
    }
    toString() {
        return this.buffer.toString();
    }
    toJson() {
        try {
            return JSON.parse(this.toString());
        }
        catch (e) {
            throw new Error('Response JSON parse error');
        }
    }
}
exports.SocketResponse = SocketResponse;
class StreamBuffer {
    constructor(encoding) {
        this.bufferString = '';
        this.encoding = encoding;
    }
    append(buffer) {
        this.bufferString += buffer.toString(this.encoding);
    }
    toString() {
        return this.bufferString;
    }
}
