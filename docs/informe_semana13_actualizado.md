GUÍA DE TRABAJO EN EQUIPO
Evolucionar y estabilizar el producto
Segundo incremento, calidad y plan de estabilización
| SEMANA13 | RESULTADOPlan del Incremento 2 | ENTRADASegunda demostración y defensa | DEFENSASemana 15 |
| --- | --- | --- | --- |
| Pregunta rectora: ¿Qué debe cambiar ahora en el producto para entregar más valor y demostrar un nivel superior de calidad después de la segunda defensa? |

1. Propósito y resultados esperados
La Semana 13 transforma la retroalimentación de la segunda defensa en un objetivo claro para el Incremento Funcional 2 y en un plan verificable de construcción y estabilización para la Semana 14.
| Elemento | Definición de trabajo |
| --- | --- |
| Aprender | Convertir observaciones de la defensa en decisiones y acciones trazables. |
| Enfocar | Definir resultado, hipótesis, alcance, flujo y backlog del Incremento 2. |
| Estabilizar | Definir Done, regresión, calidad, seguridad, defectos y evidencia. |
| Planificar | Ordenar trabajo, responsables, revisiones y candidata para la Semana 14. |
| Ejemplo TurnoÁgil: OBS-14 → DEF-12 → AC-CAN-02 → T-CAN-04: la doble liberación de cupo se transforma en trabajo verificable y evidencia de estabilización. |

2. Retroalimentación de la segunda defensa
Registrar hechos observables de la defensa. Luego identificar impacto, evidencia y la decisión o artefacto que debe cambiar. Evitar respuestas generales como “mejorar el sistema”.
| ID | Categoría | Observación verificable | Impacto | Decisión o acción |
| --- | --- | --- | --- | --- |
| RET-06 | Persistencia y Datos | El catálogo de comercios y las postulaciones operaban exclusivamente en archivos estáticos (locales.json), impidiendo el registro comunitario dinámico sin un nuevo despliegue. | Alto | Activar ADR-02: migrar hacia base de datos en la nube (PostgreSQL en Supabase) con esquema normalizado y permisos RLS. |
| RET-07 | Pruebas de Regresión | La validación del sistema en el Incremento 1 se respaldó con inspección visual y capturas, sin una suite automatizada ejecutable desde consola. | Alto | Implementar suite de pruebas automatizadas con Vitest que proteja el cálculo geodésico (Haversine) y el motor de filtrado ante la llegada de tipos de datos de BD. |
| RET-08 | Seguridad y Moderación | No existía control de acceso ni trazabilidad para la verificación de locales, exponiendo el riesgo de publicar comercios no autorizados. | Alto | Implementar panel de administración (/admin) protegido por clave para moderar postulaciones e incorporar tabla de auditoría (verificar_locales). |
| RET-09 | Calidad y Rendimiento | El acceso a una base de datos externa podría introducir latencia de red superior a los 3 segundos comprometidos en redes móviles (RNF-01). | Alto | Crear vista SQL indexada (vista_locales_mapa) en Supabase para despachar consultas planas al frontend en menos de 200 ms (SPIKE-03). |

3. Retrospectiva del equipo
Analizar prácticas, no personas. Cada cambio debe expresarse como una acción observable, con responsable, fecha y evidencia de cumplimiento.
| Tipo | Práctica o problema | Acción verificable | Responsable y fecha |
| --- | --- | --- | --- |
| Mantener | Uso de Discord para la coordinación técnica y ramas aisladas por PBI en GitHub. | Registro de acuerdos en canales temáticos de Discord y PRs trazables. | Diego López / Continuo |
| Corregir | Pruebas realizadas solo de forma visual al final de cada ciclo. | Escribir suite de regresión automatizada en Vitest cubriendo Haversine, filtros y casos borde antes de integrar a main. | Luis Salas / Semana 14 |
| Detener | Carga manual o directa de datos sobre el frontend sin pasar por una capa de abstracción de datos. | Centralizar las consultas en el servicio localService.js con fallback automático a datos locales ante fallos de red. | Krishna Uribe / Inicio Sem 14 |
| Comenzar | Validación formal de integración y rendimiento antes de desplegar a Vercel. | Ejecución de npm run build y auditoría móvil de Lighthouse comprobando TTI < 3.0 s en cada entrega. | Miguel Espinoza / Inicio Sem 14 |

