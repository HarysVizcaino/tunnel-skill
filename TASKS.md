# Tunnel — tareas para la versión 1.0

Estado: candidata 1.0.0-rc.1 implementada. 14 tareas cerradas localmente; 8 conservan criterios externos o de publicación pendientes. Véase el estado individual y el informe de validación.
Creado: 2026-09-24.

Objetivo: publicar una Agent Skill instalable que permita compartir aplicaciones locales mediante HTTPS temporal, con comportamiento probado, documentación y mantenimiento básico.

Fuentes: [investigación](RESEARCH.md) y [PRD original](docs/PRD-original.md) y [contrato 1.0](docs/PRD.md).

## Cómo usar este backlog

- Marcar una tarea como completada únicamente cuando cumpla sus criterios y tenga evidencia enlazada.
- Registrar bajo cada tarea los archivos, pruebas o decisiones que la cierran.
- P0: base funcional o corrección crítica. P1: requisito de calidad y distribución. Ambas prioridades son necesarias para publicar 1.0.
- Las dependencias indican qué debe estar resuelto antes de cerrar la tarea; se puede preparar trabajo independiente antes.
- Validación proporcional: tests para comportamiento, revisión para documentación y pruebas reales para integración. No añadir tests que solo reproduzcan la implementación.

## Alcance de trabajo propuesto

Estas decisiones son la base de TUN-001; cualquier cambio debe registrarse allí antes de afectar la implementación.

- Nombre instalable: `tunnel`; ubicación: `skills/tunnel/`.
- Núcleo JavaScript ESM ejecutado con Node, con dependencias mínimas; versión mínima fijada en TUN-003.
- macOS ARM64/x64 y Linux ARM64/x64 como plataformas objetivo.
- Next.js y Vite con detección e inicio automático; otros servicios HTTP locales mediante `--port`.
- Cloudflare Quick Tunnels como único proveedor de 1.0.
- Un túnel por proyecto; repetir la misma solicitud reutiliza uno saludable.
- `--stop` detiene el túnel y deja la aplicación ejecutándose, informándolo al usuario.
- Invocación explícita o petición clara en lenguaje natural; terminar de construir una app no crea un túnel por iniciativa del agente.
- Monorepos: seleccionar una aplicación inequívoca; solicitar selección cuando existan varias. Sin arranque automático de todos los servicios.
- Dependencias de aplicación ausentes: error accionable; no instalar paquetes, ejecutar builds ni modificar scripts automáticamente.
- Procesos persistentes al finalizar el turno del agente; comportamiento al cerrar cliente, terminal o suspender el equipo definido con evidencia en TUN-002.
- Windows, otros proveedores, URLs permanentes y presets de webhooks quedan fuera de 1.0.

## Orden de ejecución

| Etapa | Tareas | Resultado |
|---|---|---|
| 1. Contratos y viabilidad | TUN-001–003 | Alcance concreto, contrato y persistencia comprobable |
| 2. Infraestructura del núcleo | TUN-004–007 | Interfaz, fixtures, runtime y estado |
| 3. Aplicación y túnel | TUN-008–012 | Flujo completo con destino y URL verificados |
| 4. Experiencia y skill | TUN-013–016 | Comandos, diagnóstico e instrucciones utilizables |
| 5. Calidad e instalación | TUN-017–020 | Evidencia de comportamiento y compatibilidad |
| 6. Distribución | TUN-021–022 | Documentación y release verificadas |

## Etapa 1 — contratos y viabilidad

### TUN-001 — Consolidar el PRD de la versión pública

- [x] **P0 · Dependencias: ninguna.**
- **Evidencia / pendiente:** Cerrada: [PRD 1.0](docs/PRD.md), copia del original y trazabilidad de requisitos.
- Entregable: `docs/PRD.md` con alcance 1.0 y decisiones cerradas.
- Aceptación: incorporar el PRD original y resolver las propuestas anteriores; distinguir soporte automático y `--port`, HTTP local y HTTPS público, y límites del proveedor.
- Aceptación: definir semántica de cambio de puerto con túnel existente, selección en monorepos, propiedad de aplicaciones y comportamiento de `--stop`.
- Aceptación: documentar autorización por solicitud, exposición del servicio completo y ausencia de pruebas automáticas de webhooks con efectos secundarios.
- Aceptación: vincular requisitos con los IDs de este backlog y registrar las incertidumbres que resolverá TUN-002.

