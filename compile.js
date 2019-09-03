const dts = require("dts-bundle")

dts.bundle({
  name: "sockexchange",
  main: "./lib/index.js",
  out: "./index.d.ts"
})