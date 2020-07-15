
const { Logger, LogLevel } = require('@nolawnchairs/logger')
const { Client, Server, Log } = require('./lib')

Log.setLogger(new Logger(LogLevel.Debug))

const port = 3090

new Server(port, { logActivity: true, ipStack: 4 })
  .accept('--gimme', gimmeJson)
  .onStart(createClient)
  .start()

/**
 * Test function waits 1 second and sends prints data
 */
async function gimmeJson() {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        foo: 'bar',
        baz: 42,
        quux: null
      })
    }, 1000)
  })
}

function toJson(data) {
  try {
    return JSON.parse(data)
  } catch (e) {
    return {}
  }
}

async function createClient() {
  const client = new Client(port, { logActivity: true, ipStack: 4 })
  try {
    const data = await client.requestJson('--gimme')
    Log.info('Data returned', data)
  } catch (e) {
    Log.error('Error', e)
  }
}