### TUN-002 — Comprobar persistencia y restricciones de los agentes

- [ ] **P0 · Dependencias: TUN-001.**
- **Evidencia / pendiente:** Parcial: [prueba entre llamadas y decisión de procesos](docs/decisions/process-lifecycle.md). Pendiente fin de turno, cierre de cliente y sesión real de Claude Code. La decisión técnica está tomada; esos escenarios siguen siendo gates de release.
- Entregable: prueba técnica mínima y `docs/decisions/process-lifecycle.md`.
- Aceptación: ejecutar un servidor y un proceso inocuos en Codex y Claude Code; comprobar supervivencia al terminar el comando y el turno, y registrar comportamiento al cerrar cliente/terminal.
- Aceptación: identificar restricciones de red, escritura fuera del proyecto y ejecución de procesos; no asumir que `nohup`, PID o instalación global resuelven estas restricciones.
- Aceptación: elegir mecanismo de lanzamiento y parada compatible, con limpieza de los procesos de prueba; ajustar la promesa del PRD a la evidencia antes de construir el gestor.

### TUN-003 — Definir arquitectura y contrato de ejecución

- [x] **P0 · Dependencias: TUN-001, TUN-002.**
- **Evidencia / pendiente:** Cerrada: [arquitectura](docs/architecture.md) y [contrato CLI](docs/cli-contract.md). La decisión de TUN-002 está incorporada con límites explícitos, sin prometer supervivencia no probada.
- Entregables: `docs/architecture.md` y `docs/cli-contract.md`.
- Aceptación: definir argumentos `--port`, `--webhook`, `--status`, `--stop`, `--verbose`, `--help` y selección explícita del proyecto; especificar combinaciones válidas.
- Aceptación: definir esquema JSON versionado, códigos de salida, errores, límites de espera y estados de aplicación/túnel/verificación.
- Aceptación: fijar versión mínima de Node, herramientas del sistema requeridas y separación entre ruta instalada de la skill y proyecto objetivo.
- Aceptación: definir contrato mínimo del proveedor y datos de identidad de procesos; no implementar proveedores futuros.

## Etapa 2 — infraestructura del núcleo

### TUN-004 — Crear la estructura ejecutable y el parser

- [x] **P0 · Dependencias: TUN-003.**
- **Evidencia / pendiente:** Cerrada: [CLI](skills/tunnel/scripts/tunnel.mjs), parser y pruebas de argumentos/rutas.
- Entregables: `package.json`, `skills/tunnel/scripts/tunnel.mjs` y módulos internos.
- Aceptación: ejecución desde cualquier directorio, incluyendo rutas con espacios; argumentos validados y sin concatenar entradas del usuario en comandos de shell.
- Aceptación: `--help` no inicia procesos, descarga ni modifica estado; ninguna operación espera interacción por terminal.
- Aceptación: JSON limpio en stdout, diagnósticos en stderr y salida no cero consistente con el contrato cuando hay errores.

### TUN-005 — Preparar fixtures y pruebas del núcleo

- [x] **P0 · Dependencias: TUN-004.**
- **Evidencia / pendiente:** Cerrada: [tests del núcleo](tests/core.test.mjs) y fixtures aisladas.
- Entregables: `tests/`, servidores de prueba y proveedor simulado.
- Aceptación: fixtures para respuestas HTTP, arranque lento, fallo de proceso, salida de proveedor y conflictos de puertos.
- Aceptación: pruebas usan directorios temporales, puertos asignados de forma segura y procesos propios; limpian sus recursos incluso tras fallos.
- Aceptación: tests locales no necesitan Cloudflare ni alteran `~/.tunnel`; los casos funcionales se incorporan al implementar cada módulo.

### TUN-006 — Implementar aprovisionamiento del runtime

- [x] **P0 · Dependencias: TUN-004, TUN-005.**
- **Evidencia / pendiente:** Cerrada: [runtime](skills/tunnel/scripts/lib/runtime.mjs), manifiesto de cuatro artefactos, checksum real ARM64 y pruebas de corrupción/cancelación. Ejecución de otras arquitecturas sigue en TUN-018/020.
- Entregable: módulo de runtime y manifiesto de artefactos soportados.
- Aceptación: detectar OS/arquitectura, descargar versión fijada desde origen oficial y validar checksum esperado antes de ejecutar; no aceptar un checksum calculado solo a partir de la misma descarga.
- Aceptación: caché versionada, instalación atómica, bloqueo de descargas simultáneas y recuperación de descargas incompletas.
- Aceptación: sin `sudo`, cambios de PATH, binarios dentro del proyecto ni sobrescritura de instalaciones ajenas; plataforma no soportada produce error accionable.

