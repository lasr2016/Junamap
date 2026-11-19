import { createClient } from "@supabase/supabase-js";
import fallbackLocales from "../data/locales.json";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORIA_MAP = {
  Almuerzo: 1,
  Cafetería: 2,
  Minimarket: 3,
  Panadería: 4
};

/**
 * Sanitiza texto eliminando etiquetas HTML o scripts (QA-08 / Sección 14)
 */
export function sanitizeInput(str) {
  if (!str) return "";
  return String(str)
    .replace(/<[^>]*>?/gm, "")
    .trim();
}

/**
 * PBI-06 / AC-10: Obtener locales verificados y activos desde Supabase
 * En caso de fallo de red o BD, activa fallback transparente a locales.json (FL-05)
 */
export async function getLocales() {
  const result = await getLocalesWithStatus();
  return result.data;
}

/**
 * Versión extendida que retorna { data, isFallback } para mostrar aviso controlado (FL-05)
 */
export async function getLocalesWithStatus() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Variables de Supabase no configuradas. Usando catálogo estático de respaldo.");
    return { data: fallbackLocales, isFallback: true };
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
        .select("id, nombre, tipo, direccion, lat, lng, latitud, longitud, abre, cierra, telefono, descripcion, verificado, estado, metodo_cobro, productos, activo")
        .eq("activo", true)
        .order("id", { ascending: true });

      if (res.data && res.data.length > 0) {
        const verificados = res.data.filter(
          (l) => l.verificado === true || l.estado === "verificado"
        );
        return {
          data: verificados.map((l) => ({
            ...l,
            lat: typeof (l.lat ?? l.latitud) === "string" ? parseFloat(l.lat ?? l.latitud) : (l.lat ?? l.latitud),
            lng: typeof (l.lng ?? l.longitud) === "string" ? parseFloat(l.lng ?? l.longitud) : (l.lng ?? l.longitud),
            productos: Array.isArray(l.productos) ? l.productos : []
          })),
          isFallback: false
        };
      }
      return { data: fallbackLocales, isFallback: true };
    }

    if (!data || data.length === 0) {
      return { data: fallbackLocales, isFallback: false };
    }

    // Adaptador de tipos numéricos para prevenir NaN en Haversine (Plan de Regresión / DEF-01)
    // Además filtra registros basura residuales si aún no se han purgado
    const cleanData = data
      .filter((l) => !["prueba local", "asdsa"].includes(String(l.nombre || "").toLowerCase().trim()))
      .map((l) => ({
        ...l,
        lat: typeof l.lat === "string" ? parseFloat(l.lat) : l.lat,
        lng: typeof l.lng === "string" ? parseFloat(l.lng) : l.lng,
        productos: Array.isArray(l.productos) ? l.productos : []
      }));

    return { data: cleanData, isFallback: false };
  } catch (err) {
    console.warn("Excepción al conectar con Supabase. Usando fallback (FL-05):", err);
    return { data: fallbackLocales, isFallback: true };
  }
}

/**
 * PBI-04 / AC-08 / DEF-02 / RSK-14: Registrar postulación de un nuevo local
 */
export async function postularLocal(localData) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Servicio de postulación no disponible (variables de entorno ausentes).");
  }

  const nombreLimpio = sanitizeInput(localData.nombre);
  const direccionLimpia = sanitizeInput(localData.direccion);

  if (nombreLimpio.length < 3) {
    throw new Error("El nombre del local debe tener al menos 3 caracteres válidos (DEF-02).");
  }

  if (direccionLimpia.length < 4) {
    throw new Error("La dirección debe ser válida y contener al menos 4 caracteres.");
  }

  const latNum = parseFloat(localData.lat);
  const lngNum = parseFloat(localData.lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw new Error("Las coordenadas geográficas no son válidas.");
  }

  // RSK-14 / AC-12: Validación de rango geográfico de Talca
  if (latNum < -35.48 || latNum > -35.38 || lngNum < -71.72 || lngNum > -71.58) {
    throw new Error("Las coordenadas deben ubicarse dentro del radio urbano de Talca (-35.48 a -35.38, -71.72 a -71.58) (RSK-14).");
  }

  const tipoCat = localData.tipo && CATEGORIA_MAP[localData.tipo] ? localData.tipo : "Almuerzo";

  const nuevoRegistro = {
    nombre: nombreLimpio,
    tipo: tipoCat,
    categoria_id: CATEGORIA_MAP[tipoCat] || 1,
    direccion: direccionLimpia,
    lat: latNum,
    lng: lngNum,
    latitud: latNum,
    longitud: lngNum,
    abre: localData.abre || null,
    cierra: localData.cierra || null,
    telefono: localData.telefono ? sanitizeInput(localData.telefono) : null,
    descripcion: localData.descripcion ? sanitizeInput(localData.descripcion) : null,
    verificado: false,
    estado: "pendiente",
    metodo_cobro: localData.metodo_cobro || "Edenred POS",
    productos: Array.isArray(localData.productos) ? localData.productos : [],
    activo: true
  };

  const { data, error } = await supabase
    .from("locales")
    .insert([nuevoRegistro])
    .select();

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
    .eq("activo", true)
    .or("verificado.eq.false,estado.eq.pendiente")
    .order("id", { ascending: false });

  if (error) {
    console.warn("Error al cargar pendientes:", error.message);
    return [];
  }
  return (data || []).filter((l) => l.estado !== "verificado" && l.estado !== "rechazado" && l.verificado !== true);
}

