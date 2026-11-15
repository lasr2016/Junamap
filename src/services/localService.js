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
    const { data, error } = await supabase
      .from("locales")
      .select("id, nombre, tipo, direccion, lat, lng, abre, cierra, telefono, descripcion, verificado, metodo_cobro, productos, activo")
      .eq("verificado", true)
      .eq("activo", true)
      .order("id", { ascending: true });

    if (error) {
      console.warn("Error consultando Supabase. Activando fallback local (FL-05):", error.message);
      return fallbackLocales;
    }

    if (!data || data.length === 0) {
      return fallbackLocales;
    }

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
export async function moderarLocal(id, accionAprobar) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no configurado");
  }

  const updates = accionAprobar
    ? { verificado: true, activo: true, updated_at: new Date().toISOString() }
    : { verificado: false, activo: false, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from("locales")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw error;
  }

  return data;
}