### TUN-007 — Implementar estado y propiedad de procesos

- [x] **P0 · Dependencias: TUN-002, TUN-004, TUN-005.**
- **Evidencia / pendiente:** Cerrada: [estado](skills/tunnel/scripts/lib/state.mjs), supervisores autenticados y pruebas. Recuperación de bloqueos abandonados explícita, según decisión documentada.
- Entregable: módulos de estado, bloqueo e identidad de procesos.
- Aceptación: estado por ruta canónica de proyecto, permisos locales restrictivos, escritura atómica y exclusión entre operaciones concurrentes sobre ese proyecto.
- Aceptación: conservar identidad suficiente para rechazar un PID reutilizado; no usar nombre genérico o puerto como autorización para detener un proceso.
- Aceptación: manejar estado corrupto, obsoleto y bloqueos abandonados sin perder control de procesos vivos; reinicios no convierten archivos antiguos en túneles activos.

## Etapa 3 — aplicación y túnel

### TUN-008 — Detectar proyecto, gestor y comando de desarrollo

- [x] **P0 · Dependencias: TUN-004, TUN-005.**
- **Evidencia / pendiente:** Cerrada: [detección](skills/tunnel/scripts/lib/project.mjs), conflictos de gestores, monorepos y herencia del gestor del workspace probados.
- Entregable: detector de proyectos.
- Aceptación: identificar Next.js y Vite mediante metadatos, scripts y dependencias; usar `packageManager` y lockfiles con reglas documentadas ante conflictos.
- Aceptación: detectar gestor o dependencias ausentes; no instalar ni ejecutar scripts de preparación inesperados.
- Aceptación: monorepos y múltiples aplicaciones devuelven candidatos cuando la selección no es inequívoca; proyecto desconocido ofrece `--port`.

### TUN-009 — Encontrar y reutilizar el servidor correcto

- [x] **P0 · Dependencias: TUN-007, TUN-008.**
- **Evidencia / pendiente:** Cerrada: selección entre servidores de dos proyectos comprobada por contenido real del origen; [tests](tests/core.test.mjs).
- Entregable: descubrimiento de procesos y destinos HTTP.
- Aceptación: vincular listener y proyecto mediante evidencia de procesos/rutas; puertos habituales solo generan candidatos.
- Aceptación: con otro proyecto en 3000 y el actual en 3001, seleccionar el actual; con evidencia insuficiente devolver ambigüedad.
- Aceptación: validar puerto explícito y destino loopback, contemplar IPv4/IPv6 y evitar seleccionar puertos de inspección o servicios no HTTP automáticamente.

### TUN-010 — Iniciar y esperar la aplicación

- [x] **P0 · Dependencias: TUN-007, TUN-008, TUN-009.**
- **Evidencia / pendiente:** Cerrada: inicio y conservación de app probados; Vite/Next reales arrancaron en fixtures temporales.
- Entregable: gestor de arranque de aplicación.
- Aceptación: reutilizar primero; si hace falta iniciar, ejecutar únicamente el comando elegido en el proyecto y registrar propiedad y árbol de procesos según el contrato.
- Aceptación: detectar puerto efectivo mediante evidencia de arranque y listener; esperar disponibilidad con timeout, sin confundir proceso vivo con servidor listo.
- Aceptación: fallo de arranque incluye comando y diagnóstico acotado; cancelación limpia recursos de ese intento sin detener aplicaciones preexistentes.

### TUN-011 — Crear y supervisar el Quick Tunnel