/**
 * PBI-05 / AC-09: Moderar un local (aprobar o rechazar) con opción de ajustar coordenadas exactas
 */
export async function moderarLocal(id, accionAprobar, customCoords = null, adminIdentifier = "Admin Principal JunaMap") {
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
    if (customCoords.lat < -35.48 || customCoords.lat > -35.38 || customCoords.lng < -71.72 || customCoords.lng > -71.58) {
      throw new Error("Las coordenadas ajustadas están fuera del radio de Talca (RSK-14).");
    }
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

  // Registrar auditoría en verificar_locales
  const { error: auditError } = await supabase.from("verificar_locales").insert([
    {
      local_id: id,
      estado_anterior: "pendiente",
      estado_nuevo: accionAprobar ? "verificado" : "rechazado",
      admin_nombre: adminIdentifier,
      fecha: new Date().toISOString()
    }
  ]);

  if (auditError) {
    console.warn("Nota de auditoría verificar_locales:", auditError.message);
  }

  return data;
}

/**
 * Obtener historial de auditoría de moderación (tabla verificar_locales)
 */
export async function getHistorialModeracion() {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const { data, error } = await supabase
    .from("verificar_locales")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("Error al cargar historial verificar_locales:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Enviar un reporte de error o información desactualizada de un local a la tabla reportes_locales
 */
export async function crearReporteLocal(reporteData) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Servicio de reportes no disponible.");
  }

  const motivo = sanitizeInput(reporteData.motivo);
  const descripcion = sanitizeInput(reporteData.descripcion);
  const contacto = reporteData.contacto_usuario ? sanitizeInput(reporteData.contacto_usuario) : null;

  if (!motivo || descripcion.length < 5) {
    throw new Error("Por favor describe el problema con al menos 5 caracteres.");
  }

  const nuevoReporte = {
    local_id: reporteData.local_id ? Number(reporteData.local_id) : null,
    motivo,
    descripcion,
    contacto_usuario: contacto,
    estado: "pendiente"
  };

  const { data, error } = await supabase
    .from("reportes_locales")
    .insert([nuevoReporte]);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Obtener reportes de usuarios pendientes o todos para el panel de administración
 */
export async function getReportesLocales() {
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const { data, error } = await supabase
    .from("reportes_locales")
    .select("*")
    .order("creado_en", { ascending: false });

  if (error) {
    console.warn("Error al cargar reportes_locales:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Actualizar estado de un reporte en el panel de administración ('revisado' o 'descartado')
 */
export async function resolverReporteLocal(id, nuevoEstado = "revisado") {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no configurado");
  }

  const { data, error } = await supabase
    .from("reportes_locales")
    .update({ estado: nuevoEstado })
    .eq("id", id);

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Purgar registros basura de prueba en la base de datos desde el panel Admin
 */
export async function limpiarLocalesPrueba() {
  if (!supabaseUrl || !supabaseAnonKey) return;

  const { error } = await supabase
    .from("locales")
    .delete()
    .in("nombre", ["prueba local", "asdsa"]);

  if (error) {
    throw error;
  }
}

export const ADMIN_OFFICIAL_EMAIL = "webjunamap@gmail.com";

/**
 * Autenticación de Administrador con Supabase Auth + respaldo de clave maestra de desarrollo
 */
export async function loginAdmin(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "").trim();

  if (cleanEmail !== ADMIN_OFFICIAL_EMAIL) {
    throw new Error(`El acceso administrativo está restringido exclusivamente al correo oficial (${ADMIN_OFFICIAL_EMAIL}).`);
  }

  // Intentar primero con Supabase Auth real
  if (supabaseUrl && supabaseAnonKey) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass
    });

    if (!error && data?.user) {
      return {
        user: data.user,
        email: data.user.email,
        mode: "supabase_auth"
      };
    }

    // Si falla Supabase Auth pero coincide con credenciales locales de demostración/defensa
    if (cleanPass === "admin123" || cleanPass === "junamap2026") {
      return {
        user: { email: ADMIN_OFFICIAL_EMAIL },
        email: ADMIN_OFFICIAL_EMAIL,
        mode: "fallback_key"
      };
    }

    throw new Error(error?.message || "Credenciales de administrador inválidas.");
  }

  // Respaldo si ingresa clave de defensa
  if (cleanPass === "admin123" || cleanPass === "junamap2026") {
    return {
      user: { email: ADMIN_OFFICIAL_EMAIL },
      email: ADMIN_OFFICIAL_EMAIL,
      mode: "fallback_key"
    };
  }

  throw new Error("Correo o contraseña de administrador incorrectos.");
}

/**
 * Solicitar correo de restablecimiento de contraseña mediante Supabase Auth
 */
export async function solicitarResetPasswordAdmin(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Ingresa un correo electrónico válido.");
  }

  if (cleanEmail !== ADMIN_OFFICIAL_EMAIL) {
    throw new Error(`Solo se permite restablecer la contraseña para el correo oficial de administración (${ADMIN_OFFICIAL_EMAIL}).`);
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase no está configurado en este entorno.");
  }

  const redirectUrl = `${window.location.origin}/?reset=true`;
  const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: redirectUrl
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Cambiar la contraseña del administrador autenticado en Supabase Auth
 */
export async function cambiarPasswordAdmin(nuevaPassword) {
  if (!nuevaPassword || nuevaPassword.length < 6) {
    throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
  }

  const { data, error } = await supabase.auth.updateUser({
    password: nuevaPassword
  });

  if (error) {
    throw error;
  }

  return data;
}
