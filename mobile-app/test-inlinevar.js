const { compile } = require("react-native-css/compiler");
const fs = require("fs");
const css = fs.readFileSync("src/global.css");
try {
  compile(css, {
    filename: "src/global.css",
    projectRoot: process.cwd(),
    inlineVariables: false,
  });
  console.log("compile ok without inlineVariables");
} catch (e) {
  console.error("failed:", e && e.stack ? e.stack : e);
}
