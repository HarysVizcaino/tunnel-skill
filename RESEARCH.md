# Agent Skills: investigación aplicada a Tunnel

Fecha de consulta: 24 de septiembre de 2026.

Alcance: revisión documental de fuentes primarias. No se implementó la skill, no se instalaron paquetes y no se probaron agentes ni túneles. Las recomendaciones de diseño identificadas como propuestas no son requisitos universales del estándar.

## Conclusión

Tunnel debe tener instrucciones breves, un núcleo ejecutable predecible y evaluaciones que demuestren tanto una activación apropiada como una ejecución correcta. La compatibilidad de archivos no garantiza la misma experiencia, permisos o persistencia de procesos entre agentes.

## Hallazgos y aplicación

### 1. Describir la intención del usuario con precisión

Agent Skills recomienda descripciones orientadas a la intención y evaluarlas con solicitudes positivas y negativas cercanas al dominio. Su guía propone aproximadamente 20 consultas, repeticiones y separación entre ejemplos de ajuste y validación. [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions).

Propuesta inicial para Tunnel, pendiente de evaluación:

```yaml
name: tunnel
description: >-
  Use when the user requests a temporary public HTTPS URL for a local app,
  a public webhook URL, or the status or shutdown of a Tunnel-managed tunnel.
```

Pruebas positivas: “comparte mi app local con un enlace público”, “necesito recibir un webhook en localhost”, “detén el túnel de este proyecto”. Negativas: “compila mi app”, “abre la vista previa local”, “explícame Cloudflare Tunnel”, “despliega permanentemente en mi dominio”.

### 2. Mantener instrucciones breves y cargar referencias cuando hagan falta

OpenAI recomienda descripciones específicas y un documento principal mínimo que dirija a los recursos relevantes; advierte que descripciones amplias o largas pueden producir activaciones indebidas y consumir contexto. [Rethinking skills and prompts](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra).

Propuesta: SKILL.md contiene entradas aceptadas, flujo normal, condiciones de éxito y errores que requieren intervención. El PRD, la investigación y la documentación extensa permanecen fuera del flujo de lectura habitual. Las referencias indican cuándo consultarlas: por ejemplo, problemas de permisos o diagnóstico del proveedor.

### 3. Incorporar conocimiento obtenido de ejecuciones reales

