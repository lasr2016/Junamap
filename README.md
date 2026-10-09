
# JunaMap

Aplicación web responsiva diseñada bajo el enfoque *mobile-first*, que permite a los estudiantes geolocalizar de manera rápida, confiable y verificada los comercios que aceptan la tarjeta BAES (Junaeb).

---
## Requisitos Previos e Instalaciones

### Requisitos Previos (Docker)

- **Docker Desktop** (o Docker Engine + Docker Compose) instalado y corriendo en tu computadora.
- **Ejecutar Docker Desktop** (dejarlo abierto)

### Requisitos Previos (Node.js)

- **Node.js**: Versión v18.0.0 o superior (Recomendado: v22.x LTS o superior).
- **Git**

### Instalar dependencias (en caso de no usar Docker)

```bash
npm install
```

---
## Opciones de Ejecución

### Opción 1: Docker

Esta opción permite levantar el proyecto en cualquier computadora que tenga Docker instalado, **sin necesidad de instalar Node.js ni dependencias locales**.

1. **Clonar el repositorio:** (Recomendado clonar en vez que bajar el ZIP, con clone queda conectado de inmediato al repo)
```bash
git clone https://github.com/lasr2016/Junamap.git
cd Junamap
```
	
2. **Levantar el contenedor con Docker Compose**:
```bash
docker compose up -d --build
```
	
3. **Abrir en el navegador:** Ingresa a: [http://localhost:8080](http://localhost:8080)
	
4. **Para detener la aplicación**: 
```bash
docker compose down
```


### Opción 2: Node.js

Si deseas modificar código en tiempo real con recarga automática:

1. **Clonar, acceder e instalar dependencias:**
```bash
git clone https://github.com/lasr2016/Junamap.git
cd Junamap
npm install
```
	
2. **Configurar variables de entorno:**
   - Copia o renombra `.env.example` a `.env`
   - Solicita las credenciales de Supabase al grupo y pégalas en `.env`.

3. **Levantar el servidor de desarrollo:**
```bash
npm run dev
```
   - Abre en tu navegador la dirección indicada en la consola: [http://localhost:5173/](http://localhost:5173/)


---

## ¿Cómo probarlo en tu Celular (Red Local)?

Dado que JunaMap está pensado para usarse en terreno y requiere geolocalización (la cual exige HTTPS en dispositivos externos):

- Asegúrate de que tu computadora y tu celular estén conectados a la **misma red Wi-Fi**.
    
- Levanta el servidor exponiéndolo a la red local:
```bash
npm run dev --host
```
    
- La consola te mostrará una dirección bajo la etiqueta **Network** (ejemplo: `https://192.168.1.35:5173`).
    
- Abre esa dirección en el navegador web de tu celular.
    
- Si aparece la advertencia _"La conexión no es privada"_ (debido al certificado autofirmado para SSL local), pulsa en **Configuración avanzada** y selecciona **Acceder a la dirección (no seguro)** para permitir el uso del GPS.