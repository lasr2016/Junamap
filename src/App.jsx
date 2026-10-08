import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import localesData from "./data/locales.json";
import "./App.css";

// Categorías y Colores oficiales de JunaMap
const CATS = {
  Almuerzo: "#e4572e",
  Cafetería: "#8a5a3b",
  Minimarket: "#2a7de1",
  Panadería: "#e0a100"
};

const CAT_ORDER = Object.keys(CATS);

// Lista de productos para búsqueda
const PRODUCT_LIST = [
  "Completos",
  "Almuerzo casero",
  "Pizzas",
  "Hamburguesas",
  "Empanadas",
  "Sushi",
  "Hand rolls",
  "Plato de ensalada",
  "Café de especialidad",
  "Té",
  "Tostadas",
  "Pasteles",
  "Donas",
  "Muffins",
  "Galletas",
  "Golosinas",
  "Snacks",
  "Bebidas",
  "Jugos",
  "Yogur",
  "Lácteos",
  "Aguas minerales",
  "Pan con agregado"
];

// Cache para iconos personalizados para óptimo rendimiento de renderizado
const pinIconsCache = new Map();

function getPinIcon(color, isSelected, isDimmed) {
  const key = `${color}_${isSelected}_${isDimmed}`;
  if (pinIconsCache.has(key)) {
    return pinIconsCache.get(key);
  }

  const svgHtml = `
    <svg class="pin-svg" viewBox="0 0 28 38">
      <path d="M14 38 C 2 24 0 18 0 14 A 14 14 0 0 1 28 14 C 28 18 26 24 14 38 Z" 
            fill="${color}" 
            stroke="#ffffff" 
            stroke-width="2.5"/>
      <circle cx="14" cy="14" r="4.5" fill="#ffffff"/>
    </svg>
  `;

  const classes = ["custom-pin"];
  if (isSelected) classes.push("sel");
  if (isDimmed) classes.push("dim");

  const icon = L.divIcon({
    className: classes.join(" "),
    html: svgHtml,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -38]
  });

  pinIconsCache.set(key, icon);
  return icon;
}

// Icono animado de pulso tipo radar para la posición del usuario
const userLocationIcon = L.divIcon({
  className: "user-location-marker",
  html: '<div class="user-dot"><div class="user-dot-halo"></div><div class="user-dot-core"></div></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22]
});

// Fórmula Haversine para cálculo de distancia en metros
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

// Formatear distancia para mostrar
function distStr(d, gpsActive) {
  if (!gpsActive || d == null) return "";
  return d < 1000 ? `a ${Math.round(d)} m` : `a ${(d / 1000).toFixed(1)} km`;
}

// Formatear horas (ej. 8 -> 8:00, 15.5 -> 15:30)
function fmt(h) {
  if (h == null) return "";
  const m = Math.round((h % 1) * 60);
  return Math.floor(h) + ":" + String(m).padStart(2, "0");
}

// Verificar si el local está abierto según horario simulado
function isLocalOpen(l) {
  if (l.abre == null || l.cierra == null) return true;
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  return currentHour >= l.abre && currentHour < l.cierra;
}

