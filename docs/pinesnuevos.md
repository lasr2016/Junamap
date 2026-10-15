# Guía de Implementación: Nuevo Diseño de Pines de Categorías para JunaMap

Este documento detalla cómo migrar e implementar el nuevo diseño visual de pines (*Círculo minimalista con puntero e ícono SVG*) en el mapa interactivo de **JunaMap** (React + Leaflet / React-Leaflet + Tailwind CSS).

---

## 🎨 Paleta de Colores y Coherencia Visual

Para mantener total coherencia entre los **pines del mapa**, las **etiquetas/chips de filtros rápidos** y las **tarjetas del Bottom Sheet**, se debe usar exactamente esta misma paleta para las 4 categorías principales:

| Categoría | Color Hex | Muestra | Descripción |
| :--- | :---: | :---: | :--- |
| **Almuerzo** | `#d8502c` | 🟧 | Naranja rojizo / terracota cálido |
| **Cafetería** | `#8b5336` | 🟫 | Marrón tostado / café cálido |
| **Minimarket**| `#257ce6` | 🟦 | Azul brillante institucional |
| **Panadería** | `#df9800` | 🟨 | Amarillo dorado / ámbar mostaza |

> **Nota de coherencia:** Si ya tienes botones o badges de estas categorías en los filtros o listados, asegúrate de unificar sus colores de acento con estos valores hexadecimales para lograr un diseño armónico en toda la app.

---

## 1. Estilos CSS Globales

Agrega las siguientes clases en tu archivo global de estilos (por ejemplo, en `src/index.css` o `src/App.css`):

```css
/* 1. Reset para que Leaflet no añada marcos ni fondos blancos por defecto a los divIcon */
.leaflet-div-icon {
  background: transparent !important;
  border: none !important;
}

/* 2. Contenedor principal del pin */
.pin-circulo-puntero {
  width: 34px;
  height: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.22));
  transition: transform 0.15s ease;
  cursor: pointer;
}

.pin-circulo-puntero:hover {
  transform: scale(1.15) translateY(-3px);
  z-index: 1000 !important;
}

/* 3. Círculo superior con el ícono SVG centrado */
.pin-circulo-cuerpo {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pin-circulo-cuerpo svg {
  width: 18px;
  height: 18px;
}

/* 4. Flecha/puntero inferior que señala la coordenada exacta */
.pin-circulo-flecha {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  /* El color de border-top se inyecta dinámicamente según la categoría */
}
```

---

## 2. Utilidad / Helper para Generar el Icono (`L.divIcon`)

Crea un archivo helper en tu proyecto, por ejemplo `src/utils/pinIcons.js` (o `.ts`):

```javascript
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
    svgPath: '<path d="M2.5 14C2 11.5 4 8.5 7.5 7C11.5 5 18 5 21 8.5C22.5 10.5 22.5 13 21 14.5C18.5 17 11.5 17.5 5.5 16.5C3.5 16 2.8 15.2 2.5 14Z"/><path d="M7 8.5L9.5 13.5"/><path d="M11.5 7.5L14 12.5"/><path d="M16 8L18.5 12"/>' // baguette
  }
};

/**
 * Genera un L.divIcon personalizado según la categoría del local.
 * @param {string} categoria - Ej: "almuerzo", "cafeteria", "minimarket", "panaderia"
 */
export function crearPinIcon(categoria) {
  // Normalizar categoría en minúsculas y sin acentos para evitar fallos de coincidencia
  const catKey = (categoria || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const conf = CONFIG_CATEGORIAS[catKey] || CONFIG_CATEGORIAS.almuerzo;

  return L.divIcon({
    className: '',
    iconSize: [34, 42],      // Ancho: 34px, Alto total (34 círculo + 8 flecha): 42px
    iconAnchor: [17, 42],    // Coordenada exacta en la punta inferior (centro X: 17px, base Y: 42px)
    popupAnchor: [0, -42],   // El popup abre justo por encima del círculo
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
}
```

---

## 3. Integración en el Componente del Mapa (`React-Leaflet`)

En tu componente de React donde renderizas los marcadores de los locales (generalmente dentro de `MapContainer`):

```jsx
import { Marker, Popup } from 'react-leaflet';
import { crearPinIcon } from '../utils/pinIcons'; // Ajustar ruta según corresponda

function MapaLocales({ locales, onSelectLocal }) {
  return (
    <>
      {locales.map((local) => (
        <Marker
          key={local.id}
          position={[local.lat, local.lng]}
          icon={crearPinIcon(local.categoria)}
          eventHandlers={{
            click: () => {
              if (onSelectLocal) onSelectLocal(local);
            }
          }}
        >
          <Popup>
            <div className="font-sans text-sm">
              <strong className="block text-gray-900 font-semibold">{local.nombre}</strong>
              <span className="text-xs text-gray-500 capitalize">{local.categoria}</span>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default MapaLocales;
```

---

## ✅ Resumen de Beneficios
- **Cero dependencias pesadas:** No carga imágenes PNG externas; usa vectores SVG inline y CSS nativo ultraligero.
- **Micro-interacción integrada:** Efecto *hover* con elevación suave para mejorar la experiencia de usuario.
- **Anclaje milimétrico:** `iconAnchor: [17, 42]` garantiza que el pin apunte exactamente a la coordenada GPS del local sin desplazamientos al hacer zoom.
