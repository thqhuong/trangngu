import { execFileSync } from "node:child_process";
import console from "node:console";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import process from "node:process";

const root = process.cwd();
const textExtensions = new Set([
  ".css", ".example", ".html", ".js", ".json", ".jsx", ".md", ".mjs",
  ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const textNames = new Set([".editorconfig", ".gitattributes", "Dockerfile"]);
const patterns = [
  { name: "Google API key", expression: /AIza[0-9A-Za-z_-]{35}/u },
  { name: "Google OAuth access token", expression: /ya29\.[0-9A-Za-z_-]{20,}/u },
  { name: "GitHub token", expression: /gh(?:p|o|u|s|r)_[0-9A-Za-z]{30,}/u },
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: "non-empty Gemini environment value", expression: /^GEMINI_API_KEY[ \t]*=[ \t]*\S+/mu },
];

function isTextFile(path) {
  return textExtensions.has(extname(path).toLowerCase()) || textNames.has(path.split(/[\\/]/u).at(-1));
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .map((path) => join(root, path));
const browserBuild = await stat(join(root, "dist", "client")).then(
  () => walk(join(root, "dist", "client")),
  () => [],
);
const files = [...new Set([...tracked, ...browserBuild])].filter(isTextFile);
const findings = [];

for (const path of files) {
  const content = await readFile(path, "utf8");
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) {
      findings.push(`${relative(root, path)}: ${pattern.name}`);
    }
  }
}

if (findings.length) {
  console.error("Potential credentials found. Values are intentionally not printed:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Scanned ${files.length} text files; no known credential formats found.`);
}
