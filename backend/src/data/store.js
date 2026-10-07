import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dataPath = join(dirname(fileURLToPath(import.meta.url)), "locales.json");
const locales = JSON.parse(readFileSync(dataPath, "utf8"));

export function getLocales() {
  return locales;
}

export function getLocalById(id) {
  return locales.find((local) => local.id === id) ?? null;
}

export function getTipos() {
  return [...new Set(locales.map((local) => local.tipo))];
}
