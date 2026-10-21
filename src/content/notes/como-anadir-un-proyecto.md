---
title: Cómo añadir un proyecto
description: "Un archivo JSON, sus capturas y listo: el proyecto aparece en Proyectos, en el Navegador y en la Terminal."
date: 2026-10-02
order: 2
tags: [plantilla, ejemplo]
---

Cada proyecto es un archivo en `src/content/projects/`. Lo mínimo es el nombre, una frase, los colores y la dirección:

```json
{
  "name": "Mi proyecto",
  "domain": "miproyecto.com",
  "description": "Qué es, en una frase.",
  "summary": "Qué es, más corto.",
  "stack": ["Astro"],
  "colors": { "from": "#ffb27a", "to": "#e0553f" },
  "url": "https://miproyecto.com",
  "embeddable": false,
  "order": 1
}
```

Las capturas van en `public/projects/<proyecto>/` como `.webp`. Si la web del proyecto se deja incrustar (no envía `frame-ancestors`), pon `"embeddable": true` y se abrirá dentro del Navegador.

El proyecto aparece solo en la carpeta Proyectos, en la barra de favoritos del Navegador y en la Terminal (`open <nombre>`). Si tiene repositorio público, añade `"repo": "usuario/nombre"` y la tarea diaria rellenará sus lenguajes y etiquetas.
