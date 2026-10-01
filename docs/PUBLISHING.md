# Publicación open source

Repositorio objetivo: `https://github.com/stock42/s42-agent`. Licencia MIT.
El paquete mantiene `private: true` porque se distribuye como
fuente/binario del harness; eso no configura la visibilidad del repositorio GitHub.

## Preparación incluida

- LICENSE y metadata MIT/repositorio/homepage/issues en package.json.
- README con inicio rápido, menús reales, pestañas, proveedor local, Promptings,
  MCP/Skills, persistencia, atajos y límites comprobados.
- CONTRIBUTING y plantillas de issues/PR.
- CI Linux con Bun 1.4.2: install frozen, typecheck y tests, sin inferencia externa
  ni secretos requeridos. No crea releases ni publica paquetes/binarios.
- .gitignore existente para dependencias, builds y archivos de entorno.

## Publicar el código

1. Ejecutar `bun install --frozen-lockfile`, `bun run typecheck` y `bun test`.
2. Revisar el commit y publicar la rama en el repositorio objetivo, configurando
   su upstream explícitamente si falta. El trabajo de preparación no hace push.
3. Ajustar la visibilidad a pública en GitHub cuando se decida publicar.
4. Verificar el workflow remoto y clonar el repositorio desde un entorno limpio
   para repetir el inicio rápido. CI preparada no equivale a CI remota aprobada.

La URL local de origin y su autenticación pertenecen a .git/config; no forman
parte de los archivos distribuidos. La visibilidad, el push y la release son
pasos externos a esta preparación.

## Binarios opcionales

Cuando se decida una release de binarios, usar build/build:targets, verificar
checksums y ejecutar los targets en sus sistemas de destino antes de declarar
soporte. La preparación actual prioriza la TUI fuente; no genera artefactos nuevos.
