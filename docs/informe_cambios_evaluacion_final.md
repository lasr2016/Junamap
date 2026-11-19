# Informe de Estabilización y Cierre Técnico — Evaluación Final (JunaMap)

Este documento resume todas las mejoras funcionales, arquitectónicas y de calidad implementadas en **JunaMap** para cumplir al 100% con el **Incremento Funcional 2 (Semanas 13–14)** y dejar la versión candidata lista para la **Defensa Final (Semana 15 / Evaluación 4)**.

---

## 1. Eliminación de "Próximamente" e Implementación del Modo Invitado + Favoritos Locales
* **Problema detectado:** En el menú lateral (`Drawer`) existían botones de *"Iniciar sesión"* y *"Crear cuenta"* para estudiantes que disparaban `alert("Próximamente...")`, contradiciendo el principio de privacidad y minimización de datos (`DA-02`) del informe.
* **Solución implementada:**
  * Se reemplazó la caja de registro de estudiantes por el **Modo Invitado Activo** (`🟢 Modo Invitado Activo`), explicando que el estudiante puede usar JunaMap sin entregar datos personales.
  * Se implementó un sistema de **Favoritos persistidos localmente (`localStorage` bajo la clave `junamap_favoritos_v1`)**:
    * Cada tarjeta y elemento de la lista de comercios cuenta ahora con un botón de corazón (`🤍 / ❤️`).
    * Se añadió un chip de filtro rápido **`♥ Favoritos`** en la barra superior del mapa y un botón directo **`❤️ Mis Favoritos`** en el menú lateral.

---

## 2. Sistema Normalizado de Reportes de Errores y Locales (`reportes_locales`)
* **Problema detectado:** El botón *"Reportar un error"* mostraba un `alert("Para reportar un local o error, contáctanos en contacto@junamap.cl")`, cortando la experiencia del usuario.
* **Solución implementada:**
  * **Base de Datos (`sql/esquema_incremento_2.sql`):** Se incorporó la tabla normalizada `public.reportes_locales` con llave foránea opcional a `public.locales(id)`, motivo, descripción sanitizada, correo de contacto opcional, estado (`pendiente`, `revisado`, `descartado`) y políticas **Row Level Security (RLS)**.
  * **Modal Interactivo en Frontend (`src/App.jsx`):**
    * Accesible desde el menú lateral (*"⚑ Reportar un error o local"*) y también directamente desde la tarjeta de detalle de cualquier comercio (*"⚑ Reportar"*).
    * Permite elegir el comercio, seleccionar el motivo estandarizado (ej. *"El local ya no acepta tarjeta BAES"*, *"Horario incorrecto"*, *"Ubicación equivocada"*) y enviar el reporte a Supabase.

---

## 3. Panel de Administración (`/admin`) con Supabase Auth, Recuperación y Cambio de Contraseña
* **Problema detectado:** El acceso administrativo solo tenía un campo simple de contraseña fija y carecía de gestión de cuenta, recuperación por correo y bandeja de reportes.
* **Solución implementada (`src/services/localService.js` y `src/App.jsx`):**
  * **Inicio de sesión formal:** Formulario con **Correo del Administrador** (restringido y preconfigurado con `webjunamap@gmail.com`) y **Contraseña**, integrado con `supabase.auth.signInWithPassword` (manteniendo compatibilidad de respaldo con la clave de defensa para pruebas sin red).
  * **Recuperación de contraseña por correo (`¿Olvidaste tu contraseña?`):**
    * Vista dedicada que valida y envía a `webjunamap@gmail.com` el enlace de restablecimiento mediante `supabase.auth.resetPasswordForEmail(email, { redirectTo: '.../?reset=true' })`.
  * **Cambio de contraseña (`🔐 Cambiar clave`):**
    * Permite actualizar la clave del administrador en caliente mediante `supabase.auth.updateUser({ password })`, tanto desde dentro del panel como al regresar desde el enlace del correo de recuperación (`PASSWORD_RECOVERY`).
  * **3 Pestañas de Gestión en el Panel de Moderación:**
    1. **Postulaciones:** Aprobación/rechazo en vivo con **geocodificación asistida** (mini-mapa interactivo desplegable) y ajuste manual de coordenadas (`lat`/`lng`) validando el rango geográfico de Talca (`RSK-14`).
    2. **Reportes:** Bandeja para revisar o descartar los reportes enviados por los estudiantes en `reportes_locales`.
    3. **Auditoría:** Visualización en vivo de la trazabilidad histórica guardada en la tabla `verificar_locales`.

