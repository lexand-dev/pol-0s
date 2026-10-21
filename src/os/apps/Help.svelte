<script lang="ts">
  import { PERSONA } from '../../content/persona';
  import { UI_SVG } from '../icons';
</script>

<article class="help" data-testid="help">
  <h2>Cómo usar {PERSONA.osName}</h2>
  <p class="lead">Esto es un portfolio con forma de ordenador. Todo funciona como te imaginas, con algún detalle por si te pierdes.</p>

  <section>
    <h3>Abrir cosas</h3>
    <ul>
      <li><strong>Doble clic</strong> en un icono del escritorio para abrirlo. Un solo clic lo selecciona. En el móvil basta con tocar.</li>
      <li>Los iconos con una flecha pequeña (<span class="chip">{@html UI_SVG.tick}</span> en la esquina) son accesos directos: abren su web en una pestaña nueva.</li>
      <li>El <strong>dock</strong> de abajo tiene las apps del sistema: Navegador, Correo, Notas, Terminal y Ajustes.</li>
    </ul>
  </section>

  <section>
    <h3>Ventanas</h3>
    <ul>
      <li>Arrástralas por la barra de arriba y cámbiales el tamaño desde la esquina inferior derecha.</li>
      <li>Los tres puntos de colores cierran, minimizan y amplían. <strong>Escape</strong> cierra la ventana activa.</li>
      <li>El menú <strong>Ventana</strong> lista las que tienes abiertas, incluidas las minimizadas.</li>
    </ul>
  </section>

  <section>
    <h3>Proyectos</h3>
    <p>Cada proyecto se abre en el <strong>Navegador</strong> de dentro. Los demás están en su barra de favoritos. Si uno no se deja mostrar aquí, verás un aviso con un botón para abrirlo en otra pestaña.</p>
  </section>

  <section>
    <h3>Escribir a {PERSONA.firstName}</h3>
    <p>La app <strong>Correo</strong> (o Archivo → Nuevo mensaje) envía un mensaje que le llega de verdad. Lo único que pide es tu correo, para poder responderte.</p>
  </section>

  <section>
    <h3>A tu gusto</h3>
    <p>En <strong>Ajustes</strong>, o en el menú Visualización, eliges tema claro u oscuro y el fondo de pantalla. Se guardan solo en tu navegador.</p>
  </section>
</article>

<style>
  .help {
    max-width: 62ch;
    padding: 22px 24px 32px;
    line-height: 1.55;
  }
  h2 {
    margin: 0 0 6px;
    font-size: calc(20px * var(--text-scale));
    letter-spacing: -0.01em;
  }
  h3 {
    margin: 22px 0 6px;
    font-size: calc(14px * var(--text-scale));
    color: var(--muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .lead {
    margin: 0;
    color: var(--muted);
  }
  p,
  ul {
    margin: 0;
  }
  ul {
    padding-left: 18px;
    display: grid;
    gap: 6px;
  }
  .chip {
    display: inline-grid;
    place-items: center;
    width: 15px;
    height: 15px;
    vertical-align: -3px;
    border-radius: 4px;
    background: var(--hover);
  }
  .chip :global(svg) {
    width: 10px;
    height: 10px;
  }
</style>
