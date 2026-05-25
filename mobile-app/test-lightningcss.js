const fs = require("fs");
const { compile } = require("react-native-css/compiler");

const css =
  "a{color:red}\n:root{font-size:16px}\n@keyframes x { from { opacity: 0 } to { opacity: 1 } }";
try {
  const result = compile(Buffer.from(css), { filename: "test.css" });
  console.log("compile succeeded");
  console.log("stylesheet keys:", Object.keys(result.stylesheet()));
} catch (err) {
  console.error("compile failed:", err && err.stack ? err.stack : err);
}
