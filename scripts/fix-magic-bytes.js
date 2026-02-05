const fs = require("fs")
const path = require("path")

const modulePath = path.join(__dirname, "..", "node_modules", "magic-bytes.js")
const distPath = path.join(modulePath, "dist")
const indexPath = path.join(distPath, "index.js")
const typesPath = path.join(distPath, "index.d.ts")

if (!fs.existsSync(modulePath)) {
  process.exit(0)
}

if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true })
}

if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(
    indexPath,
    "module.exports = { filetypeinfo: () => [] };\n",
    "utf8"
  )
}

if (!fs.existsSync(typesPath)) {
  fs.writeFileSync(
    typesPath,
    "export declare const filetypeinfo: (input?: Uint8Array | number[]) => Array<{ mime: string; extension: string }>;\\n",
    "utf8"
  )
}
