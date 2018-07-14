import * as colors from "colors"

enum Facet {
  Client = "CLIENT",
  Server = "SERVER"
}

export function clientLogger(port: number, message: string, isError: boolean = false) {
  log(port, message, isError, Facet.Client)
}

export function serverLogger(port: number, message: string, isError: boolean = false) {
  log(port, message, isError, Facet.Server)
}

function log(port: number, message: string, isError: boolean, direction: Facet) {
  const pid = colors.cyan(process.pid.toString())
  const portStr = colors.yellow(port.toString())
  const context = isError ? colors.red(direction) : colors.green(direction)
  const logMessage = `[ ${pid} | ${portStr} | ${context} ] > ${message}`
  if (isError) {
    console.error(logMessage)
  } else {
    console.log(logMessage)
  }
}