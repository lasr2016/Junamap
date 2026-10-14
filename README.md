# JunaMap

JunaMap es una aplicación web **mobile-first y responsiva** orientada a estudiantes de educación superior de Talca que utilizan la tarjeta BAES (Junaeb). Su objetivo es facilitar la búsqueda y geolocalización de comercios que aceptan este medio de pago, permitiendo filtrar locales, revisar información básica y utilizar la ubicación del usuario para estimar distancias.

## Funcionalidades actuales

- Mapa interactivo basado en **Leaflet + OpenStreetMap**.
- Marcadores diferenciados por categoría: Almuerzo, Cafetería, Minimarket y Panadería.
- Búsqueda por nombre, dirección, categoría, descripción y productos.
- Filtros por categoría y productos específicos.
- Geolocalización del usuario y cálculo de distancia a los locales.
- Estado de horario del comercio: **Abierto / Cerrado**.
- Panel inferior deslizable (*bottom sheet*) con listado y detalle de locales.
- Acceso a Google Maps para obtener indicaciones de cómo llegar.
- Opción de llamada cuando el comercio posee teléfono registrado.
- Menú lateral y formulario de registro de locales preparado para futuras funcionalidades.
- Interfaz adaptable a dispositivos móviles y pantallas de escritorio.

> **Estado actual:** los locales que se muestran en el mapa se cargan desde `src/data/locales.json`. El cliente de Supabase está configurado en el proyecto y se utiliza para comprobar la conexión, pero el listado visible de comercios todavía no se obtiene directamente desde Supabase.

---

## Tecnologías utilizadas

- **React 19**
- **Vite 8**
- **Leaflet / React-Leaflet**
- **Tailwind CSS**
- **Supabase JS**
- **Docker + Docker Compose**
- **Nginx** para servir la versión de producción dentro del contenedor

---

## Variables de entorno

Antes de ejecutar el proyecto es necesario crear un archivo `.env` en la raíz.

El repositorio incluye una plantilla llamada `.env.example`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-aqui
```

### Crear `.env` en Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Crear `.env` en macOS o Linux

```bash
cp .env.example .env
```

Luego completa `.env` con los datos entregados por el equipo:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

Las variables reales **no se encuentran en GitHub** y deben ser entregadas por separado a quien necesite ejecutar el proyecto localmente.

> Usa únicamente la clave pública para frontend (`anon` / `publishable`). **Nunca agregues una `service_role` o secret key al frontend, al `.env` del proyecto ni al repositorio.**

El archivo `.env` está excluido de Git mediante `.gitignore`.

---

# Ejecución del proyecto

Hay dos formas principales de ejecutar JunaMap.

## Opción 1: Docker

Es la opción más sencilla para ejecutar la aplicación sin instalar Node.js ni las dependencias del proyecto en el sistema.

### Requisitos

- **Docker Desktop** o Docker Engine + Docker Compose.
- Docker debe estar iniciado antes de ejecutar los comandos.

### 1. Obtener el proyecto

Puedes clonarlo con GitHub Desktop o mediante Git:

```bash
git clone https://github.com/lasr2016/Junamap.git
cd Junamap
```

También puedes descargar el ZIP desde GitHub y abrir una terminal dentro de la carpeta extraída.

### 2. Configurar `.env`

Crea `.env` a partir de `.env.example` y agrega las variables de Supabase antes de construir la imagen.

En PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Construir y levantar la aplicación

```bash
docker compose up -d --build
```

### 4. Abrir JunaMap

Entra desde el navegador a:

**http://localhost:8080**

### 5. Comprobar que el contenedor esté funcionando

```bash
docker compose ps
```

### 6. Ver los logs

```bash
docker compose logs --tail=100
```

### 7. Detener la aplicación

```bash
docker compose down
```

### Después de modificar el código

La versión Docker utiliza un build de producción. Por eso, después de cambiar archivos del proyecto debes guardar los cambios y reconstruir:

```bash
docker compose up -d --build
```

Luego actualiza el navegador. Si no aparecen los cambios, utiliza una recarga forzada (`Ctrl + Shift + R`).

---

## Opción 2: Node.js / desarrollo

Esta opción es recomendable cuando se está modificando el código, ya que Vite ofrece recarga automática durante el desarrollo.

### Requisitos

- **Node.js 20.19 o superior**, o **Node.js 22.12 o superior**.
- Git, solamente si se clonará el repositorio mediante Git.

### 1. Clonar el repositorio

```bash
git clone https://github.com/lasr2016/Junamap.git
cd Junamap
```

### 2. Configurar `.env`

Crea `.env` desde `.env.example` y agrega las variables entregadas por el equipo.

### 3. Instalar las dependencias

```bash
npm ci
```

### 4. Levantar el servidor de desarrollo

```bash
npm run dev
```

Vite mostrará la dirección local en la terminal. El proyecto utiliza un certificado SSL local para desarrollo, por lo que normalmente se abrirá en una dirección similar a:

**https://localhost:5173/**

El navegador puede mostrar una advertencia debido al certificado local autofirmado.

---

## Probar JunaMap desde un celular en la misma red

Para exponer el servidor de desarrollo a otros dispositivos de la red local:

```bash
npm run dev -- --host 0.0.0.0
```

La consola mostrará una dirección bajo **Network**, por ejemplo:

```text
https://192.168.1.35:5173/
```

El computador y el celular deben estar conectados a la misma red Wi-Fi.

> **Importante sobre la ubicación:** la API de geolocalización del navegador requiere un contexto seguro. El proyecto usa HTTPS local mediante un certificado autofirmado, pero algunos navegadores o dispositivos pueden seguir bloqueando el GPS debido a que el certificado no es de confianza. Para una prueba confiable de geolocalización desde un dispositivo externo se recomienda utilizar un despliegue con HTTPS válido.

---

## Estructura principal del proyecto

```text
Junamap/
├── public/
├── src/
│   ├── data/
│   │   └── locales.json
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── main.jsx
│   └── supabaseClient.js
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

---

## Problemas comunes

### `supabaseUrl is required`

Significa que Vite no recibió las variables de Supabase durante la construcción de la aplicación.

Comprueba que exista un archivo `.env` con:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Si estás usando Docker, reconstruye la imagen después de crear o modificar `.env`:

```bash
docker compose down
docker compose up -d --build
```

### La aplicación no muestra los cambios realizados

Si estás utilizando Docker:

```bash
docker compose up -d --build
```

Después utiliza `Ctrl + Shift + R` en el navegador.

Si estás utilizando `npm run dev`, Vite normalmente actualiza los cambios automáticamente.

### Revisar el puerto de Docker

```bash
docker compose ps
```

La configuración actual publica:

```text
8080 -> 80
```

Por lo tanto, la aplicación se abre en:

**http://localhost:8080**

---

## Consideraciones para compartir o evaluar el proyecto

- El repositorio **no debe incluir `.env`**.
- Las variables necesarias para ejecutar el proyecto localmente deben entregarse por un canal separado.
- Si se entrega un ZIP manualmente, elimina `.env` antes de comprimirlo.
- Para una evaluación más sencilla, lo ideal es complementar el repositorio con una versión desplegada mediante HTTPS, de modo que la aplicación pueda probarse sin configurar el entorno local.