"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const colors = require("colors");
var Facet;
(function (Facet) {
    Facet["Client"] = "CLIENT";
    Facet["Server"] = "SERVER";
})(Facet || (Facet = {}));
function clientLogger(port, message, isError = false) {
    log(port, message, isError, Facet.Client);
}
exports.clientLogger = clientLogger;
function serverLogger(port, message, isError = false) {
    log(port, message, isError, Facet.Server);
}
exports.serverLogger = serverLogger;
function log(port, message, isError, direction) {
    const pid = colors.cyan(process.pid.toString());
    const portStr = colors.yellow(port.toString());
    const context = isError ? colors.red(direction) : colors.green(direction);
    const logMessage = `[ ${pid} | ${portStr} | ${context} ] > ${message}`;
    if (isError) {
        console.error(logMessage);
    }
    else {
        console.log(logMessage);
    }
}