---

## 4. Geocodificación Asistida (Mini-Mapa Interactivo + Coordenadas Manuales Sincronizadas)
* **Compromiso de la defensa anterior:** *"Geocodificación asistida: Pinchar directamente en el mapa para ubicar el local sin tener que saber la latitud y longitud numéricas"*.
* **Solución implementada (`LocationPickerMap` en `src/App.jsx`):**
  * **En el formulario público ("Registrar mi local"):** Se integró un mini-mapa interactivo de Leaflet/OpenStreetMap (manteniendo **Costo Operativo Cero — `DA-01`**) donde el usuario puede **pinchar en cualquier esquina de Talca o arrastrar el pin** para fijar la ubicación del local, además de un botón rápido **`📍 Centrar en mi posición`**.
  * **Mapa redimensionable hacia abajo (Agrandar / Achicar):** Incluye tanto un botón flotante **`🗖 Agrandar mapa` / `🗕 Achicar mapa`** (que duplica la altura del mapa a `410px`) como una **barra inferior arrastrable (`↕ Arrastra aquí para agrandar o achicar el mapa`)** que permite estirar libremente el mapa hacia abajo hasta `540px` y reajusta las teselas de Leaflet en vivo (`map.invalidateSize()`).
  * **En el Panel de Moderación (`/admin`):** En cada solicitud pendiente se incorporó el botón **`🗺️ Pinchar en mapa`** que despliega el mismo mapa interactivo redimensionable para que el administrador corrija visualmente el pin antes de aprobarlo.
  * **Sincronización bidireccional con ingreso manual:** Las cajas numéricas de `Latitud` y `Longitud` permanecen editables y sincronizadas en tiempo real con el pin del mini-mapa, permitiendo tanto la selección visual asistida como el ingreso manual para pruebas de casos borde (`AC-12` / `RSK-14`).

---

## 5. Cumplimiento de Regresión, Seguridad y Limpieza de Datos (Informe Semana 13)
* **Conexión real del modal "Sugerir un local" ("Conozco uno"):** Ahora inserta registros reales con estado `'pendiente'` en Supabase en lugar del antiguo aviso *"modo prueba"*.
* **Validaciones y Sanitización (`DEF-02`, `QA-08`, `RSK-14`, `FL-05`):**
  * Sanitización contra inyección HTML/XSS (`sanitizeInput`) en postulaciones y reportes.
  * Validación estricta del radio urbano de Talca (`lat` entre `-35.48` y `-35.38`, `lng` entre `-71.72` y `-71.58`).
  * Banner visual controlado cuando actúa el fallback local (`FL-05`).
  * Filtro y botón **`🧹 Limpiar datos de prueba`** para purgar registros basura (`"prueba local"`, `"asdsa"`).
* **CI y Pruebas Automatizadas (`PBI-07` / Sección 11):**
  * Suite en `src/__tests__/regression.test.js` ampliada a **6 tests unitarios y de regresión en Vitest** (Haversine `calcDist`, filtrado por producto, casos borde, normalización Unicode, sanitización XSS y filtrado de favoritos).
  * Pipeline de Integración Continua creado en `.github/workflows/ci.yml` (`npm run lint`, `npm test`, `npm run build`).
