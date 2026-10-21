---
title: Cómo cambiar tus datos
description: "Tu nombre, tus enlaces y el nombre del sistema están en un solo archivo: src/content/persona.ts."
date: 2026-10-04
order: 4
tags: [plantilla, ejemplo]
---

Lo que la interfaz dice de ti sale de `src/content/persona.ts`: tu nombre, cómo te llama la Terminal, el nombre del sistema, tu web, tu usuario de GitHub y tu newsletter (o `null` si no tienes).

Los accesos directos del escritorio (GitHub, LinkedIn, WhatsApp) están en `src/content/links.ts`, y tu foto en `src/assets/foto.webp`. Después de cambiar el CV (`src/content/sobre-mi.md`), genera el PDF con `node scripts/generar-cv.mjs`, y la imagen para compartir con `node scripts/generar-imagenes.mjs`.