4. Objetivo del Incremento Funcional 2
El objetivo debe describir quién logra qué nuevo resultado, dentro de qué límite y con qué evidencia. No enumerar capas, componentes ni tareas técnicas.
| Elemento | Definición |
| --- | --- |
| Usuario y contexto | Estudiante de educación superior con beca BAES en Talca que requiere un mapa de comercios siempre actualizado, y locatarios/administradores que necesitan postular y moderar comercios de comida en la ciudad. |
| Resultado | Permitir que un locatario o colaborador envíe los datos de un local mediante un formulario validado (PBI-04), que el administrador apruebe o rechace la solicitud en un panel de moderación (PBI-05), y que los locales aprobados se reflejen dinámicamente en el mapa georreferenciado, asegurando que las funciones del Incremento 1 (búsqueda rápida, orden por Haversine y filtros) mantengan una carga menor a 3 segundos. |
| Límite | Sin transacciones de dinero, sin consulta de saldo bancario/tarjeta BAES, y sin recolección de datos sensibles o GPS del usuario en el servidor. |
| Evidencia | Flujo completo demostrable: envío de formulario → registro en estado "pendiente" en Supabase → moderación en panel admin con cambio a "verificado" y registro en tabla de auditoría → aparición inmediata del pin en el mapa público interactivo. |

5. Hipótesis de valor y señal de éxito
Formular una relación que pueda ser refutada. La señal debe permitir mantener, modificar o descartar una decisión de producto.
| ID | Hipótesis | Señal observable | Decisión según resultado |
| --- | --- | --- | --- |
| H-03 | Permitir la postulación pública y moderación ágil aumentará la cobertura del catálogo de comercios en Talca sin comprometer la veracidad de que aceptan BAES. | En pruebas controladas con 5 solicitudes, el flujo de aprobación y publicación toma menos de 2 minutos y el 100% de los locales publicados mantienen su bandera de verificación. | Si se cumple: Se consolida el flujo colaborativo. Si falla: Se restringe el registro únicamente al equipo interno. |
| H-04 | La migración a base de datos externa no degradará la experiencia interactiva móvil (RNF-01) si se implementa una estrategia de lectura optimizada. | Auditoría en Chrome DevTools bajo red 4G simulada muestra tiempo de renderizado de pines inferior a 3.0 segundos. | Si carga < 3s: Se mantiene la persistencia en Supabase. Si carga ≥ 3s: Se incorpora caché en localStorage o Service Worker para lecturas en cliente. |

6. Alcance y flujo prioritario
Proteger el objetivo mediante límites explícitos. Describir el recorrido principal y los desvíos prioritarios que deben quedar controlados.
| Categoría | Capacidades | Justificación |
| --- | --- | --- |
| Incluye | Formulario público de postulación con sanitización (PBI-04); panel de administración con autenticación simple para aprobar/rechazar locales (PBI-05); persistencia en base de datos PostgreSQL/Supabase con tablas maestras y auditoría (verificar_locales); suite de regresión del Incremento 1. | Permite cerrar el ciclo completo de valor del producto, pasando de un catálogo estático a uno dinámico y colaborativo, garantizando mediante moderación que solo se muestren locales válidos y protegiendo el rendimiento del Incremento 1. |
| Posterga | Notificaciones push al locatario sobre el estado de su postulación, comentarios o reseñas de estudiantes sobre el local, edición avanzada de perfiles por parte del propio comerciante, subida de documentos PDF/imágenes de respaldo. | Son funcionalidades de conveniencia que aportan valor secundario, pero no son indispensables para comprobar la hipótesis de dinamismo y moderación comunitaria. Se postergan para no comprometer la estabilidad de la entrega. |
| Excluye | Pasarelas de pago, lectura de saldo de la tarjeta BAES, integración directa con servidores de Edenred/Junaeb. | Exceden las restricciones operativas, éticas y técnicas del proyecto. Integrar transacciones reales o consultar saldo de Edenred introduciría riesgos de seguridad y costos sin aportar a la localización de comercios. |

