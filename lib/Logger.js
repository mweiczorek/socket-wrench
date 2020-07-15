"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class LoggerImpl {
    setLogger(logger) {
        this._logger = logger;
    }
    debug(...args) {
        this._logger.debug(...args);
    }
    info(...args) {
        this._logger.debug(...args);
    }
    warn(...args) {
        this._logger.debug(...args);
    }
    error(...args) {
        this._logger.debug(...args);
    }
}
const implementedLogger = new LoggerImpl();
exports.Log = implementedLogger;