// Controlador del Mapa Leaflet para centrado, animación y clics
function MapController({ onMapClick, activeLocal, userCoords, gpsFlyCount }) {
  const map = useMap();

  useEffect(() => {
    const handleClick = () => {
      onMapClick();
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onMapClick]);

  // Centrado con offset vertical de 90px para dar espacio al Bottom Sheet
  useEffect(() => {
    if (activeLocal && map) {
      const targetLatLng = L.latLng(activeLocal.lat, activeLocal.lng);
      const targetPoint = map.project(targetLatLng, 15);
      const offsetY = 90;
      const newPoint = L.point(targetPoint.x, targetPoint.y + offsetY);
      const newLatLng = map.unproject(newPoint, 15);
      map.setView(newLatLng, 15, { animate: true });
    }
  }, [activeLocal, map]);

  // Volar a la posición del usuario al activar GPS
  useEffect(() => {
    if (gpsFlyCount > 0 && userCoords && map) {
      map.flyTo([userCoords.lat, userCoords.lng], 16, { animate: true });
    }
  }, [gpsFlyCount, userCoords, map]);

  return null;
}

export default function App() {
  // Estado de búsqueda y categorías
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [activeLocalId, setActiveLocalId] = useState(null);

  // Estado de ubicación GPS
  const [userCoords, setUserCoords] = useState({ lat: -35.426, lng: -71.655 });
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFlyCount, setGpsFlyCount] = useState(0);
  const [showLocTooltip, setShowLocTooltip] = useState(false);

  // Estados de Drawer y Modal "Registrar mi local"
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerSuccessView, setRegisterSuccessView] = useState(false);

  // Estados del Bottom Sheet (0: Peek 66px, 1: 50% mitad, 2: 80% máximo)
  const [sheetState, setSheetState] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [appHeight, setAppHeight] = useState(window.innerHeight);

  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const dragStartY = useRef(null);
  const dragStartOffset = useRef(0);
  const hasMoved = useRef(false);
  const tooltipTimeoutRef = useRef(null);

  // Resetear scroll del contenido del sheet al punto más alto al bajar o cerrar
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [sheetState]);

  // Actualizar altura de contenedor
  useEffect(() => {
    const updateSize = () => {
      const appEl = document.getElementById("app");
      if (appEl) {
        setAppHeight(appEl.clientHeight);
      } else {
        setAppHeight(window.innerHeight);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Alturas de snap [66 (grab handle), 50% appHeight (mitad), 80% appHeight (máximo)]
  const snapHeights = useMemo(() => {
    return [62, Math.round(appHeight * 0.5), Math.round(appHeight * 0.8)];
  }, [appHeight]);

  // Offset actual calculado de forma declarativa
  const currentOffset = isDragging
    ? dragOffset
    : snapHeights[2] - snapHeights[sheetState];

  // Mostrar tooltip GPS brevemente al inicio
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLocTooltip(true);
      tooltipTimeoutRef.current = setTimeout(() => {
        setShowLocTooltip(false);
      }, 8000);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const hideTooltip = () => {
    setShowLocTooltip(false);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  // Activar geolocalización
  const activarUbicacion = () => {
    hideTooltip();
    setGpsLoading(true);

    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      setGpsLoading(false);
      setGpsFlyCount((c) => c + 1);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGpsActive(true);
        setGpsLoading(false);
        setGpsFlyCount((c) => c + 1);
      },
      (err) => {
        setGpsLoading(false);
        console.warn("Error de geolocalización:", err);
        if (err.code === 1) {
          alert("El permiso de ubicación fue bloqueado o denegado en el navegador. Haz clic en el candado o icono de configuración en la barra de direcciones de tu navegador y permite el acceso a la ubicación.");
        } else if (err.code === 2) {
          alert("No se pudo obtener tu ubicación actual. Comprueba la señal GPS de tu dispositivo.");
        } else if (err.code === 3) {
          alert("Se agotó el tiempo de espera al intentar obtener tu ubicación.");
        }
        setGpsFlyCount((c) => c + 1);
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // Locales con distancia calculada
  const localesWithDist = useMemo(() => {
    return localesData.map((l) => ({
      ...l,
      d: gpsActive
        ? calcDist(userCoords.lat, userCoords.lng, l.lat, l.lng)
        : null
    }));
  }, [gpsActive, userCoords]);

  // Filtrado de locales
  const visibleLocales = useMemo(() => {
    return localesWithDist
      .filter((l) => {
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
      })
      .sort((a, b) => {
        if (gpsActive) {
          return (a.d ?? Infinity) - (b.d ?? Infinity);
        }
        const ia = CAT_ORDER.indexOf(a.tipo);
        const ib = CAT_ORDER.indexOf(b.tipo);
        if (ia !== ib) return ia - ib;
        return a.nombre.localeCompare(b.nombre, "es");
      });
  }, [localesWithDist, selectedCategory, searchTerm, gpsActive, selectedProduct]);

  // Local activo seleccionado (evaluado declarativamente entre los visibles)
  const activeLocal = useMemo(() => {
    if (activeLocalId === null) return null;
    return visibleLocales.find((l) => l.id === activeLocalId) || null;
  }, [visibleLocales, activeLocalId]);

  // Manejar selección de local
  const handleSelectLocal = (id) => {
    setActiveLocalId(id);
    if (sheetState === 0 || sheetState === 2) {
      setSheetState(1);
    }
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  };

  // Manejar clic en mapa (deselección)
  const handleMapClick = useCallback(() => {
    if (activeLocalId !== null) {
      setActiveLocalId(null);
    }
  }, [activeLocalId]);

  // Drag del Bottom Sheet
  const handlePointerDown = (e) => {
    dragStartY.current = e.clientY;
    dragStartOffset.current = currentOffset;
    hasMoved.current = false;
    setIsDragging(true);
    setDragOffset(currentOffset);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragStartY.current === null) return;
    hasMoved.current = true;
    const dy = e.clientY - dragStartY.current;
    const maxOffset = snapHeights[2] - snapHeights[0];
    const newOffset = Math.max(0, Math.min(maxOffset, dragStartOffset.current + dy));
    setDragOffset(newOffset);
  };

  const handlePointerUp = (e) => {
    if (dragStartY.current === null) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    const maxH = snapHeights[2];
    const currentVisH = maxH - dragOffset;

    let targetState;
    if (hasMoved.current) {
      // Snap al estado más cercano
      targetState = snapHeights.reduce(
        (bestIdx, h, idx) =>
          Math.abs(h - currentVisH) < Math.abs(snapHeights[bestIdx] - currentVisH)
            ? idx
            : bestIdx,
        0
      );
    } else {
      // Clic simple en el grab handle: si está arriba del todo, oculta/baja (estado 0), si no sube
      targetState = sheetState === 2 ? 0 : (sheetState + 1) % 3;
    }

    dragStartY.current = null;
    setSheetState(targetState);
  };

  const instructionText =
    sheetState === 0
      ? "Desliza hacia arriba para buscar por Comida o Local"
      : sheetState === 1
        ? "Desliza otra vez para ver más"
        : "Presiona aquí para ocultar";

  // Cerrar Drawer o Modal con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isRegisterModalOpen) {
          setIsRegisterModalOpen(false);
          setRegisterSuccessView(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRegisterModalOpen, isDrawerOpen]);

  // Enviar formulario "Registrar mi local"
  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setRegisterSuccessView(true);
  };

  // Posición dinámica del FAB
  const visibleSheetH = snapHeights[2] - currentOffset;
  const fabBottom = Math.min(visibleSheetH, snapHeights[1]) + 14;


  return (
    <div id="app">
      {/* MAPA LEAFLET */}
      <div id="map">
        <MapContainer
          center={[userCoords.lat, userCoords.lng]}
          zoom={15}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
        >
          <TileLayer
            maxZoom={19}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marcador animado de ubicación del usuario */}
          {gpsActive && (
            <Marker
              position={[userCoords.lat, userCoords.lng]}
              icon={userLocationIcon}
              zIndexOffset={1000}
            />
          )}

          {/* Marcadores SVG de locales */}
          {localesWithDist.map((local) => {
            const isVisible = visibleLocales.some((vl) => vl.id === local.id);
            const isSelected = activeLocal?.id === local.id;
            const pinColor = CATS[local.tipo] || "#1d6b3f";
            const icon = getPinIcon(pinColor, isSelected, !isVisible);

            return (
              <Marker
                key={local.id}
                position={[local.lat, local.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => handleSelectLocal(local.id)
                }}
              />
            );
          })}

          <MapController
            onMapClick={handleMapClick}
            activeLocal={activeLocal}
            userCoords={userCoords}
            gpsFlyCount={gpsFlyCount}
          />
        </MapContainer>
      </div>

      {/* CONTROLES SUPERIORES */}
      <div className="top">
        {/* Barra de búsqueda */}
        <div className="search">
          <button
            className="ib menu-btn"
            id="open-menu"
            aria-label="Abrir menú"
            onClick={() => setIsDrawerOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <input
            id="q"
            type="search"
            placeholder="Buscar comida, sector o local"
            aria-label="Buscar comida, sector o local"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedProduct) setSelectedProduct(null);
            }}
            onClick={() => setSheetState(2)}
          />

          <button className="ib" aria-label="Buscar">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
          </button>
        </div>

        {/* Chips de Categorías */}
        <div className="chips" id="chips">
          {["Todos", ...CAT_ORDER].map((c) => {
            const isCatActive = selectedCategory === c;
            const catColor = CATS[c] || "#1d6b3f";
            return (
              <button
                key={c}
                className={`chip ${isCatActive ? "on" : ""}`}
                style={{ "--c": catColor }}
                onClick={() => setSelectedCategory(c)}
              >
                {CATS[c] && <i />}
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTÓN UBICACIÓN (FAB) Y TOOLTIP */}
      <div className="fab-wrapper" style={{ bottom: `${fabBottom}px` }}>
        <div
          className={`loc-tooltip ${showLocTooltip ? "show" : ""}`}
          id="loc-tooltip"
          role="tooltip"
        >
          <span>Te recomendamos activar la ubicación para una mejor experiencia</span>
          <button
            className="loc-tooltip-close"
            id="loc-tooltip-close"
            aria-label="Cerrar notificación"
            onClick={hideTooltip}
          >
            &times;
          </button>
        </div>

        <button
          className={`fab ${gpsLoading ? "loading" : ""}`}
          id="loc"
          aria-label="Mi ubicación"
          onClick={activarUbicacion}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>

      {/* BOTTOM SHEET */}
      <section
        className={`sheet ${isDragging ? "drag" : ""}`}
        id="sheet"
        ref={sheetRef}
        style={{
          height: `${snapHeights[2]}px`,
          transform: `translateY(${currentOffset}px)`
        }}
        aria-live="polite"
      >
        {/* Agarradera / Grab handle */}
        <div
          className="grab"
          id="grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <b />
          <p className="grab-instruction">
            {instructionText}
          </p>
        </div>

        {/* Contenido / Body del Sheet */}
        <div
          className="body"
          id="body"
          ref={bodyRef}
          style={{
            maxHeight: `${Math.max(0, visibleSheetH - snapHeights[0])}px`
          }}
        >
          {/* Tarjeta del Local Activo */}
          {activeLocal && (
            <div
              className="card main"
              style={{ "--c": CATS[activeLocal.tipo] || "#1d6b3f" }}
            >
              <div className="row1">
                <div>
                  <h3 className="name">{activeLocal.nombre}</h3>
                  <div className="meta">
                    {activeLocal.tipo}
                    {gpsActive && activeLocal.d != null && (
                      <> · {distStr(activeLocal.d, gpsActive)}</>
                    )}
                  </div>
                </div>
                <div className="card-top-actions">
                  <span className={`tag ${isLocalOpen(activeLocal) ? "o" : "c"}`}>
                    {isLocalOpen(activeLocal) ? "Abierto" : "Cerrado"}
                  </span>
                  <button
                    type="button"
                    className="card-close-btn"
                    aria-label="Cerrar detalle de local"
                    onClick={() => setActiveLocalId(null)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>

              {activeLocal.descripcion && (
                <div className="meta" style={{ marginTop: "8px" }}>
                  {activeLocal.descripcion}
                </div>
              )}

              <div className="meta">
                {isLocalOpen(activeLocal)
                  ? `Cierra a las ${fmt(activeLocal.cierra)}`
                  : `Abre a las ${fmt(activeLocal.abre)}`}{" "}
                · {activeLocal.direccion}
              </div>

              {activeLocal.metodo_cobro && (
                <div className="meta" style={{ fontSize: "11px", fontWeight: "600" }}>
                  Cobro: {activeLocal.metodo_cobro}
                </div>
              )}

              <div className="cta">
                <a
                  className="btn"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activeLocal.lat},${activeLocal.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Cómo llegar
                </a>
                {activeLocal.telefono && (
                  <a className="btn s" href={`tel:${activeLocal.telefono}`}>
                    Llamar
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 3 Filas de Productos Marcables */}
          <div className="products-selection-section">
            <div className="products-grid-rows">
              {[
                PRODUCT_LIST.slice(0, 8),
                PRODUCT_LIST.slice(8, 16),
                PRODUCT_LIST.slice(16)
              ].map((row, rIdx) => (
                <div key={rIdx} className="products-row-scroll">
                  {row.map((prod) => {
                    const isSelected = selectedProduct === prod;
                    return (
                      <button
                        key={prod}
                        type="button"
                        className={`product-pill-btn ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          setSelectedProduct((curr) => {
                            const next = curr === prod ? null : prod;
                            if (next) setSearchTerm("");
                            return next;
                          });
                        }}
                      >
                        {prod}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* Subtítulo de orden */}
          {visibleLocales.length > 0 && (
            <div className="sub">
              {selectedProduct
                ? `Locales con ${selectedProduct} (${visibleLocales.length})`
                : gpsActive
                  ? "Ordenados por cercanía"
                  : "Ordenados por categoría"}
            </div>
          )}

          {/* Mensaje de vacío */}
          {visibleLocales.length === 0 && (
            <div className="empty">No se encuentran locales con esos criterios</div>
          )}

          {/* Lista de locales */}
          {visibleLocales.map((local, idx) => (
            <div
              key={local.id}
              className="item"
              style={{ "--c": CATS[local.tipo] || "#1d6b3f" }}
              onClick={() => handleSelectLocal(local.id)}
            >
              <span className="ic" />
              <div className="t">
                <b>{local.nombre}</b>
                <small>
                  {local.tipo} · {isLocalOpen(local) ? "Abierto" : "Cerrado"}
                </small>
              </div>

              {gpsActive ? (
                <span className="d">{distStr(local.d, gpsActive)}</span>
              ) : idx === 0 ? (
                <button
                  type="button"
                  className="d d-gps"
                  onClick={(e) => {
                    e.stopPropagation();
                    activarUbicacion();
                  }}
                >
                  Activa tu ubicación para ver distancias
                </button>
              ) : (
                <span className="d" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* BACKDROP Y MENÚ LATERAL (DRAWER) */}
      <div
        className={`drawer-backdrop ${isDrawerOpen ? "active" : ""}`}
        id="drawer-backdrop"
        aria-hidden={!isDrawerOpen}
        onClick={() => setIsDrawerOpen(false)}
      />

      <aside
        className={`drawer ${isDrawerOpen ? "open" : ""}`}
        id="drawer"
        aria-label="Menú principal"
        aria-hidden={!isDrawerOpen}
      >
        <div className="drawer-header">
          <span className="drawer-logo">JunaMap</span>
          <button
            className="ib-close"
            id="close-drawer"
            aria-label="Cerrar menú"
            onClick={() => setIsDrawerOpen(false)}
          >
            &times;
          </button>
        </div>

        <div className="drawer-content">
          <button
            className="drawer-btn-primary"
            id="btn-open-register"
            onClick={() => {
              setIsDrawerOpen(false);
              setRegisterSuccessView(false);
              setIsRegisterModalOpen(true);
            }}
          >
            Registrar mi local &rarr;
          </button>

          <div className="drawer-item disabled">
            <span>Iniciar sesión</span>
            <span className="badge-disabled">Próximamente</span>
          </div>

          <hr className="drawer-divider" />

          <div
            className="drawer-item simple"
            onClick={() => alert("Para reportar un local o error, contáctanos en contacto@junamap.cl")}
          >
            <span>Reportar un error</span>
          </div>

          <div
            className="drawer-item simple"
            onClick={() =>
              alert(
                "JunaMap Talca · Plataforma colaborativa para estudiantes que utilizan su beca BAES."
              )
            }
          >
            <span>Acerca de JunaMap</span>
          </div>
        </div>

        <div className="drawer-footer">
          <p>
            Datos de demostración · Creado con{" "}
            <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">
              Leaflet
            </a>{" "}
            +{" "}
            <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">
              OpenStreetMap
            </a>{" "}
            · UCM — Taller de Desarrollo de Software
          </p>
        </div>
      </aside>

      {/* MODAL / FORMULARIO "REGISTRAR MI LOCAL" */}
      <section
        className={`modal-form-page ${isRegisterModalOpen ? "open" : ""}`}
        id="register-modal"
        aria-label="Formulario Registrar mi local"
        aria-hidden={!isRegisterModalOpen}
      >
        <div className="modal-header">
          <button
            className="ib-close"
            id="close-register-modal"
            aria-label="Cerrar formulario"
            onClick={() => {
              setIsRegisterModalOpen(false);
              setRegisterSuccessView(false);
            }}
          >
            &times;
          </button>
          <h2 className="modal-title">Registrar mi local</h2>
        </div>

        <div className="modal-body">
          {!registerSuccessView ? (
            <div id="modal-form-view">
              <p className="modal-description">
                Completa los datos y revisaremos tu solicitud antes de publicarla en el mapa.
              </p>

              <form
                id="form-register-local"
                className="register-form"
                onSubmit={handleRegisterSubmit}
              >
                <div className="form-group">
                  <label htmlFor="reg-nombre">
                    Nombre del local <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    id="reg-nombre"
                    required
                    placeholder="Nombre del comercio"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-categoria">
                    Categoría <span className="req">*</span>
                  </label>
                  <select id="reg-categoria" required defaultValue="Almuerzo">
                    <option value="Almuerzo">Almuerzo</option>
                    <option value="Cafetería">Cafetería</option>
                    <option value="Minimarket">Minimarket</option>
                    <option value="Panadería">Panadería</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-direccion">
                    Dirección <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    id="reg-direccion"
                    required
                    placeholder="Calle y número, Talca"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="reg-abre">Abre</label>
                    <input type="time" id="reg-abre" defaultValue="09:00" />
                  </div>
                  <div className="form-group flex-1">
                    <label htmlFor="reg-cierra">Cierra</label>
                    <input type="time" id="reg-cierra" defaultValue="20:00" />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-telefono">Teléfono (opcional)</label>
                  <input
                    type="tel"
                    id="reg-telefono"
                    placeholder="+56 9 1234 5678"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-email">
                    Correo de contacto <span className="req">*</span>
                  </label>
                  <input
                    type="email"
                    id="reg-email"
                    required
                    placeholder="contacto@tulocal.cl"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" id="reg-check" required />
                    <span>Confirmo que mi local acepta tarjeta Junaeb/BAES</span>
                  </label>
                </div>

                <button type="submit" className="btn-submit-form">
                  Enviar solicitud · Próximamente
                </button>
              </form>
            </div>
          ) : (
            <div id="modal-success-view">
              <div className="form-placeholder-state">
                <div className="icon">🚧</div>
                <h3>Próximamente</h3>
                <p>
                  El registro de locales aún no está disponible. Pronto podrás enviar tu solicitud desde aquí.
                </p>
                <button
                  type="button"
                  className="btn-back"
                  id="btn-back-to-map"
                  onClick={() => {
                    setIsRegisterModalOpen(false);
                    setRegisterSuccessView(false);
                  }}
                >
                  Volver al mapa
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
