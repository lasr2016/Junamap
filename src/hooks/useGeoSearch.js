import { useEffect, useState } from "react";
import { searchLocales } from "../api/junamap";
import localesFallback from "../data/locales.json";

function filterLocally(locales, { q, tipo, verificado }) {
  const needle = q.trim().toLowerCase();

  return locales.filter((local) => {
    const matchesSearch =
      !needle ||
      local.nombre.toLowerCase().includes(needle) ||
      local.direccion.toLowerCase().includes(needle);
    const matchesCategory = tipo === "Todos" || local.tipo === tipo;
    const matchesVerified = !verificado || local.verificado === true;

    return matchesSearch && matchesCategory && matchesVerified;
  });
}

export function useGeoSearch({ searchTerm, selectedCategory, onlyVerified }) {
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("api");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const data = await searchLocales(
          {
            q: searchTerm,
            tipo: selectedCategory,
            verificado: onlyVerified,
          },
          { signal: controller.signal }
        );

        if (!cancelled) {
          setLocales(data.locales ?? []);
          setSource("api");
        }
      } catch (error) {
        if (cancelled || error.name === "AbortError") return;

        setLocales(
          filterLocally(localesFallback, {
            q: searchTerm,
            tipo: selectedCategory,
            verificado: onlyVerified,
          })
        );
        setSource("local");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchTerm, selectedCategory, onlyVerified]);

  return { locales, loading, source };
}
