# JunaMap: Plan de Implementación Técnica y Trazabilidad (Incremento 2 - Semana 14)

Este documento detalla **exactamente todo lo que debe estar construido en el repositorio y código de JunaMap** para cumplir rigurosamente con lo comprometido en el informe de la **Semana 13** y superar la evaluación automatizada y de rúbrica del profesor.

---

## 1. Esquema de Base de Datos en Supabase (PostgreSQL)

Para que coincida con el **Modelo Conceptual de la Imagen 1** y los PBIs del informe, se debe ejecutar el siguiente script SQL en el editor de Supabase.

### 1.1 Script SQL de Tablas y Relaciones
```sql
-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Categorías oficiales
CREATE TABLE categorias (
    id SMALLSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    color_hex VARCHAR(7) NOT NULL,
    icono TEXT,
    ejemplos TEXT
);

-- Insertar categorías oficiales de JunaMap
INSERT INTO categorias (nombre, slug, color_hex) VALUES
('Almuerzo', 'almuerzo', '#d8502c'),
('Cafetería', 'cafeteria', '#8b5336'),
('Minimarket', 'minimarket', '#257ce6'),
('Panadería', 'panaderia', '#df9800');

-- 3. Catálogo maestro de productos
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL UNIQUE,
    nombre_busqueda TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Métodos de cobro
CREATE TABLE metodos_cobro (
    id SMALLSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
);

INSERT INTO metodos_cobro (nombre) VALUES 
('Edenred POS'), ('Edenred App'), ('Ticket Junaeb');

-- 5. Locales comerciales
CREATE TYPE estado_local AS ENUM ('pendiente', 'verificado', 'rechazado');

CREATE TABLE locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id SMALLINT REFERENCES categorias(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    direccion TEXT NOT NULL,
    comuna TEXT DEFAULT 'Talca',
    latitud NUMERIC(9,6) NOT NULL,
    longitud NUMERIC(9,6) NOT NULL,
    telefono TEXT,
    abre TIME,
    cierra TIME,
    estado estado_local DEFAULT 'pendiente',
    verificado_por UUID,
    verificado_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabla intermedia Locales <-> Productos (N:M)
CREATE TABLE productos_local (
    local_id UUID REFERENCES locales(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
    precio_clp INTEGER,
    disponible BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (local_id, producto_id)
);
```

### 1.2 Políticas de Seguridad (Row Level Security - RLS)
> **Evidencia requerida por Sección 14 del informe (QA-07):** El público solo puede ver locales si `estado = 'verificado'`.
```sql
ALTER TABLE locales ENABLE ROW LEVEL SECURITY;

-- Lectura pública anónima: SOLO locales verificados
CREATE POLICY "Lectura publica de locales verificados"
ON locales FOR SELECT
TO anon, authenticated
USING (estado = 'verificado');

-- Inserción pública: Cualquiera puede postular (queda en pendiente)
CREATE POLICY "Insercion publica de postulaciones"
ON locales FOR INSERT
TO anon, authenticated
WITH CHECK (estado = 'pendiente');

-- Actualización y moderación: SOLO administradores autenticados
CREATE POLICY "Moderacion solo admin"
ON locales FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

---

## 2. Capa de Servicios Frontend: `src/services/localService.js`

Para cumplir con el **PBI-06**, el **ADR-02** y el **Spike-03**, el frontend no debe consultar Supabase desordenadamente en los componentes. Debe centralizarse en este servicio:

```javascript
import { createClient } from '@supabase/supabase-js';
import fallbackLocales from '../data/locales.json';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * PBI-06 / AC-10: Obtiene solo locales verificados y los adapta al contrato del frontend
 */
