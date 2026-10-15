import L from 'leaflet';

export const CONFIG_CATEGORIAS = {
  almuerzo: {
    nombre: 'Almuerzo',
    color: '#d8502c',
    svgPath: '<path d="M18 2v20M2 2v6a4 4 0 0 0 4 4v10M6 2v6M10 2v6a4 4 0 0 1-4 4"/>' // cubiertos
  },
  cafeteria: {
    nombre: 'Cafetería',
    color: '#8b5336',
    svgPath: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>' // taza de café
  },
  minimarket: {
    nombre: 'Minimarket',
    color: '#257ce6',
    svgPath: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>' // carrito
  },
  panaderia: {
    nombre: 'Panadería',
    color: '#df9800',
    svgPath: '<path d="M2.5 14C2 11.5 4 8.5 7.5 7C11.5 5 18 5 21 8.5C22.5 10.5 22.5 13 21 14.5C18.5 17 11.5 17.5 5.5 16.5C3.5 16 2.8 15.2 2.5 14Z"/><path d="M7 8.5L9.5 13.5"/><path d="M11.5 7.5L14 12.5"/><path d="M16 8L18.5 12"/>' // baguette / croissant
  }
};

// Cache para almacenar instancias de divIcon y optimizar el rendimiento
const pinIconsCache = new Map();

/**
 * Normaliza la categoría eliminando acentos y espacios.
 */
export function normalizarCategoria(categoria) {
  return (categoria || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Genera un L.divIcon personalizado según la categoría del local,
 * soportando estados de selección y atenuado (dimmed).
 * @param {string} categoria - Ej: "Almuerzo", "Cafetería", "Minimarket", "Panadería"
 * @param {boolean} isSelected - Indica si el pin está seleccionado activamente
 * @param {boolean} isDimmed - Indica si el pin está atenuado por filtros
 */
export function crearPinIcon(categoria, isSelected = false, isDimmed = false) {
  const catKey = normalizarCategoria(categoria);
  const conf = CONFIG_CATEGORIAS[catKey] || CONFIG_CATEGORIAS.almuerzo;

  const cacheKey = `${catKey}_${isSelected}_${isDimmed}`;
  if (pinIconsCache.has(cacheKey)) {
    return pinIconsCache.get(cacheKey);
  }

  const classes = ['custom-pin'];
  if (isSelected) classes.push('sel');
  if (isDimmed) classes.push('dim');

  const icon = L.divIcon({
    className: classes.join(' '),
    iconSize: [34, 42],      // Ancho: 34px, Alto total (34 círculo + 8 flecha): 42px
    iconAnchor: [17, 42],    // Coordenada exacta en la punta inferior (centro X: 17px, base Y: 42px)
    popupAnchor: [0, -42],   // En caso de usar popup, abre por encima
    html: `
      <div class="pin-circulo-puntero">
        <div class="pin-circulo-cuerpo" style="background-color: ${conf.color};">
          <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            ${conf.svgPath}
          </svg>
        </div>
        <div class="pin-circulo-flecha" style="border-top: 8px solid ${conf.color};"></div>
      </div>
    `
  });

  pinIconsCache.set(cacheKey, icon);
  return icon;
}
