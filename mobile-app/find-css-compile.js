const fs = require("fs");
const path = require("path");
const glob = require("glob");
const { compile } = require("react-native-css/compiler");

const root = process.cwd();
const patterns = ["**/*.css", "**/*.scss", "**/*.sass"];

const files = patterns.flatMap((p) =>
  glob.sync(p, { cwd: root, absolute: true, ignore: "node_modules/**" }),
);
console.log("Found", files.length, "css files");
let failed = 0;
for (const file of files) {
  try {
    const content = fs.readFileSync(file);
    compile(content, { filename: file, projectRoot: root });
    console.log("[ok]", file);
  } catch (e) {
    console.error("[fail]", file);
    console.error(e && e.stack ? e.stack : e);
    failed++;
  }
}
console.log("Done. failed=", failed);
