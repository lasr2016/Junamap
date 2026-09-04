import React, { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Search,
  MapPin,
  CheckCircle,
  ShieldAlert,
  Coffee,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import localesData from "./data/locales.json";

// Solución para el bug de iconos de marcadores por defecto en Leaflet con Webpack/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Icono personalizado para locales verificados (Verde)
const verificadoIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Icono personalizado para locales NO verificados (Azul estándar) - ¡Añade esto!
const standardIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Componente auxiliar para cambiar el centro del mapa programáticamente
function ChangeMapView({ center }) {
  const map = useMap();
  map.setView(center, 14);
  return null;
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [mapCenter, setMapCenter] = useState([-35.4264, -71.6554]); // Centro de Talca
  const [activeLocal, setActiveLocal] = useState(null);

  // Filtrado de locales según la búsqueda y filtros seleccionados
  const filteredLocales = useMemo(() => {
    return localesData.filter((local) => {
      const matchesSearch =
        local.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        local.direccion.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        selectedCategory === "Todos" || local.tipo === selectedCategory;

      const matchesVerified = !onlyVerified || local.verificado === true;

      return matchesSearch && matchesCategory && matchesVerified;
    });
  }, [searchTerm, selectedCategory, onlyVerified]);

  // Manejador para seleccionar un local desde la lista lateral
  const handleSelectLocal = (local) => {
    setActiveLocal(local);
    setMapCenter([local.lat, local.lng]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden font-sans">
      {/* HEADER */}
      <header className="bg-emerald-600 text-white px-4 py-3 shadow-md z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">JunaMap Talca</h1>
          <p className="text-xs text-emerald-100">
            Buscador y mapa verificado de locales BAES
          </p>
        </div>
        <div className="flex items-center gap-1 bg-emerald-700 px-2 py-1 rounded text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-300" />
          <span>Datos Simulados v1.0</span>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: Responsivo (En móvil es columna, en escritorio es fila) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* PANEL DE CONTROL: Buscador, Filtros y Resultados */}
        <section className="w-full md:w-[380px] bg-white border-r border-gray-200 shadow-sm flex flex-col z-10 max-h-[45vh] md:max-h-full">
          {/* Barra de búsqueda manual (Aborda riesgo de falla de GPS de estudiantes) */}
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre o dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>

            {/* Switch de Verificación */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyVerified}
                onChange={(e) => setOnlyVerified(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                Mostrar solo locales verificados por alumnos
              </span>
            </label>
          </div>

          {/* Filtros rápidos por Categorías (Derivado de respuestas de encuesta de estudiantes) */}
          <div className="px-4 py-2 bg-gray-50 flex gap-2 overflow-x-auto border-b border-gray-100 scrollbar-none">
            {["Todos", "Almuerzo", "Colación", "Minimarket"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? "bg-emerald-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Listado de resultados */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex justify-between items-center text-xs text-gray-500 font-medium mb-1">
              <span>Locales encontrados: {filteredLocales.length}</span>
            </div>

            {filteredLocales.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No se encontraron locales con los criterios actuales.
              </div>
            ) : (
              filteredLocales.map((local) => (
                <div
                  key={local.id}
                  onClick={() => handleSelectLocal(local)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between ${
                    activeLocal?.id === local.id
                      ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-gray-800 leading-tight">
                        {local.nombre}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {local.direccion}
                        </span>
                      </p>
                    </div>
                    {local.verificado ? (
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        Verificado
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3 text-amber-600" />
                        Por verificar
                      </span>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                    <span className="text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded">
                      {local.tipo}
                    </span>
                    <span className="text-emerald-700 font-semibold text-[11px]">
                      {local.metodo_cobro}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* MAPA INTERACTIVO (Ocupa el resto de la pantalla) */}
        <section className="flex-1 h-full min-h-[55vh] md:min-h-0 relative">
          <MapContainer
            center={mapCenter}
            zoom={14}
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Renderizar marcadores dinámicamente según filtros */}
            {filteredLocales.map((local) => (
              <Marker
                key={local.id}
                position={[local.lat, local.lng]}
                icon={local.verificado ? verificadoIcon : standardIcon}
                eventHandlers={{
                  click: () => {
                    setActiveLocal(local);
                  },
                }}
              >
                <Popup>
                  <div className="p-1 max-w-[200px]">
                    <h3 className="font-bold text-sm text-gray-900 border-b pb-1 mb-1">
                      {local.nombre}
                    </h3>
                    <p className="text-xs text-gray-600 font-semibold mb-1">
                      Categoría:{" "}
                      <span className="text-emerald-700">{local.tipo}</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-1 leading-snug">
                      {local.descripcion}
                    </p>
                    <p className="text-[10px] bg-gray-100 p-1 rounded font-medium mt-1">
                      Método: {local.metodo_cobro}
                    </p>
                    {local.verificado && (
                      <p className="text-[10px] text-green-700 font-bold mt-1.5 flex items-center gap-1">
                        ✓ Verificado por la comunidad estudiantil.
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Efecto para recentrar el mapa cuando se selecciona un local de la lista */}
            <ChangeMapView center={mapCenter} />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}