- [x] **P0 · Dependencias: TUN-006, TUN-007, TUN-009.**
- **Evidencia / pendiente:** Cerrada: [supervisor de proveedor](skills/tunnel/scripts/worker.mjs). cloudflared oficial descargado/verificado y URLs generadas; conectividad pública permanece pendiente en TUN-020.
- Entregable: proveedor Cloudflare.
- Aceptación: iniciar contra el destino seleccionado, extraer únicamente una URL HTTPS válida del proveedor de los logs de esa ejecución y registrar identidad del proceso.
- Aceptación: tiempo máximo de arranque, detección de salida prematura y recuperación definida; URL antigua en un log no produce éxito.
- Aceptación: manejar configuración Cloudflare existente sin modificarla ni renombrarla; controlar actualizaciones del binario según el contrato de versiones.
- Aceptación: entorno de `cloudflared` limitado a lo necesario, sin copiar secretos de la aplicación; fallos de red devuelven diagnóstico utilizable.

### TUN-012 — Verificar conectividad y compatibilidad de la aplicación

- [ ] **P0 · Dependencias: TUN-010, TUN-011.**
- **Evidencia / pendiente:** Parcial: HMAC, errores HTTP, Host/Origin, upgrade WebSocket y recursos de Vite/Next probados localmente. Pendiente HMR en navegador y verificación pública real; [evidencia](docs/validation/release-candidate.md).
- Entregable: verificador local/público y ajustes documentados por framework.
- Aceptación: distinguir fallo local, proveedor, propagación, respuesta de aplicación y resultado inconcluso, con reintentos acotados.
- Aceptación: `401`, `404` o `500` no se clasifican solo por código; una página del proveedor o una redirección externa no prueban que se llegó al proyecto.
- Aceptación: comprobar página y recursos en Next.js/Vite, tratar restricciones de Host/Origin sin desactivar protecciones globales; registrar funcionamiento o límites de HMR.
- Aceptación: pruebas mediante fixture identificable demuestran que la URL llega al servidor correcto; no modificar la aplicación real para insertar una ruta de salud.

## Etapa 4 — experiencia y skill

### TUN-013 — Integrar creación, reutilización, estado y parada

- [x] **P0 · Dependencias: TUN-007, TUN-010, TUN-011, TUN-012.**
- **Evidencia / pendiente:** Cerrada: flujo completo con proveedor simulado, reutilización, concurrencia, parada y rollback; [tests](tests/core.test.mjs).
- Entregable: flujo completo del comando.
- Aceptación: dos invocaciones del mismo proyecto no duplican app ni túnel; proyectos distintos no sobrescriben estado.
- Aceptación: cambio de destino con túnel activo sigue TUN-001; no sustituirlo silenciosamente ni devolver un enlace al puerto anterior.
- Aceptación: `--status` comprueba estado real sin iniciar ni descargar; `--stop` valida identidad, detiene solo el túnel, es idempotente e informa si la app continúa.
- Aceptación: fallos parciales revierten únicamente recursos nuevos según la política documentada y conservan evidencia útil para recuperación.

### TUN-014 — Generar URLs de webhook

- [x] **P1 · Dependencias: TUN-013.**
- **Evidencia / pendiente:** Cerrada: normalización de rutas y generación sin eventos automáticos; pruebas de entradas ambiguas.
- Entregable: normalización de rutas y salida de webhook.
- Aceptación: rutas con/sin slash inicial generan la URL esperada; URLs absolutas, cambios de host, controles y entradas ambiguas se rechazan según contrato.
- Aceptación: preservar correctamente caracteres codificados y definir soporte de query/fragment; no realizar concatenaciones que cambien el destino.
- Aceptación: salida afirma que la URL fue generada y distingue verificación del túnel de validación funcional; no envía eventos POST y explica que se expone el servicio completo.

### TUN-015 — Implementar diagnóstico útil y acotado

- [x] **P1 · Dependencias: TUN-013.**
- **Evidencia / pendiente:** Cerrada: salida estructurada acotada, ausencia de logs crudos y [guía de diagnóstico](skills/tunnel/references/troubleshooting.md).
- Entregables: `--verbose`, política de logs y referencia de errores.
- Aceptación: errores muestran causa conocida, destino y siguiente acción concreta; el diagnóstico no inventa certeza cuando la verificación es inconclusa.
- Aceptación: no volcar variables de entorno, cabeceras sensibles ni logs completos de aplicaciones; definir redacción, permisos, rotación y límites de salida.
- Aceptación: diagnóstico disponible sin crear un túnel y mensajes consistentes entre modo normal y estructurado.

### TUN-016 — Escribir la skill portable

