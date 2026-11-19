import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import localesData from "./data/locales.json";
import {
  supabase,
  getLocales,
  getLocalesWithStatus,
  postularLocal,
  getLocalesPendientes,
  moderarLocal,
  getHistorialModeracion,
  crearReporteLocal,
  getReportesLocales,
  resolverReporteLocal,
  limpiarLocalesPrueba,
  loginAdmin,
  solicitarResetPasswordAdmin,
  cambiarPasswordAdmin
} from "./services/localService";
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

const REPORT_REASONS = [
  "El local ya no acepta tarjeta BAES / Junaeb",
  "Horario de atención incorrecto o desactualizado",
  "Ubicación del pin o dirección equivocada",
  "El local cerró permanentemente",
  "Problema técnico o error en la aplicación"
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

// Controlador interno para el Mini-Mapa de Geocodificación Asistida (clic en mapa + sincronización manual + redimensionamiento)
function PickerMapEvents({ lat, lng, onSelectCoords, isVisible, mapHeight }) {
  const map = useMap();

  useEffect(() => {
    const handleClick = (e) => {
      const nextLat = Number(e.latlng.lat.toFixed(6));
      const nextLng = Number(e.latlng.lng.toFixed(6));
      onSelectCoords(nextLat, nextLng);
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onSelectCoords]);

  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], map.getZoom(), { animate: true });
    }
  }, [lat, lng, map]);

  useEffect(() => {
    if (isVisible) {
      map.invalidateSize();
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [isVisible, mapHeight, map]);

  return null;
}

// Componente de Geocodificación Asistida: Pinchar o arrastrar directamente en el mapa + redimensionable hacia abajo
function LocationPickerMap({ lat, lng, categoria = "Almuerzo", onChange, isVisible = true, initialHeight = 200 }) {
  const safeLat = !isNaN(parseFloat(lat)) ? parseFloat(lat) : -35.4264;
  const safeLng = !isNaN(parseFloat(lng)) ? parseFloat(lng) : -71.6557;
  const pinIcon = useMemo(() => crearPinIcon(categoria, true, false), [categoria]);

  const [mapHeight, setMapHeight] = useState(initialHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const resizeStartY = useRef(null);
  const resizeStartH = useRef(initialHeight);

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      setMapHeight(next ? 410 : initialHeight);
      return next;
    });
  };

  const handleResizeStart = (e) => {
    e.preventDefault();
    resizeStartY.current = e.clientY;
    resizeStartH.current = mapHeight;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e) => {
    if (resizeStartY.current === null) return;
    const dy = e.clientY - resizeStartY.current;
    const nextH = Math.max(170, Math.min(540, resizeStartH.current + dy));
    setMapHeight(nextH);
    setIsExpanded(nextH > 320);
  };

  const handleResizeEnd = (e) => {
    if (resizeStartY.current === null) return;
    resizeStartY.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignorar si ya fue liberado
    }
  };

  return (
    <div className="geo-picker-wrapper">
      <div className="geo-picker-container" style={{ height: `${mapHeight}px` }}>
        <button
          type="button"
          className="geo-picker-expand-btn"
          onClick={toggleExpand}
          title={isExpanded ? "Reducir altura del mapa" : "Agrandar mapa hacia abajo"}
        >
          {isExpanded ? "🗕 Achicar mapa" : "🗖 Agrandar mapa"}
        </button>

        <MapContainer
          center={[safeLat, safeLng]}
          zoom={15}
          zoomControl={true}
          attributionControl={false}
          className="w-full h-full"
        >
          <TileLayer
            maxZoom={19}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[safeLat, safeLng]}
            icon={pinIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const pos = e.target.getLatLng();
                onChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
              }
            }}
          />
          <PickerMapEvents
            lat={safeLat}
            lng={safeLng}
            onSelectCoords={onChange}
            isVisible={isVisible}
            mapHeight={mapHeight}
          />
        </MapContainer>
        <div className="geo-picker-hint">
          👆 Pincha en el mapa o arrastra el pin para ubicar el local
        </div>
      </div>

      {/* Tirador inferior para estirar el mapa hacia abajo a gusto del usuario */}
      <div
        className="geo-picker-resizer"
        onPointerDown={handleResizeStart}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeEnd}
        title="Arrastra hacia abajo o arriba para ajustar el tamaño del mapa"
      >
        <span className="geo-picker-resizer-bar" />
        <small>↕ Arrastra aquí para agrandar o achicar el mapa</small>
      </div>
    </div>
  );
}

