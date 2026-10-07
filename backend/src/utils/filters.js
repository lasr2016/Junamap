export function matchesText(local, query) {
  if (!query) return true;

  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [local.nombre, local.direccion, local.descripcion, local.tipo]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(needle);
}

export function matchesTipo(local, tipo) {
  if (!tipo || tipo === "Todos") return true;
  return local.tipo.toLowerCase() === String(tipo).toLowerCase();
}

export function matchesVerificado(local, verificado) {
  if (verificado === undefined || verificado === null || verificado === "") {
    return true;
  }

  const onlyVerified = String(verificado).toLowerCase() === "true" || verificado === true;
  if (!onlyVerified) return true;

  return local.verificado === true;
}

export function applyLocalFilters(locales, { q, tipo, verificado } = {}) {
  return locales.filter(
    (local) =>
      matchesText(local, q) &&
      matchesTipo(local, tipo) &&
      matchesVerificado(local, verificado)
  );
}
