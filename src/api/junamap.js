const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function searchLocales(
  { q = "", tipo = "Todos", verificado = false } = {},
  options = {}
) {
  const params = new URLSearchParams();

  if (q.trim()) params.set("q", q.trim());
  if (tipo && tipo !== "Todos") params.set("tipo", tipo);
  if (verificado) params.set("verificado", "true");

  const query = params.toString();
  return request(`/api/search${query ? `?${query}` : ""}`, options);
}

export function fetchLocalesGeoJSON(filters) {
  const params = new URLSearchParams();
  if (filters?.q?.trim()) params.set("q", filters.q.trim());
  if (filters?.tipo && filters.tipo !== "Todos") params.set("tipo", filters.tipo);
  if (filters?.verificado) params.set("verificado", "true");
  params.set("format", "geojson");

  return request(`/api/search?${params.toString()}`);
}
