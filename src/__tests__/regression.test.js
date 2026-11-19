import { describe, it, expect } from "vitest";
import { sanitizeInput } from "../services/localService";

// Función Haversine idéntica a la usada en App.jsx
function calcDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Lógica de filtrado de visibleLocales para pruebas de regresión
function filterLocales(locales, { searchTerm = "", selectedCategory = "Todos", selectedProduct = null }) {
  return locales.filter((l) => {
    const matchesCategory =
      selectedCategory === "Todos" || l.tipo === selectedCategory;
    const prodsString = Array.isArray(l.productos) ? l.productos.join(" ") : "";
    const searchTarget = (
      l.nombre +
      " " +
      l.direccion +
      " " +
      l.tipo +
      " " +
      (l.descripcion || "") +
      " " +
      prodsString
    )
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const normalizedSearch = searchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const matchesProduct = selectedProduct
      ? Array.isArray(l.productos) && l.productos.includes(selectedProduct)
      : true;
    const matchesSearch = searchTarget.includes(normalizedSearch);
    return matchesCategory && matchesSearch && matchesProduct;
  });
}

describe("Suite de Regresión del Incremento 1 (Protección Sección 10)", () => {
  it("REG-01: calcDist calcula distancias válidas en metros y no produce NaN ante tipos numéricos de BD", () => {
    // Coordenadas Centro Talca vs Local 1 Sur 1245
    const lat1 = -35.426;
    const lon1 = -71.655;
    const lat2 = -35.4264;
    const lon2 = -71.6557;

    const dist = calcDist(lat1, lon1, lat2, lon2);

    expect(Number.isNaN(dist)).toBe(false);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(200); // Menos de 200m
  });

  it("REG-02 / AC-03: Filtrado por comida específica conserva solo los locales correspondientes", () => {
    const catalogoPiloto = [
      { id: 1, nombre: "Fuente Ñuble", tipo: "Almuerzo", direccion: "3 Oriente", productos: ["Completos", "Hamburguesas"] },
      { id: 2, nombre: "Café Central", tipo: "Cafetería", direccion: "1 Sur", productos: ["Café de especialidad", "Tostadas"] },
      { id: 3, nombre: "El Rey", tipo: "Almuerzo", direccion: "6 Sur", productos: ["Completos", "Bebidas"] }
    ];

    const resultados = filterLocales(catalogoPiloto, { selectedProduct: "Completos" });

    expect(resultados.length).toBe(2);
    expect(resultados.map((r) => r.nombre)).toEqual(["Fuente Ñuble", "El Rey"]);
  });

  it("REG-03 / AC-04: Caso Borde - Búsqueda de producto sin coincidencias retorna array vacío sin excepciones", () => {
    const catalogoPiloto = [
      { id: 1, nombre: "Fuente Ñuble", tipo: "Almuerzo", direccion: "3 Oriente", productos: ["Completos"] }
    ];

    const resultados = filterLocales(catalogoPiloto, { selectedProduct: "Sushi" });

    expect(Array.isArray(resultados)).toBe(true);
    expect(resultados.length).toBe(0);
  });

  it("REG-04: Normalización Unicode maneja tildes y mayúsculas en la búsqueda", () => {
    const catalogoPiloto = [
      { id: 1, nombre: "Cafetería París", tipo: "Cafetería", direccion: "1 Sur", productos: ["Café"] }
    ];

    const resultados = filterLocales(catalogoPiloto, { searchTerm: "cafeteria paris" });

    expect(resultados.length).toBe(1);
    expect(resultados[0].id).toBe(1);
  });

  it("REG-05 / QA-08: Sanitización de entradas elimina payloads XSS (<script>) en postulaciones y reportes", () => {
    const payload = "<script>alert(1)</script>Casino Central";
    const limpio = sanitizeInput(payload);

    expect(limpio).not.toContain("<script>");
    expect(limpio).toBe("alert(1)Casino Central");
  });

  it("REG-06 / DA-02: Filtrado de favoritos en Modo Invitado conserva solo IDs guardados localmente", () => {
    const catalogoPiloto = [
      { id: 1, nombre: "Fuente Ñuble", tipo: "Almuerzo", direccion: "3 Oriente", productos: ["Completos"] },
      { id: 2, nombre: "Café Central", tipo: "Cafetería", direccion: "1 Sur", productos: ["Café"] }
    ];
    const favIds = [2];
    const favoritos = catalogoPiloto.filter((l) => favIds.includes(l.id));

    expect(favoritos.length).toBe(1);
    expect(favoritos[0].nombre).toBe("Café Central");
  });
});
