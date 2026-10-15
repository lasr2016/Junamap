# Resumen de Avances — 14 de Octubre

Documento de registro con las mejoras y funcionalidades implementadas en la sesión.

---

### 1. Nuevo Diseño de Pines de Categorías en el Mapa
- **Iconos vectoriales dinámicos:** Implementación de `crearPinIcon` en `src/utils/pinIcons.js` con diseño de círculo, puntero inferior y SVG representativo para cada categoría (Almuerzo, Cafetería, Minimarket y Panadería).
- **Paleta de colores unificada:** Sincronización de los tonos hex oficiales (`#d8502c`, `#8b5336`, `#257ce6`, `#df9800`) en mapa, chips de categorías y tarjetas del Bottom Sheet.
- **Microinteracciones y rendimiento:** Efecto *hover*, realce al estar seleccionado (`sel`), atenuado al filtrar (`dim`) y sistema de caché en memoria de iconos para mantener fluidez en el renderizado.

### 2. Modal Informativo "Acerca de JunaMap"
- **Ventana modal con botón de cierre:** Al presionar "Acerca de JunaMap" en el menú lateral, se abre una tarjeta emergente con botón `X` de cierre rápido, desenfoque de fondo y soporte para tecla `Escape` o clic exterior.
- **Contenido legal e informativo:**
  - *Aviso de independencia y no afiliación:* Aclaración del carácter comunitario del proyecto sin vínculo oficial con JUNAEB, BAES ni operadores.
  - *Sobre los datos, comercios y vigencia:* Advertencia sobre el carácter referencial de precios, horarios y aceptación de pago.
- **Accesibilidad:** Uso del atributo nativo `inert` y liberación de foco (`blur`) al cerrar para evitar advertencias de accesibilidad WAI-ARIA.

### 3. Ajustes de UX en el Bottom Sheet
- **Reinicio automático de scroll horizontal:** Al cerrar o bajar el panel inferior (`sheetState === 0`) o pulsar "Eliminar filtros", las 3 filas de comidas vuelven automáticamente a su posición inicial a la izquierda.
- **Efecto de desvanecimiento lateral (Fade Gradient):** Aplicación de máscara de degradado en el extremo derecho de las filas de alimentos para indicar de forma visual que existen más opciones para deslizar.
- **Ajuste de texto en recomendación:** Modificación del tooltip del botón GPS a: *"Te recomendamos activar la ubicación para una mejor experiencia de usuario."*.
