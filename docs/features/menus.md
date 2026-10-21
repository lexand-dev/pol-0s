# Menús de la barra de menú

**Estado:** Verificada
**Requisitos que cierra:** S-05
**Fecha de acuerdo:** 2026-10-10

## Qué se construye

Los cinco menús de la barra superior (Archivo, Edición, Visualización, Ventana y Ayuda) dejan de ser
texto y se convierten en menús desplegables que funcionan, como en macOS. Solo existen en escritorio:
en móvil no hay barra de menú.

Se abren con un clic. Con un menú abierto, pasar el ratón por otro menú lo abre (como en macOS). Se
cierran con Escape o con un clic fuera. Se recorren con el teclado: flechas izquierda y derecha entre
menús, arriba y abajo entre acciones, Enter para elegir. Lo que no se puede hacer en ese momento sale
**desactivado** (gris, sin efecto).

Qué hay en cada menú:

**Archivo**
- Nuevo mensaje…: abre Correo.
- Abrir proyecto: una entrada por cada proyecto (Estudio, Panel, Pol OS), que lo abre en el Navegador.
- Sobre mí: abre el CV.
- Abrir en pestaña nueva: la dirección del proyecto que muestra el Navegador (desactivado si no hay ninguno).
- Cerrar ventana: cierra la ventana activa (desactivado si no hay ventanas).

**Edición**
- Deshacer, Rehacer, Cortar, Copiar y Seleccionar todo: actúan sobre el campo de texto con el foco
  (en Correo) o sobre la selección. Se activan solo cuando aplican.
- No hay "Pegar": el navegador no deja pegar desde un menú sin pedir permiso al portapapeles.
  El pegado normal con el teclado funciona igual.

**Visualización**
- Apariencia: Claro, Oscuro o Automático, con una marca en el activo.
- Fondo de pantalla: los cuatro, con una marca en el activo.
- Pantalla completa: entra y sale de pantalla completa.

**Ventana**
- Minimizar, Ampliar y Cerrar la ventana activa.
- Ordenar en cascada y Traer todo al frente (esta última también recupera las minimizadas).
- La lista de ventanas abiertas, con una marca en la activa y "(minimizada)" en las minimizadas;
  elegir una la trae al frente. Hoy una ventana minimizada solo se recupera pulsando su app en el dock.

**Ayuda**
- Cómo usar Pol OS: una ventana corta con lo que no es evidente (doble clic para abrir, arrastrar
  ventanas, Escape para cerrar, cómo escribir a Pol).
- Escribir a Pol…: abre Correo.
- Con Criterio, GitHub y LinkedIn: abren su web en una pestaña nueva.

El menú del logo (Acerca de, Ajustes y Bloquear pantalla) y el nombre de la app en negrita no cambian.

## Decisiones tomadas

- **Sin atajos de teclado globales (⌘W, ⌘M, ⌘N…).** El navegador se reserva esas combinaciones y no se
  pueden interceptar de forma fiable (⌘W cierra la pestaña). Por eso los menús no muestran atajos que
  no funcionarían. Los atajos que ya hay (Escape, Enter) se mantienen.
- **La lógica de qué menús y acciones hay se calcula en una función pura** (`src/os/menus.ts`) a partir
  del estado (ventanas, proyectos, preferencias). Se prueba sin navegador y la barra solo la pinta.
- **Roles de accesibilidad correctos:** `menubar`, `menu`, `menuitem`, `menuitemradio` para las
  elecciones únicas (apariencia, fondo) y `menuitemcheckbox` para la pantalla completa. Las acciones
  desactivadas llevan `aria-disabled`.
- **Los menús no roban el foco** al campo de texto de Correo: así Cortar, Copiar y Deshacer actúan
  sobre lo que el visitante estaba escribiendo.
- **Edición usa `document.execCommand`.** Está marcado como obsoleto pero funciona en todos los
  navegadores actuales y es la única vía que respeta el historial de deshacer del campo. Si algún día
  se retira, estas acciones se desactivan sin romper nada más.
- **"Pantalla completa" puede ser rechazada** (iPad, algunos navegadores): si falla, no pasa nada.
- **"Cómo usar Pol OS" es una app más** (`help`), estática y sin datos, con el mismo marco de ventana.
  No aparece en el dock ni en el escritorio: solo se abre desde Ayuda.
