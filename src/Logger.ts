
export interface ProvidedLogger {
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}
class LoggerImpl implements ProvidedLogger {

  private _logger: ProvidedLogger

  setLogger(logger: ProvidedLogger) {
    this._logger = logger
  }

  debug(...args: any[]): void {
    this._logger.debug(...args)
  }
  info(...args: any[]): void {
    this._logger.debug(...args)
  }
  warn(...args: any[]): void {
    this._logger.debug(...args)
  }
  error(...args: any[]): void {
    this._logger.debug(...args)
  }
}

const implementedLogger = new LoggerImpl()
export {
  implementedLogger as Log
}