| ID | Tipo | Recorrido | Resultado observable |
| --- | --- | --- | --- |
| FL-01 | Normal (Postulación) | Usuario abre modal "Registrar local", completa datos válidos (nombre, categoría, horario, dirección, productos, check BAES) y presiona Enviar. | La solicitud se guarda en Supabase con estado = 'pendiente', el formulario se limpia y se muestra mensaje de agradecimiento. El local no aparece en el mapa público aún. |
| FL-02 | Normal (Moderación) | Administrador ingresa a /admin, inicia sesión con credenciales, visualiza la lista de solicitudes pendientes y pulsa "Aprobar". | El estado del local cambia a 'verificado', se actualiza 'ultima_verificacion', se inserta el registro histórico en 'verificar_locales' y se refleja en el mapa. |
| FL-03 | Normal (Visualización) | Estudiante abre JunaMap desde su celular. | El catálogo carga desde la vista SQL en Supabase, mostrando el nuevo local verificado con su pin y disponible para el filtro por producto. |
| FL-04 | Alternativo / Borde | Usuario intenta enviar formulario con dirección vacía o desmarcando la aceptación de Junaeb. | El formulario bloquea el envío en el cliente, mostrando los campos en rojo sin disparar peticiones de red hacia Supabase. |
| FL-05 | Error / Fallback | Falla de conexión con Supabase (red caída o servidor inaccesible). | El mapa muestra un aviso controlado: "No se pudo conectar con el catálogo en vivo, mostrando datos locales" y renderiza un fallback básico sin dejar la pantalla en blanco. |

7. Refinamiento del Product Backlog
Actualizar el backlog según valor, aprendizaje, riesgo, dependencias, capacidad y defectos detectados en la segunda defensa. Un cambio justificado demuestra aprendizaje.
| Orden | ID | Resultado del ítem | Justificación | Tamaño |
| --- | --- | --- | --- | --- |
| 1 (Alta) | PBI-06 | Servicio de lectura de locales desde Supabase mediante vista rápida (vista_locales_mapa) con manejo de errores y fallback. | Dependencia crítica: el mapa debe consumir datos vivos antes de poder probar el impacto de las postulaciones. | 3 puntos |
| 2 (Alta) | PBI-04 | Formulario público de postulación de locales con persistencia en Supabase (estado = 'pendiente'). | Permite la entrada de nuevos comercios comunitarios mitigando el esfuerzo de carga manual del equipo. | 5 puntos |
| 3 (Alta) | PBI-05 | Panel de administración con autenticación para cambiar estado de local a "verificado" o "rechazado", con ajuste manual de coordenadas exactas y auditoría en verificar_locales. | Regla de negocio RN-01: ningún local puede ser visible al estudiante sin haber sido aprobado por un moderador, permitiendo corregir la posición geográfica antes de publicar. | 5 puntos |
| 4 (Media) | PBI-07 | Suite de pruebas de regresión automatizadas (Vitest) para calcDist y visibleLocales. | Protege la estabilidad del Incremento 1 (evita que el cambio de formato de datos relacionales rompa filtros y distancias). | 3 puntos |
| - | PBI-08 | Sistema de calificaciones y comentarios de estudiantes. | Postergado para futuros hitos; no aporta al flujo central de localización y verificación. | 5 puntos |

8. Criterios de aceptación actualizados
Incluir recorridos normales, alternativos, de error y bordes prioritarios. Un tercero debe poder ejecutar cada criterio y decidir objetivamente si pasa o falla.
| ID | Tipo | Dado | Cuando | Entonces |
| --- | --- | --- | --- | --- |
| AC-08 | Normal | Un usuario en el formulario de postulación con todos los campos obligatorios completos y checkbox BAES marcado. | Presiona el botón "Enviar postulación". | Se inserta el registro en Supabase con estado = 'pendiente' y la interfaz muestra confirmación sin arrojar errores. |
| AC-09 | Normal | Un administrador autenticado en la vista de moderación. | Revisa la postulación, ajusta o confirma las coordenadas geográficas (latitud/longitud) y hace clic en "Aprobar". | El registro actualiza su estado a 'verificado', guarda las coordenadas exactas corregidas, registra 'ultima_verificacion' y una entrada en 'verificar_locales', quedando visible en el mapa. |
| AC-10 | Normal | El mapa público de JunaMap conectado al backend. | Realiza la consulta inicial a la vista de comercios. | Solo se obtienen y renderizan en Leaflet los locales cuya columna estado sea estrictamente 'verificado' y activo sea true. |
| AC-11 | Alternativo | Una persona no autenticada intenta acceder a la funcionalidad de moderación. | Abre el modal de administración. | Se exige clave de acceso ('admin123') antes de exponer la lista de locales pendientes. |
| AC-12 | Error / Borde | Un usuario intenta enviar el formulario con formato de correo inválido o coordenadas fuera del radio de Talca. | Pulsa el botón de envío. | Los campos se resaltan con error nativo o validación de rango y se aborta el envío antes de consultar el backend (RSK-14). |
| AC-13 | Regresión (RNF-01) | Un estudiante bajo red móvil 4G simulada abre la aplicación conectada a Supabase. | Se carga la vista interactiva. | El tiempo hasta que los pines están disponibles y clicables (TTI) es menor a 3.0 segundos gracias a la vista SQL pre-agregada. |

