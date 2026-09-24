# Tunnel 1.0 — contrato de producto

Estado: implementación candidata; la publicación estable depende de la matriz de validación. Este documento concreta y, donde difiere, reemplaza el [PRD original](PRD-original.md). Las decisiones provienen del [backlog](../TASKS.md) y la [investigación](../RESEARCH.md).

## Alcance

Tunnel ofrece una URL HTTPS pública temporal para un servicio HTTP loopback. Se distribuye como `skills/tunnel`, con instrucciones portables y un núcleo JavaScript ESM sin dependencias de producción. Node 22+, ps, lsof y tar son requisitos. Los artefactos soportados son macOS/Linux ARM64/x64; soporte objetivo no equivale a validación realizada.

La detección automática cubre Next.js y Vite con un script `dev` y dependencias instaladas en node_modules. Otros servicios funcionan con `--port`. No se instalan dependencias, no se ejecutan builds ni predev/postdev implícitamente. Proyectos Yarn PnP requieren arranque manual. La detección de aplicaciones examina el directorio y hasta dos niveles descendientes, omitiendo salidas, dependencias y directorios ocultos. Varias aplicaciones requieren selección mediante `--project`.

## Semántica

- La ruta canónica pasada en `--project` identifica el estado. Una misma ruta reutiliza un túnel saludable; dos rutas tienen estados separados.
- Cambiar el puerto mientras existe un túnel requiere `--stop` previo. Nunca sustituir el destino silenciosamente.
- `--port` selecciona un servicio ya iniciado y no reclama propiedad sobre él.
- El arranque automático solo usa un comando de desarrollo identificado. La propiedad se guarda mediante supervisores autenticados.
- `--stop` detiene proveedor y proxy; conserva la app. En un fallo de creación se intentan cerrar todos los recursos nuevos de ese intento.
- `--status` no inicia ni descarga; devuelve estado local y la última verificación por separado. `running-unverified` no acredita conectividad pública actual.
- `--webhook` normaliza una ruta, sin query, fragmento, host, navegación relativa ni caracteres de control. No crea endpoints ni envía POST. Se expone el servicio completo.
- Una solicitud de compartir públicamente o recibir webhooks autoriza la operación; consultar la documentación o construir una app no la autoriza. No hay una confirmación adicional rutinaria. Los permisos del host siguen aplicando.

## Verificación y ciclo de vida

Un proxy local reenvía al servicio y firma el reto de verificación únicamente al recibir una respuesta HTTP de la app. El control del supervisor usa otro puerto y otra capacidad. Cloudflare publica solo el proxy.

`verified`, `application-redirect` y `application-error` identifican una respuesta autenticada del origen. Un error HTTP de Cloudflare, un HTML parecido o una URL extraída del log no bastan. Las redirecciones se inspeccionan sin seguirlas. No se valida la funcionalidad completa de la app ni firmas de webhooks.

Límites: 60 s para iniciar app, 45 s para URL del proveedor, 45 s para verificación pública y 5 min para expirar supervisores no confirmados. Los procesos confirmados permanecen separados de la CLI. No hay daemon del sistema, reinicio automático ni garantía de supervivencia a cierre del agente, suspensión o reinicio: ver [decisión de procesos](decisions/process-lifecycle.md).

Cloudflare Quick Tunnels no garantiza disponibilidad, no proporciona URLs permanentes, limita concurrencia y no soporta SSE. Tunnel no modifica DNS ni configuración Cloudflare ajena. El runtime está fijado y se verifica antes de ejecutar.

## Trazabilidad

| Requisito | Tareas |
|---|---|
| Contrato, persistencia y arquitectura | TUN-001, TUN-002, TUN-003 |
| CLI y pruebas deterministas | TUN-004, TUN-005 |
| Runtime verificado y estado seguro | TUN-006, TUN-007 |
| Detección, reutilización e inicio de app | TUN-008, TUN-009, TUN-010 |
| Proveedor, proxy y verificación | TUN-011, TUN-012 |
| Comandos y diagnóstico | TUN-013, TUN-014, TUN-015 |
| Skill, evaluaciones y distribución | TUN-016 a TUN-022 |

Desviación deliberada: un bloqueo abandonado se identifica, pero se recupera explícitamente tras inspección. La recuperación automática por borrado puede hacer que dos contendientes eliminen un bloqueo nuevo. Se prioriza no permitir dos mutaciones simultáneas.

Fuera de 1.0: Windows, proveedores alternativos, HTTP local con TLS autofirmado, URLs permanentes, inspección de tráfico y presets de vendors.