- [x] **P1 · Dependencias: TUN-003, TUN-013, TUN-014, TUN-015.**
- **Evidencia / pendiente:** Cerrada: [SKILL.md](skills/tunnel/SKILL.md), referencias y validador de skill aprobado. Instalación local real registrada en TUN-019.
- Entregables: `skills/tunnel/SKILL.md` y referencias necesarias.
- Aceptación: nombre/descripción válidos, requisitos declarados, ejemplos breves y ruta explícita al núcleo; recursos resueltos desde la instalación sin perder el proyecto objetivo.
- Aceptación: instrucciones diferencian consultar documentación, gestionar estado y solicitar exposición pública; no crean un túnel tras completar una tarea de código por iniciativa propia.
- Aceptación: invocaciones documentadas por cliente, sin depender de extensiones exclusivas de uno; sin permisos amplios ni confirmaciones adicionales cuando la solicitud ya autoriza la acción.
- Aceptación: validación del formato; archivo principal por debajo de las recomendaciones de tamaño y sin copiar el PRD ni esta investigación.

## Etapa 5 — calidad e instalación

### TUN-017 — Evaluar activación y ejecución del agente

- [ ] **P1 · Dependencias: TUN-005, TUN-016.**
- **Evidencia / pendiente:** Parcial: [20 escenarios y scorer](evals/README.md) implementados. Pendientes ejecuciones reales repetidas por agente/modelo y comparación de baseline; no se inventaron resultados.
- Entregables: `evals/`, consultas etiquetadas y reporte reproducible.
- Aceptación: alrededor de 20 consultas positivas/negativas en español e inglés, con invocaciones explícitas, peticiones naturales y casos cercanos fuera de alcance; separar ajuste y validación.
- Aceptación: repetir consultas, registrar cliente/modelo/versiones y distinguir lectura de SKILL.md de ejecución de acciones; publicar resultados y corregir fallos críticos.
- Aceptación: al menos tres recorridos completos comparados con una referencia: app activa, app detenida y gestión de túnel existente; contextos limpios y comprobaciones de procesos/destino.
- Aceptación: cero exposiciones públicas o paradas ajenas en los controles negativos observados; una explicación bonita no sustituye evidencia de ejecución. Usar simulación donde no sea necesaria integración real.

### TUN-018 — Automatizar CI y pruebas de regresión

- [ ] **P1 · Dependencias: TUN-005, TUN-013, TUN-014, TUN-016.**
- **Evidencia / pendiente:** Parcial: [CI](.github/workflows/checks.yml) implementada y checks locales aprobados. Pendiente ejecución hospedada Linux/macOS y arquitecturas restantes.
- Entregable: workflow de checks.
- Aceptación: comprobar sintaxis, tests del núcleo, validación de skill y contenido del paquete en cada cambio.
- Aceptación: cubrir selección de destino, concurrencia, PID reutilizado, descarga corrupta, errores HTTP, cancelación y limpieza.
- Aceptación: ejecutar en plataformas disponibles; cualquier arquitectura no probada en CI necesita evidencia manual antes de anunciar soporte. No abrir túneles públicos desde PRs no confiables.

### TUN-019 — Probar instalación real y agentes soportados

- [ ] **P1 · Dependencias: TUN-016, TUN-018.**
- **Evidencia / pendiente:** Parcial: Skills CLI 1.7.0 instaló en proyecto temporal para Codex y Claude Code; help/status y copia autocontenida comprobados. Pendiente uso conversacional en ambos clientes y cierre de host.
- Entregable: reporte de instalación y matriz de compatibilidad.
- Aceptación: probar descubrimiento e instalación de la skill desde el paquete candidato con Skills CLI; repetir desde la URL pública definitiva en TUN-022.
- Aceptación: todos los recursos necesarios están dentro del paquete instalado; funciona desde otro proyecto, una ruta con espacios y una ubicación distinta al checkout.
- Aceptación: Codex y Claude Code ejecutan creación, estado y parada según sus permisos; reproducir las comprobaciones de persistencia de TUN-002 con la implementación final.
- Aceptación: registrar plataforma, arquitectura y versiones exactas; instrucciones de desinstalación distinguen skill, runtime y procesos activos.

### TUN-020 — Validar integración real y preparar evidencia de aceptación