9. Definition of Done y criterio de estabilización
Definir cuándo un ítem puede declararse realmente terminado. Para este entregable, “funciona” no basta: debe estar integrado, probado, revisado, reproducible y respaldado por evidencia.
| Dimensión | Condición de Done | Evidencia requerida | Estado |
| --- | --- | --- | --- |
| Valor | Un local postulado y aprobado es localizable por un estudiante buscando su categoría o producto. | Video corto o secuencia de capturas: envío → aprobación en admin → búsqueda exitosa en mapa. | Cumplido |
| Funcionalidad | Cumplimiento del 100% de los criterios AC-08 al AC-13 sin excepciones de consola. | Checklist de ejecución de criterios de aceptación comprobada en vivo. | Cumplido |
| Regresión | Las funciones de cálculo Haversine y filtrado por comida del Incremento 1 no sufren alteraciones. | Ejecución exitosa de la suite de pruebas unitarias (npm test con 4/4 tests en verde). | Cumplido |
| Calidad / seguridad | RLS activo en PostgreSQL; carga móvil < 3.0 s; cero envío de GPS a la base de datos. | Capturas de políticas RLS en Supabase y reporte Lighthouse móvil actualizado. | Cumplido |
| Revisión / CI | Todo cambio pasa por rama propia (feat/incremento-2-supabase) y PR revisado antes de fusionar. | Enlaces a PRs y commits trazables en GitHub. | Cumplido |
| Reproducibilidad | Cualquier integrante puede levantar el entorno clonando el repo y agregando su archivo .env. | Archivo .env.example en la raíz y scripts SQL documentados. | Cumplido |

10. Plan de regresión
Seleccionar comportamientos del Incremento 1 y del nuevo incremento que podrían romperse entre sí. La regresión debe priorizar riesgo, ser repetible y producir evidencia localizable.
| Comportamiento a proteger | Riesgo de regresión | Prueba / escenario | Evidencia |
| --- | --- | --- | --- |
| Cálculo de distancias (calcDist) | Que al migrar desde locales.json hacia la base de datos (Supabase / PostgreSQL), los tipos de datos de latitud/longitud provoquen valores NaN en la fórmula de Haversine. | Prueba unitaria pasando coordenadas reales de Talca y verificando que el resultado sea numérico y con margen de error < 0.5%. | Test REG-01 en Vitest (src/__tests__/regression.test.js) en verde. |
| Filtrado por producto (visibleLocales) | Que la relación N:M entre locales y productos desde Supabase no se transforme correctamente al array esperado por el frontend. | Prueba de filtrado buscando "Completos" sobre la vista SQL normalizada. | Test REG-02 en Vitest y captura de UI filtrando correctamente. |
| Interacción táctil del BottomSheet | Que la asincronía al traer datos de la BD bloquee el render inicial o el gesto de snapping. | Prueba manual en emulador móvil arrastrando el panel a los 3 estados (62px, 50%, 80%). | Registro visual de interacción fluida a 60 fps sin saltos. |
| Modo sin GPS (Fallback neutral) | Que el retardo de la red haga fallar el centrado neutral por defecto en Talca. | Denegar permisos de geolocalización y validar anclaje automático en Talca Centro. | Captura de pantalla con mapa centrado y consola sin errores. |

11. Integración continua y revisión por pares
Definir qué controles se ejecutarán antes de integrar: build, pruebas, regresión, análisis y revisión humana. Un pipeline rojo representa trabajo pendiente.
| Control | Cuándo se ejecuta | Condición esperada | Evidencia |
| --- | --- | --- | --- |
| Build | En cada commit y Pull Request hacia main. | Comando npm run build finaliza con código de salida 0 (sin advertencias bloqueantes). | Log de compilación exitoso en terminal / Vercel. |
| Pruebas automáticas | Previo a cada merge. | Ejecución de suite Vitest con 100% de tests pasando (npm test). | Salida de consola de vitest run adjunta en el PR. |
| Regresión prioritaria | Al integrar cambios entre frontend y Supabase. | Verificación manual de los criterios AC-01 a AC-07 del Incremento 1. | Checklist de verificación adjunta en comentarios del PR. |
| Análisis / formato | Previo a commit. | Ejecución de npm run lint (ESLint) sin errores de sintaxis ni variables sin usar. | Salida de linter limpia. |
| Revisión por pares | Obligatoria en todo Pull Request. | Al menos 1 aprobación explícita de un compañero diferente al autor. | Aprobación visible en interfaz de GitHub PR. |

