-- ==============================================================================
-- PLANTILLA: INSERTAR UN NUEVO LOCAL EN JUNAMAP
-- Archivo: sql/insert_local_ejemplo.sql
-- 
-- Copia esta plantilla, edita los valores y ejecútala en Supabase SQL Editor.
-- El ID se generará de forma automática y secuencial.
-- ==============================================================================

INSERT INTO public.locales (
    nombre,
    tipo,
    direccion,
    lat,
    lng,
    abre,
    cierra,
    telefono,
    descripcion,
    verificado,
    metodo_cobro,
    productos,
    activo
) VALUES (
    'Nombre del Local',                      -- Nombre o sucursal (ej: 'Café Central - 1 Sur')
    'Almuerzo',                              -- 'Almuerzo' | 'Cafetería' | 'Minimarket' | 'Panadería'
    'Dirección calle y número, Talca',       -- Dirección textual
    -35.426400,                              -- Latitud
    -71.655700,                              -- Longitud
    '09:00',                                 -- Hora de apertura en formato TIME ('HH:MM')
    '21:00',                                 -- Hora de cierre en formato TIME ('HH:MM')
    '+56912345678',                          -- Teléfono (o NULL si no tiene)
    'Descripción de la comida y promociones.',
    true,                                    -- true si acepta BAES / Junaeb
    'Edenred POS',                           -- 'Edenred POS' | 'Edenred POS / App' | 'Edenred QR'
    ARRAY['Completos', 'Bebidas'],           -- Etiquetas que coinciden con los filtros de la app
    true                                     -- true para que se muestre en el mapa
);
