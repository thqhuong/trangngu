import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import console from "node:console";
import process from "node:process";

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const ignoredDirectories = new Set([".git", "coverage", "dist", "node_modules", "playwright-report", "test-results", "tmp", "work"]);
  const files = await Promise.all(entries.filter((entry) => !ignoredDirectories.has(entry.name)).map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : [path];
  }));
  return files.flat().filter((file) => extname(file) === ".md");
}

const files = await markdownFiles(resolve("."));
const failures = [];

for (const file of files) {
  const markdown = await readFile(file, "utf8");
  const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = resolve(dirname(file), decodeURIComponent(link.split("#")[0]));
    try {
      await access(target);
    } catch {
      failures.push(`${file}: missing ${link}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked local Markdown links in ${files.length} files.`);