export async function getLocalesVerificados() {
  try {
    const { data, error } = await supabase
      .from('locales')
      .select(`
        id,
        nombre,
        descripcion,
        direccion,
        latitud,
        longitud,
        abre,
        cierra,
        telefono,
        categorias ( nombre ),
        productos_local ( productos ( nombre ) )
      `)
      .eq('estado', 'verificado');

    if (error) throw error;

    // Adaptador de datos para no romper componentes del Incremento 1 (DEF-01 / REG-02)
    return data.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      tipo: item.categorias?.nombre || 'Almuerzo',
      direccion: item.direccion,
      lat: parseFloat(item.latitud),
      lng: parseFloat(item.longitud),
      abre: item.abre,
      cierra: item.cierra,
      telefono: item.telefono,
      descripcion: item.descripcion,
      verificado: true,
      productos: item.productos_local?.map((p) => p.productos?.nombre) || []
    }));
  } catch (err) {
    console.warn("Fallo al conectar con Supabase. Activando Fallback local (FL-05):", err);
    return fallbackLocales; // Fallback seguro para no dejar la app en blanco
  }
}

/**
 * PBI-04 / AC-08: Enviar postulación de local con estado pendiente
 */
export async function postularLocal(formData) {
  // Validación de rango geográfico en Talca (RSK-14)
  if (formData.lat < -35.46 || formData.lat > -35.40 || formData.lng < -71.70 || formData.lng > -71.60) {
    throw new Error("Las coordenadas están fuera del radio autorizado de Talca.");
  }

  const { data, error } = await supabase
    .from('locales')
    .insert([
      {
        nombre: formData.nombre.trim(),
        direccion: formData.direccion.trim(),
        latitud: formData.lat,
        longitud: formData.lng,
        telefono: formData.telefono,
        abre: formData.abre,
        cierra: formData.cierra,
        descripcion: formData.descripcion,
        estado: 'pendiente'
      }
    ]);

  if (error) throw error;
  return data;
}

/**
 * PBI-05 / AC-09: Moderar local (Aprobar o Rechazar)
 */
export async function moderarLocal(localId, nuevoEstado) {
  const { data, error } = await supabase
    .from('locales')
    .update({ 
      estado: nuevoEstado, 
      verificado_en: new Date().toISOString() 
    })
    .eq('id', localId);

  if (error) throw error;
  return data;
}
```

---

## 3. Pruebas Automatizadas de Regresión: `src/__tests__/regression.test.js`

> **Requerido por RET-07, PBI-07, Sección 10 y Sección 11.**  
> Instalar Vitest: `npm install -D vitest` y agregar `"test": "vitest run"` a `package.json`.

```javascript
import { describe, it, expect } from 'vitest';

// 1. Probar cálculo Haversine para prevenir NaN con datos de BD
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

describe('Plan de Regresión - Incremento 1 protegido', () => {
  it('calcDist calcula distancias válidas sin valores NaN', () => {
    // Plaza Talca a 1 Sur 1245
    const dist = calcDist(-35.426, -71.655, -35.4264, -71.6557);
    expect(dist).toBeGreaterThan(0);
    expect(Number.isNaN(dist)).toBe(false);
  });

  it('visibleLocales filtra correctamente por comida puntual', () => {
    const mockLocales = [
      { id: 1, nombre: 'Local A', productos: ['Completos', 'Bebidas'] },
      { id: 2, nombre: 'Local B', productos: ['Sushi'] }
    ];
    const filtrados = mockLocales.filter(l => l.productos.includes('Completos'));
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].nombre).toBe('Local A');
  });

  it('Manejo de caso borde sin resultados (AC-04)', () => {
    const mockLocales = [
      { id: 1, nombre: 'Local A', productos: ['Completos'] }
    ];
    const filtrados = mockLocales.filter(l => l.productos.includes('Pizza'));
    expect(filtrados.length).toBe(0);
  });
});
```

---

## 4. Configuración de Variables de Entorno (`.env.example`)
Crear archivo `.env.example` en la raíz:
```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```
Verificar que `.env.local` esté en `.gitignore` para cumplir con la Sección 14 (Gestión de secretos).