La guía del estándar recomienda partir de experiencia concreta, revisar trazas y añadir instrucciones que solucionen errores observados. Favorece valores predeterminados claros y procedimientos específicos sobre consejos genéricos. [Best practices for skill creators](https://agentskills.io/skill-creation/best-practices).

Propuesta: registrar problemas reproducidos como selección del puerto de otro proyecto, servidores duplicados o estado obsoleto. Evitar convertir cada caso hipotético en una regla del prompt. Primero comprobarlo y, cuando corresponda, corregirlo en código.

### 4. Limitar la improvisación en operaciones frágiles

Anthropic recomienda ajustar la libertad del agente a la fragilidad de la operación: scripts concretos cuando importan la consistencia y la secuencia; más autonomía cuando existen varias soluciones válidas. [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

Propuesta: descarga, validación de runtime, detección de procesos, estado, parada y verificación residen en scripts. El agente interpreta la solicitud, presenta resultados y resuelve ambigüedades. La elección de JavaScript/Node sigue siendo una decisión del proyecto, no una exigencia de estas fuentes.

### 5. Diseñar los scripts como interfaces para agentes

La guía de scripts recomienda evitar interacción por terminal, documentar --help, emitir datos estructurados, separar diagnósticos, permitir reintentos seguros y declarar dependencias. [Using scripts in skills](https://agentskills.io/skill-creation/using-scripts).

Propuesta de contrato:

- Entradas mediante argumentos; nada de menús que esperen teclado.
- JSON en stdout y diagnósticos acotados en stderr.
- Errores identificables: AMBIGUOUS_TARGET, APP_NOT_READY, RUNTIME_DOWNLOAD_FAILED y PUBLIC_VERIFICATION_FAILED.
- Idempotencia: repetir la creación reutiliza un túnel sano del mismo proyecto.
- Identificar explícitamente el directorio del proyecto, separado del directorio donde está instalada la skill.
- Estado machine-readable que no declare éxito basándose únicamente en la existencia de una URL.

### 6. Separar descubrimiento, autorización y ejecución

Claude Code ofrece disable-model-invocation para skills que deben invocarse manualmente, especialmente acciones con efectos externos. Es un mecanismo del cliente; no debe asumirse universal. [Extend Claude with skills](https://code.claude.com/docs/en/skills).

Propuesta para Tunnel: abrir un túnel requiere una solicitud del usuario de compartir públicamente, recibir webhooks o invocar la skill. Terminar una app no autoriza su publicación automática. Una solicitud explícita suficiente permite continuar sin pedir una confirmación adicional por rutina. Los permisos obligatorios del entorno siguen aplicando.

Queda una decisión de producto: admitir peticiones en lenguaje natural o configurar una variante estrictamente manual en Claude Code. No activar disable-model-invocation por defecto sin considerar que también afecta al descubrimiento automático.

### 7. Evaluar resultados y acciones observables

OpenAI recomienda probar invocación explícita, implícita, contextual y controles negativos, y usar trazas con verificaciones deterministas para comprobar qué ocurrió. [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills).

Propuesta: comprobar que la URL llega al servidor correcto, que no aparecen procesos duplicados y que --stop conserva procesos ajenos. Añadir casos donde la skill se consulta para analizarla: leer su documentación no debe ejecutar sus scripts.

### 8. Medir el valor de la skill frente a una referencia

Agent Skills recomienda comparar ejecuciones con y sin skill, o contra la versión anterior, en contextos limpios. También propone registrar duración, tokens y verificaciones objetivas. [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills).

Propuesta: separar tests del programa de evaluaciones del agente. Empezar con tres recorridos completos y ampliar con fallos reales. Registrar agente, modelo, versiones, sistema, estado inicial y resultado. Usar servicios simulados en pruebas rutinarias y pruebas reales controladas para confirmar integración.

### 9. Cumplir el estándar sin asumir extensiones universales

El formato exige name y description; el nombre coincide con el directorio. Permite scripts y referencias. Recomienda menos de 500 líneas y 5.000 tokens para el archivo principal; no son objetivos que haya que llenar. allowed-tools es experimental y su soporte puede variar. [Agent Skills specification](https://agentskills.io/specification).

Propuesta: validar skills/tunnel con skills-ref y probar el paquete instalado en cada cliente anunciado. No confundir validación del manifiesto con validación funcional ni con autorización de ejecución.

### 10. Probar la distribución real y revisar dependencias

El instalador de Vercel reconoce skills/<nombre>/SKILL.md y admite selección de skill, instalación global y selección de agente. [Skills CLI](https://github.com/vercel-labs/skills).

Anthropic recomienda revisar código, dependencias y conexiones externas al evaluar la confianza de una skill. [Equipping agents with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).

Propuesta: probar instalación desde el repositorio público en un entorno limpio; verificar que todos los scripts se copian y sus rutas se resuelven. Documentar fuentes y versiones del runtime, archivos creados y procedimiento de limpieza. No descargar código mutable y ejecutarlo sin verificación.

## Decisiones propuestas para la próxima revisión del PRD

| Prioridad | Cambio | Evidencia de aceptación |
|---|---|---|
| P0 | Delimitar cuándo se permite abrir un túnel | Los controles negativos no crean exposición pública |
| P0 | Definir interfaz determinista del núcleo | Entradas validadas, errores diferenciados y JSON verificable |
| P0 | Resolver identidad y propiedad de procesos | Nunca se publica ni detiene por error otro proyecto |
| P0 | Definir éxito y persistencia | URL comprobada y duración validada por cliente |
| P1 | Crear evaluaciones de activación y ejecución | Resultados repetidos, trazas y comparación con referencia |
| P1 | Validar instalación y plataformas | Pruebas registradas del paquete realmente instalado |
| P1 | Acortar SKILL.md y separar referencias | Flujo normal comprensible sin cargar documentos extensos |
| P2 | Optimizar consumo y mantenimiento | Menos pasos innecesarios sin regresiones funcionales |

## Límites de la investigación

Estas fuentes fundamentan el diseño de la skill, pero no prueban que Tunnel funcione. No existe en lo revisado una certificación universal de “skill lista para producción”. La elección de lenguaje, política de procesos, umbrales de publicación y arquitectura del estado requieren decisiones y pruebas propias. Las instrucciones específicas de Claude Code deben verificarse por separado en Codex y otros clientes.