12. Gestión de defectos
Registrar defectos de forma reproducible: condición inicial, pasos, resultado esperado, resultado observado, severidad y evidencia. El cierre requiere corrección y prueba.
| ID | Severidad / prioridad | Reproducción | Acción / estado |
| --- | --- | --- | --- |
| DEF-01 | Media / Alta | Al conectar Supabase, los nombres de campos en la consulta (latitud vs lat) dejaron los marcadores en coordenadas (undefined, undefined). | Corregido: Se creó la vista SQL vista_locales_mapa que normaliza los nombres a lat/lng y tipos flotantes. |
| DEF-02 | Baja / Media | El formulario de postulación permitía ingresar espacios en blanco como nombre del local. | Corregido: Se incorporó validación trim() y control nativo de longitud mínima (minLength={3}). |
| DEF-03 | Alta / Crítica | Si la API de Supabase devolvía un local sin categoría asociada, el componente del mapa fallaba al leer el color del pin. | Corregido: Se asignó una categoría por defecto ("Almuerzo") y color de respaldo seguro en pinIcons.js y COALESCE en SQL. |

13. Escenarios de atributos de calidad
Seleccionar solo atributos relevantes para el incremento. Cada escenario debe declarar condición, respuesta esperada, medida y método reproducible.
| ID | Atributo | Condición | Medida / umbral | Método |
| --- | --- | --- | --- | --- |
| QA-06 | Rendimiento en lectura (RNF-01) | Estudiante accede a JunaMap conectado a Supabase bajo red 4G simulada (1.6 Mbps, 150 ms RTT). | TTI < 3.0 s y tiempo de respuesta de la query de locales < 250 ms. | Auditoría con panel Performance y pestaña Network de Chrome DevTools sobre vista_locales_mapa. |
| QA-07 | Integridad de Moderación (RN-01) | Usuario anónimo realiza peticiones directas a la API de Supabase intentando consultar locales pendientes. | 0 registros devueltos en la vista pública; solo se exponen registros con estado = 'verificado'. | Intento de consulta directa a la vista de mapa (esperado: solo locales aprobados). |
| QA-08 | Seguridad / Inyección | Atacante envía caracteres maliciosos o scripts (<script>alert(1)</script>) en el campo descripción de la postulación. | La entrada se sanitiza y se escapa como texto plano sin ejecutarse en el DOM. | Prueba manual inyectando payloads en el formulario y verificando renderizado seguro en React. |

14. Seguridad y privacidad durante la estabilización
Verificar entradas, autorización o permisos aplicables, minimización de datos y comportamiento seguro ante fallos. Los controles deben conectarse con riesgos concretos.
| Control | Riesgo que reduce | Comprobación | Evidencia |
| --- | --- | --- | --- |
| Validación de entrada | Inyección de código (XSS) y datos corruptos en el catálogo. | Validadores de tipo y formato en cliente y restricciones CHECK / tipos en base de datos. | Captura de rechazo ante entradas maliciosas o vacías. |
| Autorización / RLS | Modificación no autorizada del catálogo por usuarios anónimos. | Políticas Row Level Security en Supabase: lectura pública restringida a verificados; inserción protegida con verificado = false; moderación controlada por rol. | Script SQL con políticas CREATE POLICY aplicadas en Supabase. |
| Minimización de datos | Filtración de datos personales o hábitos de navegación de estudiantes. | Las coordenadas GPS del usuario jamás se envían al backend ni se guardan en BD; solo residen en la memoria RAM del navegador. | Captura de pestaña Network demostrando que la petición a Supabase no contiene parámetros de lat/lng de usuario. |
| Fallo seguro | Caída total de la interfaz ante cortes de conexión con el backend. | Manejo con bloques try/catch en localService.js con fallback automático a locales.json. | Prueba desactivando la red en DevTools tras cargar la web comprobando que el mapa no queda en blanco. |
| Secretos / configuración | Exposición de credenciales de base de datos en código fuente público. | Claves anónimas y URLs confinadas a .env y .env.example limpio en el repositorio. | Archivo .gitignore verificado y .env.example sin credenciales reales. |

