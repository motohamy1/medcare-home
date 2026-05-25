const fs = require("fs");
const { transform } = require("lightningcss");

const css = fs.readFileSync("src/global.css");
try {
  const res = transform({ code: Buffer.from(css), filename: "src/global.css" });
  console.log("success");
} catch (e) {
  console.error("error:", e && e.stack ? e.stack : e);
}
