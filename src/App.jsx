import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import localesData from "./data/locales.json";
import { getLocales, postularLocal, getLocalesPendientes, moderarLocal } from "./services/localService";
import { crearPinIcon } from "./utils/pinIcons";
import "./App.css";

// Categorías y Colores oficiales de JunaMap
const CATS = {
  Almuerzo: "#d8502c",
  Cafetería: "#8b5336",
  Minimarket: "#257ce6",
  Panadería: "#df9800"
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

// Convertir valor de hora (TIME o numérico) a minutos para comparaciones precisas
function toMinutes(val) {
  if (val == null) return null;
  if (typeof val === "string") {
    const parts = val.split(":");
    if (parts.length >= 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
  }
  if (typeof val === "number") {
    return Math.round(val * 60);
  }
  return null;
}

// Formatear horas (soporta formato TIME 'HH:MM[:SS]' y número decimal '8.5')
function fmt(h) {
  if (h == null) return "";
  if (typeof h === "string") {
    const parts = h.split(":");
    if (parts.length >= 2) {
      return `${parseInt(parts[0], 10)}:${parts[1]}`;
    }
    return h;
  }
  const m = Math.round((h % 1) * 60);
  return Math.floor(h) + ":" + String(m).padStart(2, "0");
}

// Verificar si el local está abierto según horario actual
function isLocalOpen(l) {
  if (l.abre == null || l.cierra == null) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const abreMin = toMinutes(l.abre);
  const cierraMin = toMinutes(l.cierra);

  if (abreMin == null || cierraMin == null) return true;
  return currentMinutes >= abreMin && currentMinutes < cierraMin;
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
  // Locales cargados desde Supabase (con fallback a localesData)
  const [locales, setLocales] = useState(localesData);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [registerError, setRegisterError] = useState("");

  // Carga asíncrona de locales verificados desde Supabase (PBI-06 / AC-10)
  useEffect(() => {
    let isMounted = true;
    getLocales().then((data) => {
      if (isMounted && data && data.length > 0) {
        setLocales(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  // Estados de Modal "Sugerencia"
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestSuccessView, setSuggestSuccessView] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Estados de Panel de Administración / Moderación (PBI-05 / AC-09)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [localesPendientes, setLocalesPendientes] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [suggestItems, setSuggestItems] = useState([
    { id: 1, nombre: "", direccion: "", tipo: "Almuerzo" }
  ]);

  const handleAddSuggestItem = () => {
    setSuggestItems((prev) => {
      if (prev.length >= 3) return prev;
      return [
        ...prev,
        { id: Date.now(), nombre: "", direccion: "", tipo: "Almuerzo" }
      ];
    });
  };

  const handleUpdateSuggestItem = (index, field, value) => {
    setSuggestItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveSuggestItem = (index) => {
    setSuggestItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const resetSuggestForm = () => {
    setIsSuggestModalOpen(false);
    setSuggestSuccessView(false);
    setSuggestItems([{ id: 1, nombre: "", direccion: "", tipo: "Almuerzo" }]);
  };

  // Estados del Bottom Sheet (0: Peek 66px, 1: 50% mitad, 2: 80% máximo)
  const [sheetState, setSheetState] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [appHeight, setAppHeight] = useState(window.innerHeight);

  // Filtros activos: categoría distinta a 'Todos' o comida seleccionada
  const hasActiveFilters = selectedCategory !== "Todos" || selectedProduct !== null;

  const handleClearFilters = () => {
    setSelectedCategory("Todos");
    setSelectedProduct(null);
    if (bodyRef.current) {
      const rows = bodyRef.current.querySelectorAll(".products-row-scroll");
      rows.forEach((row) => {
        row.scrollLeft = 0;
      });
    }
  };

  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const dragStartY = useRef(null);
  const dragStartOffset = useRef(0);
  const hasMoved = useRef(false);
  const tooltipTimeoutRef = useRef(null);

  // Resetear scroll del contenido del sheet al punto más alto al bajar o cerrar,
  // y reiniciar el scroll horizontal de los filtros de productos a la izquierda
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
      if (sheetState === 0) {
        const rows = bodyRef.current.querySelectorAll(".products-row-scroll");
        rows.forEach((row) => {
          row.scrollLeft = 0;
        });
      }
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
    return locales.map((l) => ({
      ...l,
      d: gpsActive
        ? calcDist(userCoords.lat, userCoords.lng, l.lat, l.lng)
        : null
    }));
  }, [locales, gpsActive, userCoords]);

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
        if (isAboutModalOpen) {
          setIsAboutModalOpen(false);
        } else if (isRegisterModalOpen) {
          setIsRegisterModalOpen(false);
          setRegisterSuccessView(false);
        } else if (isSuggestModalOpen) {
          setIsSuggestModalOpen(false);
          setSuggestSuccessView(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAboutModalOpen, isRegisterModalOpen, isSuggestModalOpen, isDrawerOpen]);

  // Enviar formulario "Registrar mi local" a Supabase (PBI-04 / AC-08)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError("");
    setIsSubmittingRegister(true);

    const form = e.target;
    const formData = {
      nombre: form["reg-nombre"].value,
      tipo: form["reg-categoria"].value,
      direccion: form["reg-direccion"].value,
      abre: form["reg-abre"].value || "09:00",
      cierra: form["reg-cierra"].value || "20:00",
      telefono: form["reg-telefono"].value || null,
      descripcion: `Contacto: ${form["reg-email"].value}. Postulación desde la web.`,
      lat: userCoords.lat, // Georreferenciado a la posición en Talca
      lng: userCoords.lng,
      metodo_cobro: "Edenred POS"
    };

    try {
      await postularLocal(formData);
      setIsSubmittingRegister(false);
      setRegisterSuccessView(true);
    } catch (err) {
      console.error("Error al enviar postulación:", err);
      setIsSubmittingRegister(false);
      setRegisterError(err.message || "No se pudo enviar la solicitud. Intenta nuevamente.");
    }
  };

  // Enviar formulario "Sugerencia"
  const handleSuggestSubmit = (e) => {
    e.preventDefault();
    setSuggestSuccessView(true);
  };

  // Cargar locales pendientes de moderación
  const cargarPendientes = async () => {
    setAdminLoading(true);
    const data = await getLocalesPendientes();
    setLocalesPendientes(data);
    setAdminLoading(false);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPass === "admin123" || adminPass === "junamap2026") {
      setIsAdminAuthenticated(true);
      cargarPendientes();
    } else {
      alert("Contraseña de administrador incorrecta");
    }
  };

  const handleModerar = async (id, accion) => {
    try {
      await moderarLocal(id, accion);
      alert(accion ? "Local aprobado y publicado exitosamente en el mapa." : "Local rechazado.");
      cargarPendientes();
      // Refrescar mapa
      const actualizados = await getLocales();
      setLocales(actualizados);
    } catch (err) {
      alert("Error al moderar local: " + err.message);
    }
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
          preferCanvas={true}
          wheelPxPerZoomLevel={120}
          className="w-full h-full"
        >
          <TileLayer
            maxZoom={19}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            updateWhenZooming={false}
            updateInterval={100}
            keepBuffer={4}
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
            const icon = crearPinIcon(local.tipo, isSelected, !isVisible);

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
          <span>Te recomendamos activar la ubicación para una mejor experiencia de usuario.</span>
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
            {hasActiveFilters && (
              <div className="filters-clear-wrapper">
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={handleClearFilters}
                  aria-label="Eliminar filtros aplicados"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Eliminar filtros</span>
                </button>
              </div>
            )}
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
        inert={!isDrawerOpen}
      >
        <div className="drawer-header">
          <div className="drawer-logo-container">
            <img src="/1favicon.svg" alt="JunaMap" className="drawer-logo-icon" />
            <span className="drawer-logo">JunaMap</span>
          </div>
          <button
            className="ib-close"
            id="close-drawer"
            aria-label="Cerrar menú"
            onClick={(e) => {
              e.currentTarget.blur();
              setIsDrawerOpen(false);
            }}
          >
            &times;
          </button>
        </div>

        <div className="drawer-content">
          {/* SECCIÓN BIENVENIDA / INICIAR SESIÓN */}
          <div className="drawer-auth-box">
            <h3 className="drawer-greeting">Hola 👋</h3>
            <p className="drawer-auth-subtext">
              Inicia sesión para guardar tus locales favoritos
            </p>
            <div className="drawer-auth-buttons">
              <button
                type="button"
                className="drawer-btn-auth primary"
                onClick={() => alert("Próximamente: Iniciar sesión")}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className="drawer-btn-auth secondary"
                onClick={() => alert("Próximamente: Crear cuenta")}
              >
                Crear cuenta
              </button>
            </div>
          </div>

          <hr className="drawer-divider" />

          {/* TARJETA ¿FALTA UN LOCAL EN EL MAPA? */}
          <div className="drawer-merchant-card">
            <h4 className="drawer-merchant-title">¿Falta un local en el mapa?</h4>
            <p className="drawer-merchant-desc">Ayúdanos a completarlo</p>
            <div className="drawer-missing-options">
              <button
                type="button"
                className="drawer-missing-btn"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setRegisterSuccessView(false);
                  setIsRegisterModalOpen(true);
                }}
              >
                Soy dueño
              </button>

              <button
                type="button"
                className="drawer-missing-btn"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setSuggestSuccessView(false);
                  setIsSuggestModalOpen(true);
                }}
              >
                Conozco uno
              </button>
            </div>
          </div>

          {/* ACCESO A PANEL DE MODERACIÓN (PBI-05 / AC-09) */}
          <div style={{ marginTop: "1.5rem", padding: "0 0.5rem" }}>
            <button
              type="button"
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px dashed #257ce6",
                background: "#f0f7ff",
                color: "#257ce6",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer"
              }}
              onClick={() => {
                setIsDrawerOpen(false);
                setIsAdminModalOpen(true);
              }}
            >
              🛡️ Panel de Moderación (Admin)
            </button>
          </div>

          <hr className="drawer-divider" />

          {/* SECCIÓN AYUDA */}
          <div className="drawer-section-title">AYUDA</div>

          <div
            className="drawer-item simple"
            onClick={() => alert("Para reportar un local o error, contáctanos en contacto@junamap.cl")}
          >
            <span>Reportar un error</span>
          </div>

          <div
            className="drawer-item simple"
            onClick={() => {
              setIsDrawerOpen(false);
              setIsAboutModalOpen(true);
            }}
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
        inert={!isRegisterModalOpen}
      >
        <div className="modal-header">
          <button
            className="ib-close"
            id="close-register-modal"
            aria-label="Cerrar formulario"
            onClick={(e) => {
              e.currentTarget.blur();
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

                {registerError && (
                  <p style={{ color: "#d8502c", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    {registerError}
                  </p>
                )}

                <button type="submit" className="btn-submit-form" disabled={isSubmittingRegister}>
                  {isSubmittingRegister ? "Enviando solicitud..." : "Enviar solicitud de verificación"}
                </button>
              </form>
            </div>
          ) : (
            <div id="modal-success-view">
              <div className="form-placeholder-state">
                <div className="icon">✅</div>
                <h3>¡Solicitud Enviada!</h3>
                <p>
                  Tu postulación ha sido registrada con éxito en estado <strong>Pendiente de Verificación</strong>. Nuestro equipo la revisará antes de publicarla en el mapa.
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

      {/* MODAL / PANEL DE MODERACIÓN ADMIN (PBI-05 / AC-09) */}
      <section
        className={`modal-form-page ${isAdminModalOpen ? "open" : ""}`}
        id="admin-modal"
        aria-label="Panel de Administración"
        inert={!isAdminModalOpen}
      >
        <div className="modal-header">
          <button
            className="ib-close"
            onClick={() => {
              setIsAdminModalOpen(false);
              setIsAdminAuthenticated(false);
              setAdminPass("");
            }}
          >
            &times;
          </button>
          <div className="modal-title-wrap">
            <span className="modal-badge-tag">ADMINISTRACIÓN</span>
            <h2 className="modal-title">Panel de Moderación</h2>
          </div>
        </div>

        <div className="modal-body-scroll" style={{ padding: "1.5rem" }}>
          {!isAdminAuthenticated ? (
            <form onSubmit={handleAdminLogin} style={{ maxWidth: "320px", margin: "2rem auto", textAlign: "center" }}>
              <p style={{ marginBottom: "1rem", color: "#666" }}>
                Ingresa la clave de administrador para moderar las postulaciones de locales.
              </p>
              <input
                type="password"
                placeholder="Clave (ej: admin123)"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #ccc",
                  marginBottom: "1rem",
                  fontSize: "1rem"
                }}
                required
              />
              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  background: "#1e293b",
                  color: "#fff",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Ingresar al Panel
              </button>
            </form>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Locales Pendientes de Verificación ({localesPendientes.length})</h3>
                <button
                  type="button"
                  onClick={cargarPendientes}
                  style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
                >
                  🔄 Actualizar
                </button>
              </div>

              {adminLoading ? (
                <p>Cargando postulaciones...</p>
              ) : localesPendientes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#666" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
                  <p>No hay locales pendientes por moderar en este momento.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {localesPendientes.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: "1rem",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <strong style={{ fontSize: "1.05rem" }}>{p.nombre}</strong>
                        <span style={{ fontSize: "0.8rem", background: "#e2e8f0", padding: "0.2rem 0.5rem", borderRadius: "4px" }}>
                          {p.tipo}
                        </span>
                      </div>
                      <p style={{ margin: "0.2rem 0", fontSize: "0.9rem", color: "#475569" }}>
                        📍 {p.direccion}
                      </p>
                      <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "#64748b" }}>
                        ⏰ Horario: {p.abre || "Sin horario"} - {p.cierra || "Sin horario"}
                      </p>
                      {p.descripcion && (
                        <p style={{ margin: "0.4rem 0", fontSize: "0.85rem", fontStyle: "italic", color: "#475569" }}>
                          "{p.descripcion}"
                        </p>
                      )}

                      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                        <button
                          type="button"
                          onClick={() => handleModerar(p.id, true)}
                          style={{
                            flex: 1,
                            padding: "0.6rem",
                            borderRadius: "6px",
                            border: "none",
                            background: "#16a34a",
                            color: "#fff",
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          ✅ Aprobar y Publicar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModerar(p.id, false)}
                          style={{
                            padding: "0.6rem 1rem",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            color: "#dc2626",
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MODAL "SUGERENCIA" */}
      <section
        className={`modal-form-page ${isSuggestModalOpen ? "open" : ""}`}
        id="suggest-modal"
        aria-label="Modal Sugerencia"
        inert={!isSuggestModalOpen}
      >
        <div className="modal-header">
          <button
            className="ib-close"
            id="close-suggest-modal"
            aria-label="Cerrar sugerencia"
            onClick={(e) => {
              e.currentTarget.blur();
              resetSuggestForm();
            }}
          >
            &times;
          </button>
          <h2 className="modal-title">Sugerencia</h2>
        </div>

        <div className="modal-body">
          {!suggestSuccessView ? (
            <div id="suggest-form-view">
              <p className="modal-description">
                ¿Conoces un local que acepte tarjeta BAES? Ayúdanos a sumarlo al mapa.
              </p>

              <form
                id="form-suggest-local"
                className="register-form"
                onSubmit={handleSuggestSubmit}
              >
                {suggestItems.map((item, idx) => (
                  <div key={item.id} className="suggest-item-block">
                    {idx > 0 && <hr className="suggest-divider" />}

                    {suggestItems.length > 1 && (
                      <div className="suggest-item-header">
                        <span className="suggest-item-tag">Local #{idx + 1}</span>
                        <button
                          type="button"
                          className="btn-remove-suggest"
                          onClick={() => handleRemoveSuggestItem(idx)}
                        >
                          Eliminar
                        </button>
                      </div>
                    )}

                    <div className="form-group">
                      <label htmlFor={`sug-nombre-${idx}`}>
                        {idx === 0 ? "Nombre del local" : `Nombre del local ${idx + 1}`}{" "}
                        <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        id={`sug-nombre-${idx}`}
                        required
                        value={item.nombre}
                        onChange={(e) => handleUpdateSuggestItem(idx, "nombre", e.target.value)}
                        placeholder="Ej: Casino Don Pepe, Minimarket..."
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`sug-direccion-${idx}`}>
                        {idx === 0 ? "Dirección" : `Dirección ${idx + 1}`}{" "}
                        <span className="opt">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        id={`sug-direccion-${idx}`}
                        value={item.direccion}
                        onChange={(e) => handleUpdateSuggestItem(idx, "direccion", e.target.value)}
                        placeholder="Ej: 1 Norte con 2 Oriente, o cerca de..."
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        {idx === 0 ? "Tipo de local" : `Tipo de local ${idx + 1}`}{" "}
                        <span className="req">*</span>
                      </label>
                      <div className="suggest-chips-grid">
                        {[...CAT_ORDER, "No estoy seguro"].map((c) => {
                          const isCatActive = item.tipo === c;
                          const catColor = c === "No estoy seguro" ? "#5a6b7c" : (CATS[c] || "#1d6b3f");
                          return (
                            <button
                              key={c}
                              type="button"
                              className={`chip suggest-chip ${isCatActive ? "on" : ""}`}
                              style={{ "--c": catColor }}
                              onClick={() => handleUpdateSuggestItem(idx, "tipo", c)}
                            >
                              <i />
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {suggestItems.length < 3 ? (
                  <button
                    type="button"
                    className="btn-add-more-suggest"
                    onClick={handleAddSuggestItem}
                  >
                    + Conozco otro más
                  </button>
                ) : (
                  <div className="suggest-max-reached-notice">
                    Máximo 3 sugerencias por envío
                  </div>
                )}

                <button type="submit" className="btn-submit-form" style={{ marginTop: "4px" }}>
                  Enviar sugerencia
                </button>
              </form>
            </div>
          ) : (
            <div id="suggest-success-view">
              <div className="form-placeholder-state">
                <div className="icon">🎉</div>
                <h3>Muchas gracias por tu contribución al mapa</h3>
                <p className="suggest-mode-notice">
                  actualmente no se están guardando estos datos - modo prueba
                </p>
                <button
                  type="button"
                  className="btn-back"
                  id="btn-back-to-map-suggest"
                  onClick={resetSuggestForm}
                >
                  Volver al mapa
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MODAL / NOTIFICACIÓN "ACERCA DE JUNAMAP" */}
      <div
        className={`about-dialog-backdrop ${isAboutModalOpen ? "open" : ""}`}
        id="about-modal-backdrop"
        onClick={() => setIsAboutModalOpen(false)}
        inert={!isAboutModalOpen}
      >
        <div
          className="about-dialog-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-dialog-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="about-dialog-header">
            <div className="about-dialog-title-wrap">
              <span className="about-dialog-logo-dot" />
              <h2 id="about-dialog-title" className="about-dialog-title">
                Acerca de JunaMap
              </h2>
            </div>
            <button
              type="button"
              className="about-dialog-close"
              aria-label="Cerrar notificación"
              onClick={(e) => {
                e.currentTarget.blur();
                setIsAboutModalOpen(false);
              }}
            >
              &times;
            </button>
          </div>

          <div className="about-dialog-body">
            <div className="about-dialog-section">
              <h3>Aviso de independencia y no afiliación</h3>
              <p>
                Esta aplicación es una iniciativa comunitaria e independiente desarrollada
                con fines meramente informativos para la comunidad estudiantil. No cuenta
                con afiliación, patrocinio, respaldo ni vínculo oficial con la Junta Nacional
                de Auxilio Escolar y Becas (JUNAEB), la Beca de Alimentación para la Educación
                Superior (BAES), el Ministerio de Educación ni las empresas operadoras del
                beneficio (Edenred, Pluxee/Sodexo). Todas las marcas, logotipos y nombres
                comerciales mencionados pertenecen exclusivamente a sus respectivos titulares.
              </p>
            </div>

            <div className="about-dialog-section">
              <h3>Sobre los datos, comercios y vigencia</h3>
              <p>
                La disponibilidad de los locales, los precios, horarios y la aceptación
                efectiva del saldo dependen exclusivamente de las políticas de cada comercio
                y del estado operativo del servicio en cada momento. La información exhibida
                es referencial; se recomienda confirmar la aceptación del medio de pago en caja
                antes del consumo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