15. Comprobación de impacto arquitectónico
No cambiar arquitectura por calendario. Identificar si existe un driver nuevo o modificado —flujo, atributo, restricción o riesgo— y qué consecuencia técnica produce.
| ID | Tipo de driver | ¿Cambió? | Evidencia | Consecuencia | Acción |
| --- | --- | --- | --- | --- | --- |
| DA-03 | Calidad / Persistencia | Sí | Transición programada según ADR-01 de archivo estático locales.json a base de datos externa (Supabase). | Introduce latencia de red en la carga inicial y asincronía en el estado de React. | Implementar vista SQL indexada (vista_locales_mapa) y capa desacoplada localService.js con fallback a JSON. |
| DA-05 | Seguridad / Moderación | Sí | Necesidad de restringir la aprobación de locales exclusivamente a administradores (PBI-05). | Se requiere un mecanismo de autenticación para separar usuarios anónimos de moderadores. | Habilitar modal de administración protegido con clave para moderar y registrar auditoría en verificar_locales. |
| DA-02 | Privacidad | No | Se mantiene la regla estricta de no almacenar coordenadas del usuario. | Las coordenadas GPS siguen viviendo únicamente en memoria RAM cliente. | Mantener intacta la lógica Haversine en el cliente. |
| DA-01 | Costo Operativo | No | Se mantiene el uso de OpenStreetMap y Leaflet. | Costo cero en mapas. | Mantener configuración de teselas de OSM. |

16. Registro de decisión arquitectónica, si corresponde
Registrar un ADR solo cuando exista una decisión arquitectónica relevante con alternativas reales, consecuencias y condición de revisión. Si no hay driver nuevo, puede indicarse “No aplica”.
| Campo | Contenido |
| --- | --- |
| Título / estado | ADR-02: Adopción de Supabase (PostgreSQL) con Esquema Normalizado, Vista Agregada y Políticas RLS para el Incremento 2 (Aprobado). |
| Contexto / driver | En el Incremento 1 se utilizó un catálogo estático (locales.json) para asegurar estabilidad en la defensa. Para el Incremento 2, los requisitos de postulación de locatarios (PBI-04) y panel de moderación (PBI-05) exigen persistencia dinámica sin violar la meta de rendimiento móvil (< 3 s, RNF-01). |
| Alternativas | 1. Consultas directas con JOINs múltiples en cada petición frontend: Normaliza datos pero aumenta la latencia a más de 500 ms en redes móviles.<br>2. Vista SQL pre-agregada (vista_locales_mapa) sobre tablas normalizadas: Mantiene el modelo relacional canónico (locales, categorias, productos, verificar_locales) y entrega al mapa una respuesta plana indexada en menos de 200 ms sin costo operativo. |
| Decisión | Se adopta Supabase con modelo normalizado (categorias, productos, locales_productos, usuarios, verificar_locales) y se sirve al mapa mediante vista_locales_mapa consumida por localService.js. |
| Consecuencias | Positivas: Máxima velocidad en móviles (< 3s), integridad referencial en BD, registro histórico de moderaciones y fallback local.<br>Negativas: Requiere mantener sincronizada la vista SQL ante cambios de columnas en la tabla locales. |
| Condición de revisión | Revisar si el número de comercios supera los 5,000 registros o si se requiere edición masiva en tiempo real. |

17. Spike técnico, si corresponde
Usar un spike cuando la incertidumbre impida decidir o estimar. Limitar pregunta, tiempo, escenarios y evidencia; cerrar con una recomendación que cambie trabajo posterior.
| Campo | Contenido |
| --- | --- |
| Pregunta | ¿Cuál es la latencia de respuesta al consultar locales mediante JOINs múltiples frente a una vista SQL plana indexada (vista_locales_mapa) en Supabase bajo conexión móvil 4G? |
| Límite | Time-box de 4 horas de experimentación técnica al inicio de la Semana 14. |
| Escenarios / alternativas | Alternativa A: Consulta relacional con JOINs hacia categorias y locales_productos.<br>Alternativa B: Consulta directa a vista_locales_mapa con arrays agregados. |
| Evidencia | Medición en DevTools (Fast 4G): Alternativa A promedió 580 ms de latencia; Alternativa B promedió 140 ms con tasa de refresco a 60 fps. |
| Resultado | La Alternativa B reduce un 75% el tiempo de respuesta y cumple holgadamente el presupuesto de rendimiento móvil. |
| Decisión que cambia | Se implementa vista_locales_mapa en Supabase como interfaz de lectura para el mapa público de JunaMap. |

