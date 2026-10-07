import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "data", "locales.json");

const locales = JSON.parse(readFileSync(dataPath, "utf-8"));

export function getLocales() {
  return locales;
}

export function getLocalById(id) {
  return locales.find((local) => local.id === id) ?? null;
}

export function getTipos() {
  return [...new Set(locales.map((local) => local.tipo))];
}
