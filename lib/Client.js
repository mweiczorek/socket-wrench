"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const Logger_1 = require("./Logger");
const Constants_1 = require("./Constants");
const defaultOptions = {
    logActivity: false,
    ipStack: 4,
    outboundEncoding: "utf8",
    inboundEncoding: "utf8"
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
    request(payload) {
        const exchange = new SocketExchange(payload);
        if (exchange.payloadError) {
            return Promise.reject(exchange.payloadError);
        }
        return this.startExchange(exchange);
    }
    requestString(payload) {
        return this.request(payload)
            .then(response => response.toString());
    }
    requestJson(payload) {
        return this.request(payload)
            .then(response => response.toJson());
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
                this.log("Receiver client connected");
                this.status = Status.Connected;
                this.socket.write(payload.getOutbound(), this.options.outboundEncoding, () => {
                    this.status = Status.Idle;
                });
            });
            this.socket.on("error", err => {
                if (this.status == Status.Disconnected) {
                    this.status = Status.Errored;
                    this.log("Connection Error", true);
                    this.log(`Client is using IPV${this.options.ipStack}. Check the server is using the same IP stack`, true);
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
            this.socket.on("data", data => buffer.append(data));
            this.socket.on("close", () => {
                this.log("Client disconnected", this.status == Status.Errored);
                this.socket.destroy();
                if (this.callbacks.onDestroy) {
                    this.callbacks.onDestroy();
                }
                this.log("Client connection destroyed", this.status == Status.Errored);
                this.status = Status.Disconnected;
            });
            this.socket.on("end", () => resolve(new SocketResponse(buffer)));
        });
    }
    log(message, isError = false) {
        if (this.options.logActivity) {
            Logger_1.clientLogger(this.port, message, isError);
        }
    }
}
exports.default = Client;
class SocketExchange {
    constructor(payload) {
        this.payload = "";
        if (typeof payload == "string") {
            this.payload = payload;
        }
        else if (typeof payload == "object") {
            try {
                this.payload = JSON.stringify(payload);
            }
            catch (err) {
                this.payloadError = new Error("Invalid JSON: " + payload);
            }
        }
        else {
            this.payloadError = new Error("Invalid message type. Expected string or object. Received " + typeof payload);
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
            throw new Error("Response JSON parse error");
        }
    }
}
exports.SocketResponse = SocketResponse;
class StreamBuffer {
    constructor(encoding) {
        this.bufferString = "";
        this.encoding = encoding;
    }
    append(buffer) {
        this.bufferString += buffer.toString(this.encoding);
    }
    toString() {
        return this.bufferString;
    }
}