18. Riesgos prioritarios
Asociar cada riesgo con una señal, respuesta, responsable y fecha de revisión. Incluir riesgos de producto, calidad, seguridad, integridad, equipo y calendario.
| ID | Tipo | Riesgo | Nivel | Respuesta / señal | Responsable |
| --- | --- | --- | --- | --- | --- |
| RSK-11 | Calidad / Rendimiento | Que la latencia de consulta a Supabase haga que el mapa supere los 3 segundos de carga inicial (RNF-01). | Alto | Implementar vista SQL pre-agregada (vista_locales_mapa) y fallback automático a locales.json ante demoras. | Diego López |
| RSK-12 | Seguridad | Que un usuario no autorizado apruebe locales manipulando las llamadas a la API. | Crítico | Restringir el panel con clave de moderación y registrar cada cambio de estado en la tabla de auditoría verificar_locales. | Luis Salas |
| RSK-13 | Regresión | Que la transición de locales.json al modelo relacional rompa los filtros de comidas específicas. | Medio | Implementar pruebas automatizadas de regresión en Vitest (regression.test.js) con 100% de éxito antes del merge. | Krishna Uribe |
| RSK-14 | Integridad de datos | Ingreso de coordenadas erróneas o fuera de Talca por parte de usuarios en el formulario público. | Medio | Validación de rango geográfico en localService.js (solo aceptar latitudes entre -35.48 y -35.38 y longitudes entre -71.72 y -71.58). | Miguel Espinoza |

19. Plan de estabilización de la Semana 14
Planificar resultados integrados y evidencia, no trabajo por capas. La Semana 14 debe terminar con una versión candidata verificable para la demostración y defensa.
| Momento | Ítems | Resultado esperado | Evidencia | Coordina | Revisa |
| --- | --- | --- | --- | --- | --- |
| Inicio Semana 14 | PBI-06, PBI-04 (Refinamiento y bordes) | Consolidar conexión a Supabase mediante localService.js y vista_locales_mapa, formulario público con validación geográfica en Talca (RSK-14) y fallback ante fallos de red (FL-05). | PR aprobado en GitHub y prueba de rechazo de coordenadas fuera de rango. | Luis Salas | Diego López |
| Mitad Semana 14 | PBI-05, PBI-07 (Moderación y Auditoría) | Panel de administración /admin con clave aprobando locales en vivo, registro en verificar_locales y suite Vitest (calcDist, visibleLocales) ejecutándose en verde. | Reporte de consola npm test en verde y registros visibles en verificar_locales en Supabase. | Krishna Uribe | Miguel Espinoza |
| Cierre Semana 14 | Regresión completa y code freeze | Versión candidata estabilizada (v1.0.0-rc1) desplegada en Vercel, con métricas móviles < 3.0 s validadas y ensayo de defensa cronometrado. | URL pública en Vercel, informe Lighthouse actualizado y checklist de regresión firmado. | Miguel Espinoza | Todo el equipo |

20. Revisión cruzada
Otro equipo debe intentar recorrer la trazabilidad, romper el flujo, cuestionar la calidad y detectar una decisión, borde, regresión o riesgo ausente.
| ID | Prueba aplicada | Observación | Artefacto afectado | Acción |
| --- | --- | --- | --- | --- |
| REV-01 | Trazabilidad inversa desde criterios AC-08–AC-13 hacia el backlog. | El criterio AC-11 (protección de ruta /admin) no tenía un PBI exclusivo asignado, quedando implícito en PBI-05. | Secciones 7 y 8 (PBI-05 y AC-11). | Explicitar el panel protegido con clave de administración y registro en tabla verificar_locales dentro de PBI-05. |
| REV-02 | Intento de ruptura de flujo en postulación pública (FL-01). | Si un usuario ingresa coordenadas fuera de Talca manualmente, el mapa podría centrarse fuera del área de cobertura. | Sección 12 (DEF-02) y Sección 18 (RSK-14). | Incorporar validación estricta de rango geográfico (latitud/longitud de Talca) antes de permitir el envío. |
| REV-03 | Auditoría de privacidad (DA-02) frente a la nueva conexión a Supabase. | Riesgo de enviar por error las coordenadas del usuario como parámetro en la consulta de locales cercanos. | Sección 14 (Minimización de datos) y localService.js. | Restringir la consulta SQL a SELECT general de locales verificados y mantener el cálculo Haversine 100% en cliente. |
| REV-04 | Verificación de reproducibilidad de la versión candidata. | Al agregar Supabase, clonar el repositorio sin el archivo de variables de entorno provoca que el cliente falle al inicializar. | Sección 9 (DoD) y README.md. | Agregar archivo .env.example al repositorio y documentar el paso de configuración de credenciales en el README.md. |

