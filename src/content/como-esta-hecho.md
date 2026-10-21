---
title: "Cómo está hecho este portfolio"
description: "Cómo funciona este portfolio por dentro: las tecnologías, la actualización automática de datos, el Libro de visitas y las limitaciones por los bloqueos de LaLiga."
---

## Qué es

Es un portfolio con forma de sistema operativo de escritorio, dentro del navegador. Todo lo que ves (las ventanas, el dock, la barra de menú, la Terminal) es una web: no hay nada instalado ni un sistema detrás. En el móvil, las ventanas pasan a pantalla completa y el contenido es el mismo.

Lo hice así porque un portfolio de tarjetas no se recuerda, y porque es una forma de enseñar cómo pienso un producto en lugar de solo contarlo. No tiene cuentas ni base de datos: el contenido vive en el repositorio y los cambios son commits.

Sale de una plantilla abierta, [pol-os-template](https://github.com/polmarza/pol-os-template), de Pol Marzà. Este documento cuenta cómo está montado, cómo funciona cada parte y dónde están sus límites.

## Tecnologías

Las piezas que lo sostienen:

{{tecnologias}}

El código se escribió con Claude Code, un agente de código, siguiendo un método: antes de escribir nada, el agente lee la documentación del proyecto y se acuerda qué se construye. Ese método está en otra plantilla abierta, [project-template](https://github.com/polmarza/project-template).

## Cómo funciona por dentro

**Un sitio estático con un único trozo de servidor.** Casi todo son páginas generadas al compilar con Astro y servidas desde Cloudflare Workers. El único código que se ejecuta en un servidor son los endpoints del formulario de Correo y del Libro de visitas.

**El escritorio es una «isla» de Svelte.** Es lo único que se activa en el navegador. El gestor de ventanas (mover, redimensionar, ampliar, colocar en mitades, minimizar) son funciones puras: reciben el estado y devuelven el siguiente. Por eso se prueban sin abrir un navegador.

**Cada app se carga al abrirla.** La pantalla de acceso tiene un presupuesto de JavaScript, y una prueba vigila que no lo supere: lo pesado (Mi CV, Proyectos, Stack, Notas, este documento) llega cuando lo abres, no al entrar.

**El contenido son colecciones.** Los proyectos, las notas y las reseñas del Libro de visitas son archivos JSON y Markdown del repositorio, validados al compilar: un campo mal escrito rompe la compilación, no la web.

**Seguridad.** Una política de seguridad de contenido estricta: ningún script ni estilo en línea sin su huella, nadie puede incrustar esta web en otra, y el Navegador interno solo carga los sitios de los proyectos. Las respuestas del servidor llevan sus propias cabeceras.

**Lo que guarda tu navegador.** Solo tus preferencias (tema, fondo y tamaño del texto), en tu propio navegador. No hay cookies ni analítica.

**Accesibilidad.** Todo se puede manejar con el teclado, se respeta el movimiento reducido y hay pruebas automáticas de accesibilidad en claro y en oscuro.

## Cómo se actualizan solos los datos

Las herramientas del [Stack](#abrir-stack) y los datos de GitHub de cada proyecto no se escriben a mano. Una tarea de GitHub Actions los recalcula (a mano, o cada día si se activa el horario):

1. Usa un **token de GitHub de solo lectura**, guardado como secreto del repositorio, para listar los repositorios de la cuenta (públicos y privados, sin copias).
2. Mira, de cada uno, los lenguajes, el `package.json`, el `Cargo.toml` y algunos archivos reveladores.
3. Lo traduce a herramientas con un catálogo (qué dependencia corresponde a qué herramienta).
4. Escribe **solo recuentos y años**: cuántos repositorios usan cada herramienta y desde cuándo. De los privados no sale ningún nombre, y el script se niega a publicar si alguno se colara.
5. Pasa las pruebas y, si hay cambios, los publica directamente en la rama principal. Esa fusión despliega la web.

Si el token caduca, la tarea falla en lugar de publicar números recortados. Los datos de cada proyecto (lenguajes, etiquetas y licencia) salen de la API pública de GitHub.

Una advertencia de honestidad, que también está en el Stack: los números cuentan repositorios, y muchos nacieron de un generador que trae de serie React, Tailwind, Vite y otras herramientas. Por eso aparecen más de lo que reflejaría una elección consciente. «Desde» es el año del primer repositorio con esa herramienta, nunca anterior a su lanzamiento.

## El formulario de Correo y el Libro de visitas

**Correo.** Escribes en el formulario y pasa por una verificación anti-bots (Cloudflare Turnstile), un límite de frecuencia y una validación en el servidor. El mensaje llega al correo del autor a través del servicio de correo de Cloudflare. **No se guarda en ningún sitio**: si el envío falla, lo ves y puedes reintentar. El destino sale siempre de la configuración del servidor, nunca de lo que manda el navegador.

**Libro de visitas.** El [Libro de visitas](#abrir-visitas) tampoco usa base de datos:

1. Escribes tu reseña y tu correo. El servidor la valida y te manda un enlace de confirmación, que lleva dentro tu petición **cifrada y autenticada** y caduca a las 48 horas.
2. Abres el enlace y pulsas «Confirmar». Es un botón a propósito: muchos programas de correo abren los enlaces por su cuenta para analizarlos y confirmarían solos.
3. La reseña llega al correo del autor ya en forma de archivo. Si la aprueba, la guarda en el repositorio y se publica con el siguiente despliegue.

Nada aparece sin aprobación, y tu correo nunca se publica ni se guarda en la web. Si quieres editar o retirar tu reseña, se hace por el mismo formulario.

## Cómo se trabaja

Antes de escribir código se acuerda con el agente una ficha de cada pieza: qué se construye, qué queda fuera y con qué prueba se demostrará cada requisito. Hay pruebas unitarias, pruebas en un navegador real en escritorio y móvil (con comprobación de accesibilidad) y pruebas contra la versión compilada para las cabeceras de seguridad y el rendimiento. Un script comprueba que ningún requisito se queda sin su prueba.

Todo se prueba en local, nunca contra la web publicada. Y el despliegue lo hace una persona: el agente lo prepara, pero no lo lanza.

## Limitaciones: los bloqueos de LaLiga

**Qué pasa.** Durante los partidos de LaLiga, a petición de la liga, algunas operadoras españolas bloquean direcciones compartidas de Cloudflare. Como esta web se sirve desde ahí, durante unas horas puede no cargar desde España (o verse en blanco), aunque funcione desde otra red. Según los datos de hayahora.futbol, que sigue estos bloqueos, solo caen de forma prolongada las direcciones de Cloudflare; otras plataformas de alojamiento solo aparecen con cortes de unos minutos de madrugada. No es un fallo de la web y se levanta al acabar el partido. Los datos son aproximados: cada operadora actúa a su manera.

**Por qué no se arregla sin cambiar de plataforma.** El dominio de un Worker se sirve siempre a través del proxy de Cloudflare, que no se puede quitar, y tener una dirección propia que no se comparta es de pago (plan Enterprise).

**Ideas para resolverlo.**

- Sacar las páginas de Cloudflare (por ejemplo a Netlify, con el DNS sin proxy) y llevar el formulario a otro servicio de correo.
- Un servidor propio pequeño, con una dirección que no se comparta con nadie.
- Una página de respaldo en otro dominio, con un aviso, un vídeo que explique qué es esto y una estimación de cuándo vuelve la web. Sirve a quien llega desde un enlace propio, no a quien escribe el dominio directamente.
- Una copia completa de la web en otro proveedor.

**Por qué no se ha cambiado (de momento).**

- Cloudflare da, en un solo sitio y a bajo coste, el alojamiento, la verificación anti-bots, los Workers, el envío de correo y los límites de frecuencia. Cambiarlo es rehacer varias piezas a la vez.
- Una copia no resuelve lo principal: quien escribe el dominio sigue yendo a la dirección bloqueada. Mantener dos sitios duplica el trabajo y las posibilidades de fallo.
- Afecta durante horas en días de partido, no siempre. Por ahora compensa quedarse y vigilarlo; si empieza a costar visitas de verdad, la opción que recomiendo es pasar las páginas a otro proveedor con el DNS sin proxy.