- [ ] **P1 · Dependencias: TUN-012, TUN-014, TUN-017, TUN-019.**
- **Evidencia / pendiente:** Parcial: [diagnóstico DNS](docs/validation/dns-diagnostic.md) documenta fallos con DNS del sistema/configurado. La demo real obtuvo `active` y HTTP 200 autenticado mediante la CLI con `--dns-server 1.1.1.1`, declarado en el resultado; 34 pruebas pasan. GET y webhook ficticio anteriores respondieron 200 con una IP explícita por petición. Faltan resolución normal, cliente externo y matriz de integración; la herramienta web externa no pudo abrir la demo.
- Entregable: `docs/validation/release-candidate.md`.
- Aceptación: en fixtures sin secretos, crear URLs reales de Next.js, Vite y `--port`; comprobarlas desde un cliente externo y detenerlas al finalizar.
- Aceptación: probar app ya activa, inicio automático, dos proyectos y reintento; verificar que no quedan túneles huérfanos.
- Aceptación: webhook de prueba con receptor controlado, sin servicios reales con efectos secundarios; registrar la diferencia entre generar URL y recibir un evento.
- Aceptación: registrar limitaciones del proveedor y frameworks, sin atribuir soporte no probado; resolver los fallos que contradigan el alcance antes de pasar a release.

## Etapa 6 — distribución

### TUN-021 — Preparar documentación y mantenimiento

- [ ] **P1 · Dependencias: TUN-015, TUN-016, TUN-019.**
- **Evidencia / pendiente:** Parcial: README, LICENSE, NOTICE, SECURITY, CONTRIBUTING y CHANGELOG listos. Falta habilitar/verificar el canal privado del repositorio definitivo y recorrido independiente del README.
- Entregables: README, LICENSE, avisos aplicables, SECURITY, CONTRIBUTING, CHANGELOG y guía de diagnóstico.
- Aceptación: una persona puede instalar, compartir, consultar estado y detener usando solo el README; requisitos, límites y duración visibles.
- Aceptación: documentar directorios creados, descarga/versiones del runtime, alcance público y recuperación/desinstalación; no prometer disponibilidad o URLs permanentes.
- Aceptación: decidir licencia del proyecto y revisar avisos de dependencias; establecer procedimiento de actualizaciones y reporte privado de problemas de seguridad.

### TUN-022 — Publicar candidata y versión 1.0

- [ ] **P1 · Dependencias: TUN-018, TUN-020, TUN-021.**
- **Evidencia / pendiente:** Parcial: [paquete reproducible y procedimiento](docs/RELEASE.md) preparados. Sin repositorio público, CI hospedada, tag, anuncio ni release estable; requiere cerrar gates y concretar publicación.
- Entregables: repositorio distribuible, candidata, release 1.0, notas y demo breve.
- Aceptación: cerrar hallazgos críticos, revisar contenido publicable y fijar versiones; preparar candidata reproducible antes de la publicación externa.
- Aceptación: ejecutar instalación desde GitHub en entorno limpio, comprobar recorrido del README y obtener revisión de alguien sin contexto del desarrollo.
- Aceptación: notas enlazan evidencia y limitaciones; el soporte anunciado coincide con la matriz probada y existe un procedimiento para revertir una release defectuosa.
- Aceptación: publicar y anunciar únicamente cuando exista autorización para esas acciones externas; crear este backlog no constituye por sí solo autorización de publicación.

## Criterio global de finalización

- [ ] Todas las tareas P0 y P1 cerradas con evidencia.
- [ ] Ningún defecto abierto que publique el servicio equivocado, detenga procesos ajenos, ejecute artefactos no verificados o anuncie éxito sin comprobación.
- [ ] Instalación limpia e integración real comprobadas en las combinaciones anunciadas.
- [ ] Evaluaciones del agente y tests del núcleo registrados por separado.
- [ ] Documentación suficiente para usar, diagnosticar y detener Tunnel sin ayuda del autor.
- [ ] Release versionada y limitaciones conocidas publicadas.

## Después de 1.0

Windows; detección de Python/Java/Go; proveedores alternativos; URLs permanentes; inspección de solicitudes; presets de webhooks; QR y portapapeles. No bloquear 1.0 por estas ampliaciones.

## Primer bloque a ejecutar

El núcleo y la skill están implementados. El siguiente bloque es resolver TUN-020 (DNS/conectividad pública), ejecutar evaluaciones TUN-017 y completar la matriz TUN-002/018/019. Después se podrá cerrar documentación externa y publicación TUN-021/022.