- Los textos de los menús salen de la propia función, en español, sin dependencias nuevas.

## Cobertura

| Requisito | Se implementa en | Se valida con |
|-----------|------------------|---------------|
| S-05 | `src/os/menus.ts`, `src/os/shell/MenuBar.svelte`, `src/os/apps/Help.svelte`, `src/os/OS.svelte` | `tests/e2e/s-05-menus.spec.ts`, `src/os/menus.test.ts`, `tests/csp/m-11-csp.spec.ts` |

Qué comprueba cada test, según el criterio del PRD:

- **e2e (escritorio):**
  - Cada uno de los cinco menús se abre con un clic y muestra sus acciones.
  - Archivo: "Nuevo mensaje" abre Correo, un proyecto se abre en el Navegador, "Cerrar ventana" cierra la activa.
  - Visualización: Oscuro cambia el tema y la marca se mueve; un fondo lo cambia; las marcas coinciden con Ajustes.
  - Ventana: lista las ventanas abiertas; una minimizada se recupera desde el menú; Cascada coloca las ventanas escalonadas.
  - Edición: con texto escrito en Correo, Cortar y Deshacer actúan sobre él sin perder el foco.
  - Ayuda: abre "Cómo usar Pol OS" y los enlaces externos llevan `target="_blank"`.
  - Teclado: flechas, Enter y Escape; con un menú abierto, mover el ratón sobre otro lo abre.
  - *Negativos:* con ninguna ventana abierta, "Cerrar ventana", "Minimizar" y "Ampliar" salen
    desactivados y elegirlos no hace nada; sin proyecto en el Navegador, "Abrir en pestaña nueva" sale
    desactivado; un clic fuera cierra el menú sin ejecutar nada. Sin errores de accesibilidad con un menú abierto.
- **Unitarios de `menus.ts`:** qué acciones hay en cada estado (sin ventanas, con ventana minimizada,
  con el Navegador en un proyecto), qué marca lleva cada elección y que la lista de ventanas sigue el estado.
- **CSP (`pnpm test:csp`):** el recorrido por todas las apps incluye abrir los menús y usar Pantalla
  completa, sin ninguna violación de la política.

Hallazgos al construir:

- **Un clic sobre un menú recién abierto por el paso del ratón lo cerraba.** Con un menú abierto, al ir con
  el ratón a otro título este se abre por el `pointerenter`; el clic siguiente caía sobre un menú ya
  abierto y lo cerraba, así que parecía que parpadeaba. Lo cazó el recorrido de la CSP, no los tests
  de menús (que cerraban cada menú antes de abrir el siguiente). Ahora el primer clic sobre un menú abierto
  por hover lo deja abierto y el siguiente lo cierra; hay un test.
- Con un menú abierto, las flechas entre títulos abren el contiguo y dejan el foco en su primera acción,
  también cuando estás en la barra (guía de accesibilidad APG). Un menú con todo desactivado (Ventana sin
  ventanas) se abre igual, sin acciones a las que dar foco.
- Edición no pierde el foco del campo: el ratón no lo mueve (`pointerdown` con `preventDefault`) y, al usar
  el teclado, se guarda el elemento enfocado antes de abrir y se restaura antes de ejecutar la acción.
- "Seleccionar todo" fuera de un campo de texto selecciona el contenido de la ventana activa
  (`data-window-body`).
- El menú del logo pasa a ser un menú más de la barra (rol `menuitem`, identificadores `menu-trigger-logo`
  y `menu-item-logo-*`); se actualizaron los tests que lo usaban (Ajustes y CSP).

**Lo que no se comprueba aquí:** "Pantalla completa" en un navegador concreto (el navegador de
pruebas la admite, pero no se verifica el aspecto). Se prueba a mano una vez en tu navegador.

## Fuera de esta feature

- Atajos de teclado globales y su indicación en los menús (el navegador los reserva).
- "Pegar" desde el menú y el menú contextual del botón derecho.
- Submenús desplegables: las listas (proyectos, fondos) van en el propio menú.
- Menús propios por app (por ejemplo, uno distinto para la Terminal): llegan con cada app.
- Menús en móvil.