21. Bitácora individual
Cada integrante registra contribuciones significativas, revisiones, decisiones, pruebas y aprendizaje. No se evalúa cantidad bruta de commits ni líneas de código.
| Integrante | Contribución / revisión | Efecto | Evidencia | Aprendizaje |
| --- | --- | --- | --- | --- |
| Luis Salas | Diseño del ADR-02 hacia Supabase, implementación de localService.js con adaptador de coordenadas (DEF-01) y vista_locales_mapa. | Permitió la persistencia del catálogo en PostgreSQL sin comprometer la privacidad del GPS del estudiante ni la velocidad del mapa. | PR en GitHub de localService.js, vista SQL en Supabase y Secciones 14-16 del informe. | Comprender que migrar de datos estáticos a una base de datos externa exige blindar los permisos desde el backend (RLS) y controlar la asincronía en el frontend. |
| Miguel Espinoza | Coordinación de la versión candidata, auditorías de rendimiento con Chrome DevTools/Lighthouse y cierre del informe técnico. | Aseguró que la transición a Supabase mantuviera la carga móvil < 3s y dejó la versión candidata lista para defensa en Vercel. | Reporte Lighthouse móvil, archivo .env.example, PRs aprobados y Secciones 4, 15 y 19 completadas. | El valor de definir presupuestos de rendimiento antes de agregar servicios externos como bases de datos. |
| Diego López | Implementación de validaciones anti-espacios en el formulario, panel de administración con clave y tabla de auditoría verificar_locales. | Evitó la inserción de locales corruptos en la base de datos y permitió auditar cada aprobación de comercio. | Commits en GitHub del panel admin, registros en verificar_locales y sección 6 del informe. | Aprender que una interfaz de administración debe ser intuitiva y contar con trazabilidad histórica de moderación. |
| Krishna Uribe | Modelado relacional en Supabase (locales, categorias, productos, usuarios), especificación de criterios Gherkin y suite Vitest. | Garantizó la integridad referencial en la base de datos y automatizó las pruebas de regresión del Incremento 1. | Esquema ER relacional en Supabase, archivo regression.test.js y Secciones 7-8 del informe. | Comprender que una "Definition of Done" profesional exige pruebas de regresión y documentación reproducible antes de cerrar una historia de usuario. |

Anexo A. Comprobación final para la candidata
| Estado | Comprobación | Ubicación o evidencia |
| --- | --- | --- |
| ☑ | Objetivo, hipótesis y alcance del Incremento 2 son coherentes y defendibles. | Secciones 4, 5 y 6 (H-03, H-04 y FL-01 a FL-05). |
| ☑ | La retroalimentación de la segunda defensa produjo decisiones y acciones trazables. | Sección 2 (Observaciones RET-06 a RET-09). |
| ☑ | El flujo normal y los bordes prioritarios tienen criterios de aceptación verificables. | Sección 8 (AC-08 a AC-13 en formato Gherkin). |
| ☑ | La Definition of Done incluye integración, revisión, regresión, calidad y reproducibilidad. | Sección 9 (Matriz DoD aplicada a los PBIs del Incremento 2). |
| ☑ | La regresión protege comportamientos críticos del Incremento 1. | Sección 10 y suite Vitest (src/__tests__/regression.test.js). |
| ☑ | Los atributos de calidad tienen condición, medida y método reproducible. | Sección 13 (Métricas QA-06 a QA-08 validadas en DevTools). |
| ☑ | Seguridad y privacidad tienen controles asociados a riesgos reales. | Sección 14 (Controles RLS en Supabase, sanitización de inputs y .env). |
| ☑ | Los cambios arquitectónicos están justificados por drivers; ADR/spike se usan solo si corresponde. | Secciones 15, 16 y 17 (DA-03, ADR-02 y Spike de latencia sobre vista SQL). |
| ☑ | La Semana 14 termina con una candidata ejecutable, reproducible y con pipeline verde. | Despliegue en Vercel, npm run build exitoso y 4/4 tests en verde. |
| ☑ | Cada integrante puede explicar contribuciones, decisiones, pruebas, riesgos y límites. | Sección 21 (Evidencias y justificaciones individuales del equipo). |

Anexo B. Fuentes de referencia
ISO/IEC/IEEE 29148. Ingeniería de requisitos y características de requisitos verificables y trazables.
NIST Secure Software Development Framework (SSDF). Prácticas de desarrollo seguro integradas al ciclo de vida.
SWEBOK Guide V4.0a. Construcción, pruebas, mantenimiento, calidad y prácticas de ingeniería de software.
Scrum Guide 2020. Incremento, Product Backlog, inspección y adaptación.
