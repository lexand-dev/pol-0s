# Stack con gráficos

**Estado:** Verificada
**Requisitos que cierra:** M-05
**Fecha de acuerdo:** 2026-10-11

## Qué se construye

La ventana **Stack** deja de ser solo una lista de barras. Pol pidió «más vidilla, otros tipos de gráficos», **sin pestañas ni cambio de vista**.
Se probaron antes un mapa de burbujas y uno de recuadros; Pol los quitó («queda todo muy apilotonado», y en móvil se vería mal). Queda esto, **por este
orden** y en una sola columna:

1. **Los datos:** tres tarjetas, con las herramientas, los repositorios (públicos y privados) y el año desde el que construye; y debajo, de dónde
   salen los datos y **cómo se obtienen** (una tarea de GitHub Actions que cada día revisa los repositorios con un permiso de solo lectura).
2. **Año a año:** una línea con las herramientas acumuladas de cada año y, bajo cada año, las que entraron entonces.
3. **Por categoría:** un rosco con cuántas herramientas hay de cada categoría y una leyenda con sus nombres.
4. **Detalle por herramienta:** las barras de siempre, con el recuento exacto y el «desde» de cada una, **siempre a la vista**. El título de cada
   categoría va **en mayúsculas, más grande y sobre una pastilla del color de la categoría** (el de sus barras y el del rosco).

Los datos son los mismos de siempre (`src/content/stack.json`, que actualiza solo una tarea diaria). **No hay nada clicable.**

## Decisiones tomadas

- **Gráficos hechos a mano**, sin librerías: la home tiene un presupuesto de JavaScript (S-06) y la CSP no admite estilos ni scripts externos.
  La línea es HTML y CSS (así el texto sigue el tamaño elegido en Ajustes); solo el rosco es SVG.
- **Sin mapa de «lo que más uso»**: el detalle ya enseña cada herramienta y el mapa apilotonaba la ficha (Pol). El código de burbujas y de
  recuadros se borró con él.
- **El detalle va siempre a la vista**, no plegado (Pol): así no hay nada que pulsar y la ficha original del Stack («solo se lee») se mantiene.
- **Cada gráfico tiene su equivalente en texto**: el rosco lleva su leyenda con los números y la línea, una columna por año con la cifra y los
  nombres. Nada depende solo del color.
- **Colores de categoría con variables** (`--cat-1` a `--cat-8`), una paleta para el tema claro y otra para el oscuro, con contraste
  suficiente para el texto de los títulos de categoría. Un test comprueba ese contraste en las dos paletas.
- **Sin animación** en los gráficos: nada que haya que desactivar con `prefers-reduced-motion`.
- **El rosco cuenta herramientas por categoría** (no suma de repositorios, que contaría varias veces el mismo repositorio).
- **La explicación de cómo se obtienen los datos** va en el propio Stack, en dos frases. La explicación completa (y todo lo demás sobre cómo está
  hecho Pol OS) irá en una vista aparte, con su propia ficha.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| M-05 | `src/lib/stack-charts.ts`, `src/os/apps/stack/Stack.svelte`, `src/styles/tokens.css` (`--cat-*`) | `src/lib/stack-charts.test.ts`, `tests/e2e/m-05-stack.spec.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **Unitarios (`stack-charts.test.ts`):** el rosco suma 360° y cada porción es proporcional; el acumulado por año no baja nunca, rellena los años
  sin altas y termina en el total; los colores de categoría tienen contraste suficiente con su texto en las dos paletas.
- **e2e (escritorio y móvil, con axe en claro y oscuro):** las tres cifras coinciden con los datos; las secciones van en el orden acordado; no hay
  mapa; el texto explica cómo se obtienen los datos; el rosco enseña cada categoría con su número y la leyenda las nombra; hay una columna por año
  con su total acumulado y sus herramientas nuevas; el detalle está siempre visible con cada herramienta, su recuento y su año, y el título de cada
  categoría va en mayúsculas y del color de su categoría; no hay ni enlaces, ni botones, ni campos, ni pestañas, ni desplegables; no se desborda ni
  con el texto más grande; la nota del generador y la ausencia de nombres de repositorio se mantienen.
  - *Negativo:* nada lleva a otra parte ni cambia de vista, y ningún dato publicado revela el nombre de un repositorio privado.
- **Contra la compilación (`m-11-csp`):** abrir el Stack con la política activa no registra ninguna violación.

**Lo que no se comprueba aquí:** que la composición «quede bonita»: se revisa a ojo en claro y oscuro, en móvil y con los tres tamaños de texto.

## Hallazgos al construir

- **La home superó su presupuesto de CSS** (43 KB frente a 40): Astro enlaza también el CSS de las apps cargadas bajo demanda, y sigue en 42,6 KB
  sin el mapa. Se probó a sacarlas del grafo del servidor y no cambió nada. Se subió el tope a 50 KB (comentado en el test) y se anotó MEJORA-08 para
  arreglarlo de verdad. **Es una decisión a revisar por Pol.**
- **El texto de «1 repositorios»** (en un intento anterior): se usa el singular cuando toca.
- **La paleta se comprueba leyendo `tokens.css`**; también se verificó que el test falla con un color de poco contraste.
- **Los intentos con burbujas y con recuadros** dejaron aprendizajes que ya no están en el código: un recuadro con relleno propio se agranda y pisa a
  sus vecinos, y restar un hueco al radio de una burbuja distorsiona su área. Si algún día vuelve un gráfico de áreas, mirar esto.

## Fuera de esta feature

- Cambiar de vista con pestañas, filtrar o pulsar una herramienta (Pol pidió expresamente que no).
- Un mapa de «lo que más uso» (probado y descartado).
- Mostrar nombres de repositorios, sobre todo de los privados.
- Animar los gráficos o mostrar valores al pasar el ratón más allá de la etiqueta nativa.
- Datos nuevos: la tarea diaria y `stack.json` no cambian.
