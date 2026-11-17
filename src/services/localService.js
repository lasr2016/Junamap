import { createClient } from "@supabase/supabase-js";
import fallbackLocales from "../data/locales.json";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * PBI-06 / AC-10: Obtener locales verificados y activos desde Supabase
 * En caso de fallo de red o BD, activa fallback transparente a locales.json (FL-05)
 */
export async function getLocales() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Variables de Supabase no configuradas. Usando catálogo estático de respaldo.");
    return fallbackLocales;
  }

  try {
    // Consulta la vista normalizada que une categorias y productos
    const { data, error } = await supabase
      .from("vista_locales_mapa")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.warn("Error consultando vista_locales_mapa. Reintentando sobre locales (FL-05):", error.message);
      // Fallback a tabla locales
      const res = await supabase
        .from("locales")
        .select("id, nombre, tipo, direccion, lat, lng, abre, cierra, telefono, descripcion, verificado, metodo_cobro, productos, activo")
        .eq("verificado", true)
        .eq("activo", true)
        .order("id", { ascending: true });
        
      if (res.data && res.data.length > 0) {
        return res.data.map((l) => ({
          ...l,
          lat: typeof l.lat === "string" ? parseFloat(l.lat) : l.lat,
          lng: typeof l.lng === "string" ? parseFloat(l.lng) : l.lng,
          productos: Array.isArray(l.productos) ? l.productos : []
        }));
      }
      return fallbackLocales;
    }

    if (!data || data.length === 0) {
      return fallbackLocales;
    }

    // Adaptador de tipos numéricos para prevenir NaN en Haversine (Plan de Regresión / DEF-01)
    return data.map((l) => ({
      ...l,
      lat: typeof l.lat === "string" ? parseFloat(l.lat) : l.lat,
      lng: typeof l.lng === "string" ? parseFloat(l.lng) : l.lng,
      productos: Array.isArray(l.productos) ? l.productos : []
    }));
  } catch (err) {
    console.warn("Excepción al conectar con Supabase. Usando fallback (FL-05):", err);
    return fallbackLocales;
  }
}

/**
 * PBI-04 / AC-08: Registrar postulación de un nuevo local
 */
export async function postularLocal(localData) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Servicio de postulación no disponible (variables de entorno ausentes).");
  }

  const latNum = parseFloat(localData.lat);
  const lngNum = parseFloat(localData.lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw new Error("Las coordenadas geográficas no son válidas.");
  }

  if (latNum < -35.48 || latNum > -35.38 || lngNum < -71.72 || lngNum > -71.58) {
    throw new Error("El local debe ubicarse dentro del área de Talca (RSK-14).");
  }

  const nuevoRegistro = {
    nombre: String(localData.nombre || "").trim(),
    tipo: localData.tipo || "Almuerzo",
    direccion: String(localData.direccion || "").trim(),
    lat: latNum,
    lng: lngNum,
    abre: localData.abre || null,
    cierra: localData.cierra || null,
    telefono: localData.telefono ? String(localData.telefono).trim() : null,
    descripcion: localData.descripcion ? String(localData.descripcion).trim() : null,
    verificado: false,
    metodo_cobro: localData.metodo_cobro || "Edenred POS",
    productos: Array.isArray(localData.productos) ? localData.productos : [],
    activo: true
  };

  const { data, error } = await supabase
    .from("locales")
    .insert([nuevoRegistro]);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * PBI-05 / AC-09: Obtener locales pendientes de moderación
 */
export async function getLocalesPendientes() {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const { data, error } = await supabase
    .from("locales")
    .select("*")
    .eq("verificado", false)
    .eq("activo", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Error al cargar pendientes:", error.message);
    return [];
  }
  return data || [];
}

/**
 * PBI-05 / AC-09: Moderar un local (aprobar o rechazar)
 * - Aprobar (true): pasa a verificado = true (se muestra en el mapa)
 * - Rechazar (false): pasa a activo = false (se oculta de moderación y del mapa)
 */
/**
 * PBI-05 / AC-09: Moderar un local (aprobar o rechazar) con opción de ajustar coordenadas exactas
 */
export async function moderarLocal(id, accionAprobar, customCoords = null) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no configurado");
  }

  let updates = accionAprobar
    ? { 
        verificado: true, 
        estado: "verificado", 
        activo: true, 
        ultima_verificacion: new Date().toISOString() 
      }
    : { 
        verificado: false, 
        estado: "rechazado", 
        activo: false, 
        ultima_verificacion: new Date().toISOString() 
      };

  // Si el administrador ajustó manualmente las coordenadas
  if (accionAprobar && customCoords && !isNaN(customCoords.lat) && !isNaN(customCoords.lng)) {
    updates.latitud = customCoords.lat;
    updates.longitud = customCoords.lng;
    updates.lat = customCoords.lat;
    updates.lng = customCoords.lng;
  }

  const { data, error } = await supabase
    .from("locales")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw error;
  }

  // Registrar auditoría en verificar_locales si existe
  try {
    await supabase.from("verificar_locales").insert([
      {
        local_id: id,
        estado_anterior: "pendiente",
        estado_nuevo: accionAprobar ? "verificado" : "rechazado",
        admin_nombre: "Admin Principal JunaMap",
        fecha: new Date().toISOString()
      }
    ]);
  } catch (auditErr) {
    console.warn("No se pudo registrar log en verificar_locales:", auditErr);
  }

  return data;
}
