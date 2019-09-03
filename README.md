# SockExchange

## Simple TCP Client/Server for NodeJS

**SockExchange** is a simple, lightweight abstraction layer around NodeJS sockets to setup quick TCP communication channels among the NodeJS microservices in your stack.

# Install
You know what to do...

    npm install sockexchange --save
    yarn add sockexchange

# Usage

    import { Client, Server } from "sockexchange"

There are two facets to this package: **Server** and **Client**.

## Server

    new Server(port: number, [options: ServerOptions])
    
To setup your TCP server, choose your port number and accept one or more "directives":
 
     new Server(5555)
       .accept("give-me-the-things", () => "the things")
       .start()
 
 You can chain as many `server.accept()` calls together as you like. The callback accepts either a string, object or a promise that returns a string or object. Objects are automatically serialized to JSON strings for easy transport:

    new Server(5555)
      .accept("gimme-the-things", () => "the things")
      .accept("gimme-some-json", gimmeJson)
      .accept("something-async", gimmePromise)
      .start()

	function gimmeJson() {
      return {
        foo: "bar",
        quux: 42,
        baz: true
      }
	}

    function gimmePromise() {
      return new Promise((resolve, reject) => {
        setTimeout(() => resolve(gimmeJson()), 1000)
      })
    }

Or, you can call `server.acceptAny()`, and the input string isn't parsed. Instead, the same function is called for any accepted socket connection. Useful if your use case is to send a JSON string for processing and have the app hosting the server do the heavy lifting. If you use this, any `server.accept()` directives are ignored.

    new Server(5555)
      .acceptAny(data => {
	      const fancyJson = delegateFn.processIncoming(data)
	      return fancyJson
      })
      .start()

There are event callbacks that you can use:
 

    new Server(5555)
	  .onStart(() => console.log("Server started"))
	  .onClientConnected((port, host) => console.log(`Connection from ${host}:${port}`))
	  .onClientRejected((port, host) => console.log(`Rejected: ${host}:${port}`))
	  .onStop(() => console.log("Server stopped..."))
	  .accept("mahna-mahna", () => "doot-doo-da-doo-doo")
	  .start()

By default, only connections from localhost (127.0.0.1) are accepted. All other client connections are rejected.

## Client

    new Client(port: number, [options: ClientOptions])
   
 Sending a request to your socket server is simple. Request the socket response as a string or JSON.

    new Client(5555)
      .requestString("gimme-the-things")
      .then(str => console.log(str))  // "the things"
      .catch(console.error)

Socket responses are promises. Perfect for `async/await`.

    async function getJsonFromSocket() {
	    const client = new Client(5555)
	    const json = await client.requestJson("gimme-json") // { foo: "bar", quux: 42, baz: true }
	    console.log(json.foo) // bar
        console.log(json.quux) // 42
    }

You can also listen for specific events. Connection errors are sent via callback, other errors will accumulate in the `catch()` block.

    new Client(5555, { logActivity: true })
      .onConnect(err => err && console.error("Connection error"))
      .onDestroy(() => console.log("Client disconnected"))
      .requestJson("gimme-json")
      .then(doTheThings)
      .catch(console.error)
      

# API

## Server
### constructor(port, [options])
**port** `number/Uint16` - Port on which to bind your server
**options** `ServerOptions`
#### ServerOptions

 - **logActivity** `bool` Outputs logging to stdout [default `false`]
 - **ipStack** `number` IP version to use. Values `4` or `6` [default `4`]
 - **localhostOnly** `bool` Only grant connections from localhost [default `true`]
 - **whitelist** `string[]` List of IP addresses allowed to connect if `localhostOnly` is `false`. **No** subnet masks, e.g. `1.2.3.4/8`, plain IP addresses only (for now)
 - **encoding** `string` Encoding for inbound data. [default `utf8`]
 - **clientRejectionMessage** `string` Message to send to client when connection is rejected. [default `Connection rejected`]

----
### server.accept(directive, callback) : Server
Apply callback to accepted client connection that matches `directive`
- **directive** `string` Incoming string to match to callback
- **callback** `function() => string | object | Promise<string|object>` callback to apply to `directive`. Must return a string, object or `Promise<string|object>`. Objects are automatically serialized to JSON

-----
### server.acceptAny(callback) : Server
Apply the same callback to all accepted client connections
- **callback** `function(data: string) => string | object | Promise<string|object>` callback to apply to `data`. Useful for processing data with a delegate function. Must return a string or object. Objects are automatically serialized to JSON

-----
### server.onStart(callback) : Server
Callback called when the server is successfully started
- **callback** `function() => void`

----
### server.onClientConnected(callback): Server
Called when a client has successfully connected
- **callback** `function(port?: number, host?: string) => void`

----
### server.onClientRejected(callback): Server
Called when a client connection has been rejected
- **callback** `function(port?: number, host?: string) => void`

----
### server.onStop(callback): Server
Called when server has stopped
- **callback** `function() => void`

----
### server.start() : void
Start the server


## Client
### constructor(port, [options])
**port** `number/Uint16` - TCP Port to which target server is bound
**options** `ClientOptions`
#### ClientOptions

 - **logActivity** `bool` Outputs logging to stdout [default `false`]
 - **ipStack** `number` IP version to use. Values `4` or `6` [default `4`]
 - **outboundEncoding** `string` Encoding for outbound data. [default `utf8`]
 - **inboundEncoding** `string` Encoding for inbound data. [default `utf8`]

----
### client.onConnect(err) : Client
Called when the client fails to connect
- **err** `Error | undefined` Error thrown by connection attempt.

----
### client.onDestroy() : Client
Called when the client socket has been destroyed

----
### client.requestString(directive) : Promise<string\>
Request the socket server return a string based on `directive`
- **directive** `string` Directive to send the server. If the server employs `server.acceptAny()`, you may pass an empty string... or anything, really.

----
### client.requestJson(directive) : Promise<object\>
Request the socket server return a JSON object. In reality, the server always returns a `Buffer`, but this buffer is parsed for JSON. An error is thrown if the JSON is invalid. Make sure to `catch()`.
- **directive** `string` Directive to send the server

----
### client.request(directive) : Promise<SocketResponse\>
Make a request to the server. This is the primitive method that you can use if you want to inspect the actual string that your socket server emits. Call `toString()` or `toJson()` on the **SocketResponse** object to parse your data.
- **directive** `string` Directive to send the server

### socketResponse.toString() : string
Returns the string representation of the data sent to the client. Encoded as directed by `clientOptions.inboundEncoding`. This is the same value returned from `client.requestString()`

### socketResponse.toJson()  : object
Returns the parsed JSON from inbound data. This returns the same value as `client.requestJson()`

----
### client.destroy() : void
Destroy (close) the client socket

# License
MIT

