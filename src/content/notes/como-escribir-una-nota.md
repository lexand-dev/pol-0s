---
title: Cómo escribir una nota
description: "Las notas son archivos Markdown. Cada una sale en la carpeta Notas y en su propia página pública."
date: 2026-10-03
order: 3
tags: [plantilla, ejemplo]
---

Crea un archivo `.md` en `src/content/notes/` con esta cabecera:

```md
---
title: El título
description: "Una o dos frases: es lo que enseña Google."
date: 2026-10-03
tags: [una, dos]
---
```

Debajo, el texto en Markdown: **negritas**, enlaces, listas y bloques de código. Al publicar, la nota aparece en la carpeta Notas del escritorio y en `/notas/<nombre-del-archivo>/`.

La fecha ordena las notas (la más reciente primero) y las etiquetas salen bajo el título. Si dos notas tienen la misma fecha, `order` decide cuál va antes. Cada nota tiene también su vista previa al compartir y entra sola en el mapa del sitio para los buscadores.
