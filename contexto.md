# Contexto del Proyecto: JunaMap

**JunaMap** es una aplicación web mobile-first pensada para estudiantes de educación superior (Talca, Región del Maule) que utilizan la beca BAES (Junaeb). Su objetivo principal es geolocalizar y filtrar comercios asociados que aceptan este medio de pago.

---

### Stack Tecnológico
- **Frontend:** React 19 + Vite, Leaflet / React-Leaflet, Tailwind CSS.
- **Backend & Base de Datos:** Supabase (PostgreSQL) con Row Level Security (RLS).
- **Despliegue local:** Soporte para Node.js y contenedores Docker (Docker Compose + Nginx).

---

### Funcionalidades Implementadas Hasta el Momento

1. **Mapa Interactivo y Geolocalización:**
   - Mapa con marcadores personalizados según la categoría del local.
   - Detección de ubicación GPS del usuario y cálculo de distancia en metros/kilómetros.
   - Centrado animado y marcador dinámico con pulso radar.

2. **Búsqueda y Filtros Avanzados:**
   - Barra de búsqueda por nombre, sector o tipo de comida.
   - Filtros rápidos por categoría (*Almuerzo, Cafetería, Minimarket, Panadería*).
   - Filtros de productos específicos (*Completos, Pizzas, Sushi, Bebidas, etc.*).
   - Estado de horario en tiempo real (*Abierto / Cerrado*).

3. **Bottom Sheet Móvil y Navegación:**
   - Panel deslizable con 3 estados para explorar el listado de locales y detalles.
   - Acceso a direcciones en Google Maps (*Cómo llegar*) y llamada directa.
   - Menú lateral (drawer) preparado para futuras opciones de cuenta y soporte.

4. **Migración a Base de Datos (Supabase):**
   - Transición desde un JSON local estático a una tabla PostgreSQL `public.locales`.
   - Políticas de seguridad RLS y permisos públicos (`anon`) configurados.
   - Scripts SQL versionados en la carpeta `sql/` con carga inicial de comercios.
   - Modo de respaldo local (*fallback*) en el cliente React ante cortes de red.
