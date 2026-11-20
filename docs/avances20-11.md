# Avances del 20 de noviembre de 2026

## Creado

- **Gestionar locales** en el Panel de Moderación. Lista los locales publicados, permite editar sus datos y retirarlos del mapa con confirmación. El retiro desactiva el local y conserva su registro e historial. Ver [GestionarLocales.jsx](../src/GestionarLocales.jsx), [App.jsx](../src/App.jsx) y [localService.js](../src/services/localService.js).
- **Auditoría de retiros** en Supabase. Cada retiro nuevo registra el local, el moderador y la fecha. Se recuperaron tres retiros anteriores identificables por su estado, sin fecha ni moderador. Ver [auditar_retiros_locales.sql](../sql/auditar_retiros_locales.sql).

## Mejorado

- **Gestión de locales:** buscador por nombre, dirección o categoría que ignora mayúsculas y tildes. Muestra cinco resultados a la vez y permite revelar más. Las tarjetas tienen mayor contraste y la edición incorpora etiquetas en negrita, horarios en una fila y un botón de cierre superior.
- **Favoritos y ubicación:** se reemplazaron los corazones de emoji por íconos que se rellenan en rojo. Se ocultaron los filtros de comidas en Favoritos y se movió la activación de ubicación al encabezado para alinear los corazones a la derecha.
- **Panel inferior:** el arrastre actualiza la posición una vez por cuadro. Conserva sus tres niveles y deselecciona el local al llegar al mínimo.
- **Mapas:** el crédito de OpenStreetMap quedó arriba a la derecha, con fondo translúcido, sobre el buscador y sobre el botón de expansión del selector. Se quitaron los símbolos de «Agrandar mapa» y «Achicar mapa».
- **Panel lateral y postulaciones:** se alinearon los íconos de ayuda, se simplificaron los textos del panel lateral y se destacaron en negrita las descripciones en Postulaciones. Los cambios visuales están en [App.jsx](../src/App.jsx) y [App.css](../src/App.css).

## Corregido

- **Acceso de moderación:** se quitó el acceso de demostración y se exige una sesión real de Supabase Auth. Las actualizaciones de locales quedaron restringidas al moderador y los errores de retiro se muestran en la tarjeta. Ver [proteger_actualizacion_locales.sql](../sql/proteger_actualizacion_locales.sql).
- **Permisos de reportes:** se habilitó la lectura y actualización para la cuenta de moderación. Ver [permisos_reportes_moderacion.sql](../sql/permisos_reportes_moderacion.sql).
- **Recuperación de contraseña local:** se autorizó `https://localhost:5173/?reset=true` en **Authentication → URL Configuration** del panel de Supabase. El ajuste se guardó en el panel, fuera de los scripts SQL.
- **Postulaciones en celular:** los campos de latitud y longitud se adaptan al ancho disponible y ya no ensanchan el panel.
- **Accesibilidad:** se asociaron etiquetas a las coordenadas y al buscador de Gestión de locales. Los títulos del mapa, los productos BAES y el tipo de local identifican sus grupos de controles.