export default function App() {
  // Locales cargados desde Supabase (con fallback a localesData)
  const [locales, setLocales] = useState(localesData);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [selectedRegisterProducts, setSelectedRegisterProducts] = useState(["Almuerzo casero", "Bebidas"]);

  // Modo Invitado: Favoritos persistidos localmente en el dispositivo (Privacidad DA-02)
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem("junamap_favoritos_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const toggleFavorite = useCallback((id, e) => {
    if (e) e.stopPropagation();
    setFavoriteIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((favId) => favId !== id) : [...prev, id];
      try {
        localStorage.setItem("junamap_favoritos_v1", JSON.stringify(next));
      } catch {
        // Ignorar si storage está bloqueado
      }
      return next;
    });
  }, []);

  // Carga asíncrona de locales verificados desde Supabase (PBI-06 / AC-10 / FL-05)
  useEffect(() => {
    let isMounted = true;
    getLocalesWithStatus().then(({ data, isFallback }) => {
      if (isMounted) {
        if (data && data.length > 0) {
          setLocales(data);
        }
        setIsFallbackMode(Boolean(isFallback));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Estados de Panel de Administración / Moderación (PBI-05 / AC-09 / AC-11)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash || "";
    return (
      params.get("reset") === "true" ||
      hash.includes("type=recovery") ||
      hash.includes("error_code=otp_expired")
    );
  });
  const [adminEmail, setAdminEmail] = useState("webjunamap@gmail.com");
  const [adminPass, setAdminPass] = useState("");
  const [adminAuthError, setAdminAuthError] = useState(() => {
    const hash = window.location.hash || "";
    if (hash.includes("error_code=otp_expired")) {
      return "El enlace del correo anterior ya fue usado o expiró (solo sirve para 1 clic). Solicita un nuevo enlace aquí abajo.";
    }
    return "";
  });
  const [adminAuthMessage, setAdminAuthMessage] = useState("");
  const [adminAuthView, setAdminAuthView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash || "";
    if (hash.includes("error_code=otp_expired")) {
      return "forgot";
    }
    return params.get("reset") === "true" || hash.includes("type=recovery")
      ? "change_password"
      : "login";
  }); // 'login' | 'forgot' | 'change_password'
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState("pendientes"); // 'pendientes' | 'reportes' | 'historial'
  const [localesPendientes, setLocalesPendientes] = useState([]);
  const [reportesComunidad, setReportesComunidad] = useState([]);
  const [historialAuditoria, setHistorialAuditoria] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [coordsEdit, setCoordsEdit] = useState({});

  // Detectar evento PASSWORD_RECOVERY de Supabase Auth
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsAdminModalOpen(true);
        setIsAdminAuthenticated(true);
        setAdminEmail(session?.user?.email || "webjunamap@gmail.com");
        setAdminAuthView("change_password");
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Estado de búsqueda y categorías
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [activeLocalId, setActiveLocalId] = useState(null);

  // Estado de ubicación GPS (exclusivamente en memoria RAM del navegador - DA-02)
  const [userCoords, setUserCoords] = useState({ lat: -35.426, lng: -71.655 });
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsFlyCount, setGpsFlyCount] = useState(0);
  const [showLocTooltip, setShowLocTooltip] = useState(false);

  // Estados de Drawer y Modal "Registrar mi local"
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerSuccessView, setRegisterSuccessView] = useState(false);
  const [regLat, setRegLat] = useState(-35.4264);
  const [regLng, setRegLng] = useState(-71.6557);
  const [regCat, setRegCat] = useState("Almuerzo");
  const [adminOpenMapId, setAdminOpenMapId] = useState(null);

  // Estados de Modal "Sugerencia" ("Conozco uno")
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [suggestSuccessView, setSuggestSuccessView] = useState(false);
  const [isSubmittingSuggest, setIsSubmittingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

  // Estados de Modal "Reportar un error" (Tabla reportes_locales)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportSuccessView, setReportSuccessView] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportLocalId, setReportLocalId] = useState("");
  const [reportMotivo, setReportMotivo] = useState(REPORT_REASONS[0]);
  const [reportDescripcion, setReportDescripcion] = useState("");
  const [reportContacto, setReportContacto] = useState("");

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
    setSuggestError("");
    setSuggestItems([{ id: 1, nombre: "", direccion: "", tipo: "Almuerzo" }]);
  };

  const openReportModalForLocal = (localId = "") => {
    setIsDrawerOpen(false);
    setReportLocalId(localId ? String(localId) : "");
    setReportMotivo(REPORT_REASONS[0]);
    setReportDescripcion("");
    setReportContacto("");
    setReportError("");
    setReportSuccessView(false);
    setIsReportModalOpen(true);
  };

  // Estados del Bottom Sheet (0: Peek 62px, 1: 50% mitad, 2: 80% máximo)
  const [sheetState, setSheetState] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [appHeight, setAppHeight] = useState(window.innerHeight);

  // Filtros activos: categoría distinta a 'Todos', comida seleccionada o modo favoritos
  const hasActiveFilters =
    selectedCategory !== "Todos" || selectedProduct !== null || onlyFavorites;

  const handleClearFilters = () => {
    setSelectedCategory("Todos");
    setSelectedProduct(null);
    setOnlyFavorites(false);
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

  useEffect(() => {
    const bodyEl = bodyRef.current;
    if (bodyEl) {
      bodyEl.scrollTop = 0;
      if (sheetState === 0) {
        const rows = bodyEl.querySelectorAll(".products-row-scroll");
        rows.forEach((row) => {
          row.scrollLeft = 0;
        });
      }
    }
  }, [sheetState, activeLocalId]);

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

  const snapHeights = useMemo(() => {
    return [62, Math.round(appHeight * 0.5), Math.round(appHeight * 0.8)];
  }, [appHeight]);

  const currentOffset = isDragging
    ? dragOffset
    : snapHeights[2] - snapHeights[sheetState];

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
        console.warn("Modo sin GPS activado (Fallback neutral Talca):", err.message);
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
        if (onlyFavorites && !favoriteIds.includes(l.id)) {
          return false;
        }
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
  }, [localesWithDist, selectedCategory, searchTerm, gpsActive, selectedProduct, onlyFavorites, favoriteIds]);

  const activeLocal = useMemo(() => {
    if (activeLocalId === null) return null;
    return localesWithDist.find((l) => l.id === activeLocalId) || null;
  }, [localesWithDist, activeLocalId]);

  const handleSelectLocal = (id) => {
    setActiveLocalId(id);
    if (sheetState === 0 || sheetState === 2) {
      setSheetState(1);
    }
  };

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
      targetState = snapHeights.reduce(
        (bestIdx, h, idx) =>
          Math.abs(h - currentVisH) < Math.abs(snapHeights[bestIdx] - currentVisH)
            ? idx
            : bestIdx,
        0
      );
    } else {
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
        } else if (isReportModalOpen) {
          setIsReportModalOpen(false);
        } else if (isRegisterModalOpen) {
          setIsRegisterModalOpen(false);
          setRegisterSuccessView(false);
        } else if (isSuggestModalOpen) {
          setIsSuggestModalOpen(false);
          setSuggestSuccessView(false);
        } else if (isAdminModalOpen) {
          setIsAdminModalOpen(false);
        } else if (isDrawerOpen) {
          setIsDrawerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAboutModalOpen, isReportModalOpen, isRegisterModalOpen, isSuggestModalOpen, isAdminModalOpen, isDrawerOpen]);

  const toggleRegisterProduct = (prod) => {
    setSelectedRegisterProducts((prev) =>
      prev.includes(prod) ? prev.filter((p) => p !== prod) : [...prev, prod]
    );
  };

  // Enviar formulario "Registrar mi local" a Supabase (PBI-04 / AC-08 / DEF-02 / RSK-14)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError("");

    const form = e.target;
    const nombreVal = form["reg-nombre"].value.trim();
    const direccionVal = form["reg-direccion"].value.trim();
    const latVal = parseFloat(form["reg-lat"].value);
    const lngVal = parseFloat(form["reg-lng"].value);

    if (nombreVal.length < 3) {
      setRegisterError("El nombre del local no puede estar vacío ni tener menos de 3 caracteres (DEF-02).");
      return;
    }

    if (direccionVal.length < 4) {
      setRegisterError("Ingresa una dirección válida en Talca (FL-04).");
      return;
    }

    if (isNaN(latVal) || isNaN(lngVal) || latVal < -35.48 || latVal > -35.38 || lngVal < -71.72 || lngVal > -71.58) {
      setRegisterError("Las coordenadas ingresadas están fuera del radio de Talca (-35.48 a -35.38, -71.72 a -71.58) (AC-12 / RSK-14).");
      return;
    }

    setIsSubmittingRegister(true);

    const formData = {
      nombre: nombreVal,
      tipo: form["reg-categoria"].value,
      direccion: direccionVal,
      abre: form["reg-abre"].value || "09:00",
      cierra: form["reg-cierra"].value || "20:00",
      telefono: form["reg-telefono"].value || null,
      descripcion: `Contacto: ${form["reg-email"].value.trim()}. ${form["reg-descripcion"]?.value?.trim() || "Postulación verificada por locatario."}`,
      lat: latVal,
      lng: lngVal,
      productos: selectedRegisterProducts.length > 0 ? selectedRegisterProducts : ["Almuerzo casero"],
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

  // Enviar formulario "Sugerencia" ("Conozco uno") directamente a Supabase en estado pendiente
  const handleSuggestSubmit = async (e) => {
    e.preventDefault();
    setSuggestError("");
    setIsSubmittingSuggest(true);

    try {
      for (const item of suggestItems) {
        const cleanName = item.nombre.trim();
        if (cleanName.length < 3) {
          throw new Error("Cada local sugerido debe tener un nombre válido de al menos 3 caracteres.");
        }
        const cat = item.tipo === "No estoy seguro" ? "Almuerzo" : item.tipo;
        await postularLocal({
          nombre: cleanName,
          tipo: cat,
          direccion: item.direccion.trim() || "Centro de Talca (Por confirmar)",
          lat: -35.4264,
          lng: -71.6557,
          abre: "09:00",
          cierra: "20:00",
          descripcion: "Sugerencia enviada por estudiante de la comunidad JunaMap.",
          productos: ["Almuerzo casero"]
        });
      }
      setIsSubmittingSuggest(false);
      setSuggestSuccessView(true);
    } catch (err) {
      setIsSubmittingSuggest(false);
      setSuggestError(err.message || "Error al guardar la sugerencia.");
    }
  };

  // Enviar formulario "Reportar un error" a la tabla reportes_locales
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportError("");
    setIsSubmittingReport(true);

    try {
      await crearReporteLocal({
        local_id: reportLocalId || null,
        motivo: reportMotivo,
        descripcion: reportDescripcion,
        contacto_usuario: reportContacto
      });
      setIsSubmittingReport(false);
      setReportSuccessView(true);
    } catch (err) {
      setIsSubmittingReport(false);
      setReportError(err.message || "No se pudo registrar el reporte.");
    }
  };

  // Cargar datos completos del panel de administración (Pendientes, Reportes e Historial)
  const cargarDatosAdmin = async () => {
    setAdminLoading(true);
    try {
      const [pendientesData, reportesData, historialData] = await Promise.all([
        getLocalesPendientes(),
        getReportesLocales(),
        getHistorialModeracion()
      ]);
      setLocalesPendientes(pendientesData);
      setReportesComunidad(reportesData);
      setHistorialAuditoria(historialData);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminAuthError("");
    setAdminAuthMessage("");
    setAdminLoading(true);

    try {
      await loginAdmin(adminEmail, adminPass);
      setIsAdminAuthenticated(true);
      await cargarDatosAdmin();
    } catch (err) {
      setAdminAuthError(err.message || "Credenciales incorrectas.");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAdminAuthError("");
    setAdminAuthMessage("");
    setAdminLoading(true);

    try {
      await solicitarResetPasswordAdmin(adminEmail);
      setAdminAuthMessage(
        `Se ha enviado un enlace de recuperación a ${adminEmail}. Revisa la bandeja de entrada o spam.`
      );
    } catch (err) {
      setAdminAuthError(
        err.message || "No se pudo enviar el correo de recuperación. Verifica que el correo esté registrado en Supabase Auth."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  const handleChangeAdminPassword = async (e) => {
    e.preventDefault();
    setAdminAuthError("");
    setAdminAuthMessage("");

    if (newAdminPassword.length < 6) {
      setAdminAuthError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setAdminAuthError("Las contraseñas no coinciden.");
      return;
    }

    setAdminLoading(true);
    try {
      await cambiarPasswordAdmin(newAdminPassword);
      setAdminAuthMessage("¡Contraseña actualizada correctamente en Supabase Auth!");
      setNewAdminPassword("");
      setConfirmAdminPassword("");
      setTimeout(() => {
        setAdminAuthView("login");
      }, 1800);
    } catch (err) {
      setAdminAuthError(
        err.message || "Para cambiar la clave en la nube debes haber iniciado sesión con una cuenta de Supabase Auth o desde el link de recuperación."
      );
    } finally {
      setAdminLoading(false);
    }
  };

  const handleModerar = async (id, accion) => {
    try {
      const customCoords = coordsEdit[id]
        ? {
            lat: parseFloat(coordsEdit[id].lat),
            lng: parseFloat(coordsEdit[id].lng)
          }
        : null;

      await moderarLocal(id, accion, customCoords, adminEmail || "Admin JunaMap");
      await cargarDatosAdmin();
      const actualizados = await getLocales();
      setLocales(actualizados);
    } catch (err) {
      setAdminAuthError("Error al moderar local: " + err.message);
    }
  };

  const handleResolverReporte = async (id, estado) => {
    try {
      await resolverReporteLocal(id, estado);
      await cargarDatosAdmin();
    } catch (err) {
      console.error("Error al actualizar reporte:", err);
    }
  };

  const handlePurgarDatosPrueba = async () => {
    try {
      setAdminLoading(true);
      await limpiarLocalesPrueba();
      const actualizados = await getLocales();
      setLocales(actualizados);
      await cargarDatosAdmin();
    } catch (err) {
      console.error("Error limpiando datos de prueba:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  // Posición dinámica del FAB
  const visibleSheetH = snapHeights[2] - currentOffset;
  const fabBottom = Math.min(visibleSheetH, snapHeights[1]) + 14;

  return (
    <div id="app">
      {/* BANNER CONTROLADO DE FALLBACK SI SUPABASE ESTÁ INACCESIBLE (FL-05) */}
      {isFallbackMode && (
        <div className="fallback-banner" role="status">
          <span>No se pudo conectar con el catálogo en vivo, mostrando datos locales verificados.</span>
          <button type="button" onClick={() => setIsFallbackMode(false)} aria-label="Cerrar aviso">
            &times;
          </button>
        </div>
      )}

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

        {/* Chips de Categorías + Chip rápido de Favoritos */}
        <div className="chips" id="chips">
          {["Todos", ...CAT_ORDER].map((c) => {
            const isCatActive = selectedCategory === c && !onlyFavorites;
            const catColor = CATS[c] || "#1d6b3f";
            return (
              <button
                key={c}
                className={`chip ${isCatActive ? "on" : ""}`}
                style={{ "--c": catColor }}
                onClick={() => {
                  setOnlyFavorites(false);
                  setSelectedCategory(c);
                }}
              >
                {CATS[c] && <i />}
                {c}
              </button>
            );
          })}
          <button
            type="button"
            className={`chip ${onlyFavorites ? "on" : ""}`}
            style={{ "--c": "#e11d48" }}
            onClick={() => setOnlyFavorites((v) => !v)}
          >
            ♥ Favoritos ({favoriteIds.length})
          </button>
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
          <p className="grab-instruction">{instructionText}</p>
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
                  <button
                    type="button"
                    className={`fav-btn ${favoriteIds.includes(activeLocal.id) ? "active" : ""}`}
                    aria-label="Guardar en favoritos"
                    title="Guardar en tus favoritos locales"
                    onClick={(e) => toggleFavorite(activeLocal.id, e)}
                  >
                    {favoriteIds.includes(activeLocal.id) ? "❤️" : "🤍"}
                  </button>
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
                  Cobro: {activeLocal.metodo_cobro} · ✓ Verificado BAES
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
                <button
                  type="button"
                  className="btn-report-inline"
                  onClick={() => openReportModalForLocal(activeLocal.id)}
                  title="Reportar dato desactualizado de este local"
                >
                  ⚑ Reportar
                </button>
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
              {onlyFavorites
                ? `Tus locales favoritos guardados (${visibleLocales.length})`
                : selectedProduct
                  ? `Locales con ${selectedProduct} (${visibleLocales.length})`
                  : gpsActive
                    ? "Ordenados por cercanía"
                    : "Ordenados por categoría"}
            </div>
          )}

          {/* Mensaje de vacío */}
          {visibleLocales.length === 0 && (
            <div className="empty">
              {onlyFavorites
                ? "Aún no has guardado locales favoritos. Toca el corazón 🤍 en cualquier comercio para guardarlo en tu dispositivo."
                : "No se encuentran locales con esos criterios"}
            </div>
          )}

          {/* Lista de locales */}
          {visibleLocales.map((local, idx) => {
            const isFav = favoriteIds.includes(local.id);
            return (
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

                <button
                  type="button"
                  className={`fav-list-btn ${isFav ? "active" : ""}`}
                  aria-label="Marcar favorito"
                  onClick={(e) => toggleFavorite(local.id, e)}
                >
                  {isFav ? "❤️" : "🤍"}
                </button>

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
            );
          })}
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
          {/* SECCIÓN MODO INVITADO + FAVORITOS LOCALES (SIN REGISTRO DE ESTUDIANTES - DA-02) */}
          <div className="drawer-auth-box">
            <div className="guest-badge-row">
              <span className="guest-status-badge">🟢 Modo Invitado Activo</span>
            </div>
            <h3 className="drawer-greeting">Hola, Estudiante 👋</h3>
            <p className="drawer-auth-subtext">
              Explora comercios BAES sin entregar datos personales. Tus favoritos y tu GPS se procesan solo en este dispositivo.
            </p>
            <div className="drawer-auth-buttons">
              <button
                type="button"
                className={`drawer-btn-auth ${onlyFavorites ? "secondary" : "primary"}`}
                onClick={() => {
                  setOnlyFavorites((prev) => !prev);
                  setIsDrawerOpen(false);
                  setSheetState(1);
                }}
              >
                {onlyFavorites
                  ? "Ver todos los locales"
                  : `❤️ Mis Favoritos (${favoriteIds.length})`}
              </button>
            </div>
          </div>

          <hr className="drawer-divider" />

          {/* TARJETA ¿FALTA UN LOCAL EN EL MAPA? */}
          <div className="drawer-merchant-card">
            <h4 className="drawer-merchant-title">¿Falta un local en el mapa?</h4>
            <p className="drawer-merchant-desc">Postúlalo para verificación comunitaria</p>
            <div className="drawer-missing-options">
              <button
                type="button"
                className="drawer-missing-btn"
                onClick={() => {
                  setIsDrawerOpen(false);
                  setRegisterSuccessView(false);
                  setRegisterError("");
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
                  setSuggestError("");
                  setIsSuggestModalOpen(true);
                }}
              >
                Conozco uno
              </button>
            </div>
          </div>

          {/* ACCESO A PANEL DE MODERACIÓN (PBI-05 / AC-09 / AC-11) */}
          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="drawer-admin-access-btn"
              onClick={() => {
                setIsDrawerOpen(false);
                setAdminAuthError("");
                setAdminAuthMessage("");
                setIsAdminModalOpen(true);
                if (isAdminAuthenticated) {
                  cargarDatosAdmin();
                }
              }}
            >
              <span>🛡️ Panel de Moderación (Admin)</span>
              <small>{isAdminAuthenticated ? "Sesión activa" : "Acceso equipo"}</small>
            </button>
          </div>

          <hr className="drawer-divider" />

          {/* SECCIÓN AYUDA */}
          <div className="drawer-section-title">AYUDA Y COMUNIDAD</div>

          <div
            className="drawer-item simple"
            onClick={() => openReportModalForLocal(activeLocal?.id || "")}
          >
            <span>⚑ Reportar un error o local</span>
          </div>

          <div
            className="drawer-item simple"
            onClick={() => {
              setIsDrawerOpen(false);
              setIsAboutModalOpen(true);
            }}
          >
            <span>ℹ️ Acerca de JunaMap</span>
          </div>
        </div>

        <div className="drawer-footer">
          <p>
            Catálogo Comunitario Verificado ·{" "}
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

      {/* MODAL / FORMULARIO "REGISTRAR MI LOCAL" (PBI-04 / AC-08 / AC-12) */}
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
                Completa los datos de tu comercio en Talca. Nuestro equipo verificará la solicitud antes de publicarla en el mapa público.
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
                    minLength={3}
                    placeholder="Ej: Fuente de Soda El Centro"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg-categoria">
                    Categoría <span className="req">*</span>
                  </label>
                  <select
                    id="reg-categoria"
                    required
                    value={regCat}
                    onChange={(e) => setRegCat(e.target.value)}
                  >
                    <option value="Almuerzo">Almuerzo</option>
                    <option value="Cafetería">Cafetería</option>
                    <option value="Minimarket">Minimarket</option>
                    <option value="Panadería">Panadería</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-direccion">
                    Dirección en Talca <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    id="reg-direccion"
                    required
                    minLength={4}
                    placeholder="Ej: 1 Sur 1245, Talca"
                  />
                </div>

                {/* GEOCODIFICACIÓN ASISTIDA: MINI-MAPA INTERACTIVO + OPCIÓN MANUAL SINCRONIZADA */}
                <div className="form-group">
                  <div className="geo-picker-header">
                    <label style={{ margin: 0 }}>
                      Ubicación del local en el mapa <span className="req">*</span>
                    </label>
                    <button
                      type="button"
                      className="btn-geo-use-current"
                      onClick={() => {
                        setRegLat(Number(userCoords.lat.toFixed(6)));
                        setRegLng(Number(userCoords.lng.toFixed(6)));
                      }}
                    >
                      📍 Centrar en mi posición
                    </button>
                  </div>

                  {isRegisterModalOpen && (
                    <LocationPickerMap
                      lat={regLat}
                      lng={regLng}
                      categoria={regCat}
                      isVisible={isRegisterModalOpen}
                      onChange={(newLat, newLng) => {
                        setRegLat(newLat);
                        setRegLng(newLng);
                      }}
                    />
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="reg-lat">
                      Latitud (o manual) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="reg-lat"
                      required
                      value={regLat}
                      onChange={(e) => setRegLat(e.target.value)}
                      min={-35.48}
                      max={-35.38}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label htmlFor="reg-lng">
                      Longitud (o manual) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="reg-lng"
                      required
                      value={regLng}
                      onChange={(e) => setRegLng(e.target.value)}
                      min={-71.72}
                      max={-71.58}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="reg-abre">Hora apertura</label>
                    <input type="time" id="reg-abre" defaultValue="09:00" />
                  </div>
                  <div className="form-group flex-1">
                    <label htmlFor="reg-cierra">Hora cierre</label>
                    <input type="time" id="reg-cierra" defaultValue="20:00" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Productos principales disponibles con BAES</label>
                  <div className="suggest-chips-grid" style={{ justifyContent: "flex-start" }}>
                    {PRODUCT_LIST.slice(0, 12).map((prod) => {
                      const active = selectedRegisterProducts.includes(prod);
                      return (
                        <button
                          key={prod}
                          type="button"
                          className={`product-pill-btn ${active ? "active" : ""}`}
                          onClick={() => toggleRegisterProduct(prod)}
                        >
                          {prod}
                        </button>
                      );
                    })}
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

                <div className="form-group">
                  <label htmlFor="reg-descripcion">Descripción breve (opcional)</label>
                  <input
                    type="text"
                    id="reg-descripcion"
                    placeholder="Ej: Menú estudiantil, colaciones y bebidas"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" id="reg-check" required />
                    <span>Confirmo que mi local acepta tarjeta Junaeb / BAES</span>
                  </label>
                </div>

                {registerError && (
                  <div className="form-error-box" role="alert">
                    {registerError}
                  </div>
                )}

                <button type="submit" className="btn-submit-form" disabled={isSubmittingRegister}>
                  {isSubmittingRegister ? "Enviando postulación..." : "Enviar postulación"}
                </button>
              </form>
            </div>
          ) : (
            <div id="modal-success-view">
              <div className="form-placeholder-state">
                <div className="icon">✅</div>
                <h3>¡Solicitud Registrada!</h3>
                <p>
                  Tu postulación fue guardada en Supabase con estado <strong>Pendiente de Verificación</strong>. Un administrador la revisará antes de publicarla en el mapa.
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

      {/* MODAL / PANEL DE MODERACIÓN ADMIN (PBI-05 / AC-09 / AC-11) */}
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
              setAdminAuthError("");
              setAdminAuthMessage("");
            }}
          >
            &times;
          </button>
          <div className="modal-title-wrap">
            <span className="modal-badge-tag">ADMINISTRACIÓN</span>
            <h2 className="modal-title">Panel de Moderación</h2>
          </div>
        </div>

        <div className="modal-body" style={{ padding: "1.25rem 1rem" }}>
          {!isAdminAuthenticated && adminAuthView !== "change_password" ? (
            <div className="admin-auth-card">
              {adminAuthView === "login" ? (
                <form onSubmit={handleAdminLogin} className="register-form">
                  <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: "0.25rem" }}>🛡️</div>
                    <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.2rem" }}>Acceso de Moderadores</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                      Autenticación protegida con Supabase Auth para aprobar locales, auditar cambios y gestionar reportes.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="admin-email">Correo del Administrador</label>
                    <input
                      id="admin-email"
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="webjunamap@gmail.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="admin-password">Contraseña</label>
                    <input
                      id="admin-password"
                      type="password"
                      required
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      style={{
                        height: "48px",
                        borderRadius: "12px",
                        border: "1px solid var(--line)",
                        background: "var(--bg)",
                        color: "var(--text)",
                        padding: "0 14px",
                        fontSize: "16px"
                      }}
                    />
                  </div>

                  {adminAuthError && (
                    <div className="form-error-box" role="alert">
                      {adminAuthError}
                    </div>
                  )}
                  {adminAuthMessage && (
                    <div className="form-success-box" role="status">
                      {adminAuthMessage}
                    </div>
                  )}

                  <button type="submit" className="btn-submit-form" disabled={adminLoading}>
                    {adminLoading ? "Verificando..." : "Iniciar sesión en Panel"}
                  </button>

                  <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn-link-subtle"
                      onClick={() => {
                        setAdminAuthError("");
                        setAdminAuthMessage("");
                        setAdminAuthView("forgot");
                      }}
                    >
                      ¿Olvidaste tu contraseña? Restablecer por correo
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleForgotPassword} className="register-form">
                  <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                    <div style={{ fontSize: "2.2rem", marginBottom: "0.25rem" }}>✉️</div>
                    <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.2rem" }}>Recuperar Contraseña</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                      Enviaremos un correo de restablecimiento de contraseña mediante Supabase Auth al correo administrativo de JunaMap.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reset-email">Correo registrado</label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="webjunamap@gmail.com"
                    />
                  </div>

                  {adminAuthError && (
                    <div className="form-error-box" role="alert">
                      {adminAuthError}
                    </div>
                  )}
                  {adminAuthMessage && (
                    <div className="form-success-box" role="status">
                      {adminAuthMessage}
                    </div>
                  )}

                  <button type="submit" className="btn-submit-form" disabled={adminLoading}>
                    {adminLoading ? "Enviando correo..." : "Enviar enlace de recuperación"}
                  </button>

                  <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn-link-subtle"
                      onClick={() => {
                        setAdminAuthError("");
                        setAdminAuthMessage("");
                        setAdminAuthView("login");
                      }}
                    >
                      ← Volver al inicio de sesión
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : adminAuthView === "change_password" ? (
            <div className="admin-auth-card">
              <form onSubmit={handleChangeAdminPassword} className="register-form">
                <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "2.2rem", marginBottom: "0.25rem" }}>🔐</div>
                  <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.2rem" }}>Cambiar Contraseña de Admin</h3>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    Ingresa tu nueva contraseña para actualizar las credenciales de administrador ({adminEmail}).
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="new-admin-pass">Nueva contraseña (mín. 6 caracteres)</label>
                  <input
                    id="new-admin-pass"
                    type="password"
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Nueva contraseña segura"
                    style={{
                      height: "48px",
                      borderRadius: "12px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      padding: "0 14px",
                      fontSize: "16px"
                    }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-admin-pass">Confirmar nueva contraseña</label>
                  <input
                    id="confirm-admin-pass"
                    type="password"
                    required
                    minLength={6}
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    style={{
                      height: "48px",
                      borderRadius: "12px",
                      border: "1px solid var(--line)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      padding: "0 14px",
                      fontSize: "16px"
                    }}
                  />
                </div>

                {adminAuthError && (
                  <div className="form-error-box" role="alert">
                    {adminAuthError}
                  </div>
                )}
                {adminAuthMessage && (
                  <div className="form-success-box" role="status">
                    {adminAuthMessage}
                  </div>
                )}

                <button type="submit" className="btn-submit-form" disabled={adminLoading}>
                  {adminLoading ? "Guardando..." : "Actualizar contraseña"}
                </button>

                <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn-link-subtle"
                    onClick={() => {
                      setAdminAuthError("");
                      setAdminAuthMessage("");
                      setAdminAuthView("login");
                    }}
                  >
                    ← Volver al Panel de Moderación
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ maxWidth: "680px", margin: "0 auto" }}>
              {/* Barra superior de sesión Admin */}
              <div className="admin-top-bar">
                <div>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block" }}>
                    Moderador autenticado
                  </span>
                  <strong style={{ fontSize: "0.95rem" }}>{adminEmail}</strong>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="admin-action-pill"
                    onClick={() => {
                      setAdminAuthError("");
                      setAdminAuthMessage("");
                      setAdminAuthView("change_password");
                    }}
                  >
                    🔐 Cambiar clave
                  </button>
                  <button
                    type="button"
                    className="admin-action-pill"
                    onClick={cargarDatosAdmin}
                  >
                    🔄 Actualizar
                  </button>
                  <button
                    type="button"
                    className="admin-action-pill danger"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsAdminAuthenticated(false);
                      setAdminPass("");
                    }}
                  >
                    Salir
                  </button>
                </div>
              </div>

              {/* Pestañas de navegación del Admin */}
              <div className="admin-tabs">
                <button
                  type="button"
                  className={`admin-tab-btn ${adminActiveTab === "pendientes" ? "active" : ""}`}
                  onClick={() => setAdminActiveTab("pendientes")}
                >
                  Postulaciones ({localesPendientes.length})
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${adminActiveTab === "reportes" ? "active" : ""}`}
                  onClick={() => setAdminActiveTab("reportes")}
                >
                  Reportes ({reportesComunidad.filter((r) => r.estado === "pendiente").length})
                </button>
                <button
                  type="button"
                  className={`admin-tab-btn ${adminActiveTab === "historial" ? "active" : ""}`}
                  onClick={() => setAdminActiveTab("historial")}
                >
                  Auditoría ({historialAuditoria.length})
                </button>
              </div>

              {adminAuthError && (
                <div className="form-error-box" style={{ marginBottom: "1rem" }}>
                  {adminAuthError}
                </div>
              )}

              {/* TAB 1: POSTULACIONES PENDIENTES */}
              {adminActiveTab === "pendientes" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>
                      Solicitudes de Locales Pendientes ({localesPendientes.length})
                    </h3>
                    <button
                      type="button"
                      onClick={handlePurgarDatosPrueba}
                      className="admin-action-pill"
                      title="Eliminar registros basura de prueba (ej: 'prueba local', 'asdsa')"
                    >
                      🧹 Limpiar datos de prueba
                    </button>
                  </div>

                  {adminLoading ? (
                    <p>Cargando postulaciones desde Supabase...</p>
                  ) : localesPendientes.length === 0 ? (
                    <div className="admin-empty-box">
                      <div style={{ fontSize: "2.2rem", marginBottom: "0.4rem" }}>🎉</div>
                      <p>No hay locales pendientes por moderar en este momento.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {localesPendientes.map((p) => (
                        <div key={p.id} className="admin-item-card">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <strong style={{ fontSize: "1.05rem" }}>{p.nombre}</strong>
                            <span className="admin-badge">{p.tipo}</span>
                          </div>
                          <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>
                            📍 {p.direccion}
                          </p>
                          <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                            ⏰ Horario: {p.abre || "09:00"} - {p.cierra || "20:00"}
                          </p>
                          {p.descripcion && (
                            <p style={{ margin: "0.4rem 0", fontSize: "0.85rem", fontStyle: "italic", color: "var(--muted)" }}>
                              "{p.descripcion}"
                            </p>
                          )}

                          {/* AJUSTE MANUAL Y GEOCODIFICACIÓN ASISTIDA DE COORDENADAS (PBI-05 / AC-09) */}
                          <div className="admin-coords-box">
                            <div className="geo-picker-header">
                              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                                🎯 Ubicación exacta en Talca (Mapa o Manual):
                              </span>
                              <button
                                type="button"
                                className="btn-geo-use-current"
                                onClick={() =>
                                  setAdminOpenMapId((prev) => (prev === p.id ? null : p.id))
                                }
                              >
                                {adminOpenMapId === p.id ? "🔼 Ocultar mapa" : "🗺️ Pinchar en mapa"}
                              </button>
                            </div>

                            {adminOpenMapId === p.id && (
                              <div style={{ marginTop: "0.55rem", marginBottom: "0.55rem" }}>
                                <LocationPickerMap
                                  lat={coordsEdit[p.id]?.lat ?? (p.latitud ?? p.lat)}
                                  lng={coordsEdit[p.id]?.lng ?? (p.longitud ?? p.lng)}
                                  categoria={p.tipo || "Almuerzo"}
                                  isVisible={adminOpenMapId === p.id}
                                  initialHeight={190}
                                  onChange={(newLat, newLng) =>
                                    setCoordsEdit((prev) => ({
                                      ...prev,
                                      [p.id]: { lat: newLat, lng: newLng }
                                    }))
                                  }
                                />
                              </div>
                            )}

                            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                              <input
                                type="number"
                                step="any"
                                placeholder="Latitud"
                                value={coordsEdit[p.id]?.lat ?? (p.latitud ?? p.lat)}
                                onChange={(e) =>
                                  setCoordsEdit((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      lat: e.target.value,
                                      lng: prev[p.id]?.lng ?? (p.longitud ?? p.lng)
                                    }
                                  }))
                                }
                                className="admin-coord-input"
                              />
                              <input
                                type="number"
                                step="any"
                                placeholder="Longitud"
                                value={coordsEdit[p.id]?.lng ?? (p.longitud ?? p.lng)}
                                onChange={(e) =>
                                  setCoordsEdit((prev) => ({
                                    ...prev,
                                    [p.id]: {
                                      lat: prev[p.id]?.lat ?? (p.latitud ?? p.lat),
                                      lng: e.target.value
                                    }
                                  }))
                                }
                                className="admin-coord-input"
                              />
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                            <button
                              type="button"
                              onClick={() => handleModerar(p.id, true)}
                              className="admin-btn-approve"
                            >
                              ✅ Aprobar y Publicar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleModerar(p.id, false)}
                              className="admin-btn-reject"
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

              {/* TAB 2: REPORTES DE ERRORES DE LA COMUNIDAD */}
              {adminActiveTab === "reportes" && (
                <div>
                  <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>
                    Reportes de Errores y Locales ({reportesComunidad.length})
                  </h3>
                  {reportesComunidad.length === 0 ? (
                    <div className="admin-empty-box">
                      <div style={{ fontSize: "2.2rem", marginBottom: "0.4rem" }}>✨</div>
                      <p>No hay reportes de errores registrados en la tabla reportes_locales.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {reportesComunidad.map((rep) => {
                        const localAsociado = locales.find((l) => Number(l.id) === Number(rep.local_id));
                        return (
                          <div key={rep.id} className="admin-item-card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                              <strong>{rep.motivo}</strong>
                              <span
                                className={`tag ${rep.estado === "revisado" ? "o" : "c"}`}
                              >
                                {rep.estado}
                              </span>
                            </div>
                            {localAsociado && (
                              <p style={{ margin: "0.2rem 0", fontSize: "0.85rem", fontWeight: 600, color: "var(--brand)" }}>
                                🏪 Local: {localAsociado.nombre} ({localAsociado.direccion})
                              </p>
                            )}
                            <p style={{ margin: "0.4rem 0", fontSize: "0.9rem" }}>
                              {rep.descripcion}
                            </p>
                            {rep.contacto_usuario && (
                              <p style={{ margin: "0.2rem 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                                ✉️ Contacto: {rep.contacto_usuario}
                              </p>
                            )}
                            {rep.estado === "pendiente" && (
                              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                                <button
                                  type="button"
                                  className="admin-action-pill"
                                  onClick={() => handleResolverReporte(rep.id, "revisado")}
                                >
                                  ✓ Marcar como revisado
                                </button>
                                <button
                                  type="button"
                                  className="admin-action-pill danger"
                                  onClick={() => handleResolverReporte(rep.id, "descartado")}
                                >
                                  Descartar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: AUDITORÍA (TABLA verificar_locales) */}
              {adminActiveTab === "historial" && (
                <div>
                  <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>
                    Trazabilidad de Moderación (Tabla verificar_locales)
                  </h3>
                  {historialAuditoria.length === 0 ? (
                    <div className="admin-empty-box">
                      <p>Aún no hay registros de auditoría en verificar_locales.</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                      {historialAuditoria.map((h) => (
                        <div key={h.id} className="admin-item-card" style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                            <strong>Local ID #{h.local_id}</strong>
                            <span className={`tag ${h.estado_nuevo === "verificado" ? "o" : "c"}`}>
                              {h.estado_anterior} → {h.estado_nuevo}
                            </span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.3rem" }}>
                            Moderador: {h.admin_nombre} ·{" "}
                            {h.fecha ? new Date(h.fecha).toLocaleString("es-CL") : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MODAL "REPORTAR UN ERROR O LOCAL" (Conectado a tabla reportes_locales) */}
      <section
        className={`modal-form-page ${isReportModalOpen ? "open" : ""}`}
        id="report-modal"
        aria-label="Reportar un error"
        inert={!isReportModalOpen}
      >
        <div className="modal-header">
          <button
            className="ib-close"
            aria-label="Cerrar reporte"
            onClick={() => setIsReportModalOpen(false)}
          >
            &times;
          </button>
          <h2 className="modal-title">Reportar un error</h2>
        </div>

        <div className="modal-body">
          {!reportSuccessView ? (
            <form className="register-form" onSubmit={handleReportSubmit}>
              <p className="modal-description">
                ¿Un comercio dejó de aceptar BAES, cambió de horario o encontraste un fallo? Envíanos el reporte directamente al panel de moderación.
              </p>

              <div className="form-group">
                <label htmlFor="rep-local">Comercio relacionado (opcional)</label>
                <select
                  id="rep-local"
                  value={reportLocalId}
                  onChange={(e) => setReportLocalId(e.target.value)}
                >
                  <option value="">-- Reporte general de la aplicación --</option>
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} ({l.direccion})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rep-motivo">
                  Motivo del reporte <span className="req">*</span>
                </label>
                <select
                  id="rep-motivo"
                  required
                  value={reportMotivo}
                  onChange={(e) => setReportMotivo(e.target.value)}
                >
                  {REPORT_REASONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="rep-desc">
                  Detalle del problema <span className="req">*</span>
                </label>
                <textarea
                  id="rep-desc"
                  required
                  minLength={5}
                  rows={4}
                  value={reportDescripcion}
                  onChange={(e) => setReportDescripcion(e.target.value)}
                  placeholder="Describe brevemente qué ocurrió o qué dato debemos corregir..."
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label htmlFor="rep-contacto">Tu correo (opcional, por si necesitamos confirmar)</label>
                <input
                  id="rep-contacto"
                  type="email"
                  value={reportContacto}
                  onChange={(e) => setReportContacto(e.target.value)}
                  placeholder="estudiante@alu.ucm.cl"
                />
              </div>

              {reportError && (
                <div className="form-error-box" role="alert">
                  {reportError}
                </div>
              )}

              <button type="submit" className="btn-submit-form" disabled={isSubmittingReport}>
                {isSubmittingReport ? "Enviando reporte..." : "Enviar reporte a moderación"}
              </button>
            </form>
          ) : (
            <div className="form-placeholder-state">
              <div className="icon">🛠️</div>
              <h3>¡Reporte Recibido!</h3>
              <p>
                Tu aviso fue registrado en el sistema y será revisado por los administradores de JunaMap para mantener el catálogo actualizado.
              </p>
              <button
                type="button"
                className="btn-back"
                onClick={() => {
                  setIsReportModalOpen(false);
                  setReportSuccessView(false);
                }}
              >
                Volver al mapa
              </button>
            </div>
          )}
        </div>
      </section>

      {/* MODAL "SUGERENCIA" ("CONOZCO UNO") */}
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
          <h2 className="modal-title">Sugerir un local</h2>
        </div>

        <div className="modal-body">
          {!suggestSuccessView ? (
            <div id="suggest-form-view">
              <p className="modal-description">
                ¿Conoces una picada o comercio que acepte tarjeta BAES en Talca? Súmalo para que un moderador lo georreferencie y publique.
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
                        minLength={3}
                        value={item.nombre}
                        onChange={(e) => handleUpdateSuggestItem(idx, "nombre", e.target.value)}
                        placeholder="Ej: Casino Don Pepe, Minimarket..."
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`sug-direccion-${idx}`}>
                        {idx === 0 ? "Dirección o referencia" : `Dirección ${idx + 1}`}{" "}
                        <span className="opt">(en Talca)</span>
                      </label>
                      <input
                        type="text"
                        id={`sug-direccion-${idx}`}
                        required
                        minLength={4}
                        value={item.direccion}
                        onChange={(e) => handleUpdateSuggestItem(idx, "direccion", e.target.value)}
                        placeholder="Ej: 1 Norte con 2 Oriente, frente al campus..."
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

                {suggestError && (
                  <div className="form-error-box" role="alert">
                    {suggestError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-submit-form"
                  style={{ marginTop: "4px" }}
                  disabled={isSubmittingSuggest}
                >
                  {isSubmittingSuggest ? "Enviando a moderación..." : "Enviar sugerencia"}
                </button>
              </form>
            </div>
          ) : (
            <div id="suggest-success-view">
              <div className="form-placeholder-state">
                <div className="icon">🎉</div>
                <h3>¡Sugerencia enviada a Moderación!</h3>
                <p>
                  Muchas gracias por tu aporte. El local quedó registrado en estado <strong>Pendiente</strong> para que un administrador confirme sus coordenadas y lo publique.
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
              <h3>Privacidad y Minimización de Datos</h3>
              <p>
                JunaMap opera bajo el principio de privacidad por diseño: las coordenadas GPS
                del estudiante jamás se envían ni almacenan en servidores externos; el cálculo
                geodésico (Haversine) y tus locales favoritos viven exclusivamente en la memoria
                local de tu navegador.
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
