Este proyecto es una aplicación web responsiva diseñada bajo el enfoque mobile-first, que permite a los estudiantes geolocalizar de manera rápida, confiable y verificada los comercios que aceptan la tarjeta BAES (Junaeb).

-Requisitos Previos
Para ejecutar y probar este proyecto de forma local, necesitas tener instalado en tu computadora:

Node.js: Versión v18.0.0 o superior (Recomendado: v22.13.0 LTS o superior).
Git: Para la clonación del repositorio y control de versiones.
-Guía de Instalación y Despliegue Rápido
Sigue estos 4 pasos exactos en tu terminal para clonar el repositorio, configurar el entorno y levantar la aplicación en menos de un minuto:

Paso 1: Clonar el Repositorio
Abre tu consola (Git Bash, CMD o PowerShell), navega hasta la carpeta donde deseas guardar el proyecto (por ejemplo, tu Escritorio) y ejecuta:

git clone https://github.com/lasr2016/Junamap.git

Paso 2: Entrar al Directorio del Proyecto
cd junamap
Paso 3: Instalar las Dependencias
Ejecuta el siguiente comando para descargar de forma automática las librerías necesarias (React, Vite, Leaflet, Tailwind CSS, entre otras):

npm install
(Nota: La carpeta pesada node_modules no se incluye en el repositorio debido al archivo .gitignore, por lo que este paso es obligatorio para reconstruirla localmente).

Paso 4: Levantar el Servidor de Desarrollo
Para arrancar el servidor en tu computadora:

npm run dev
Abre en tu navegador la dirección que te entregue la consola, la cual suele ser: http://localhost:5173/

📱 ¿Cómo probarlo en tu Celular (Red Local)?
Dado que JunaMap está pensado para usarse en terreno, puedes visualizar y probar la interfaz responsiva directamente en tu teléfono móvil siguiendo estos pasos:

Asegúrate de que tu computadora y tu celular estén conectados a la misma red Wi-Fi.
Levanta el servidor en tu terminal exponiéndolo a la red local con el comando:
npm run dev -- --host
La consola te mostrará una dirección bajo la etiqueta Network (ejemplo: http://192.168.1.35:5173).
Escribe esa dirección exacta en el navegador web de tu celular
