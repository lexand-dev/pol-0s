<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import stylesheet from './checkers.css?url';
  import { chooseMove, type Level } from '../../../lib/checkers/ai';
  import {
    COLOR_NAME,
    SIZE,
    applyMove,
    col,
    count,
    describeMove,
    legalMoves,
    newGame,
    other,
    outcome,
    row,
    sq,
    squareName,
    type Color,
    type GameState,
    type Move,
  } from '../../../lib/checkers/rules';
  import {
    CELL,
    DEFAULT_VIEW,
    OUTER,
    PIECE_H,
    PIECE_R,
    THICK,
    VH,
    VW,
    cellCenter,
    clampTilt,
    loadView,
    normRot,
    polygon,
    projector,
    saveView,
    type View,
  } from '../../../lib/checkers/view';

  // Las damas (C-06): una partida contra la máquina. En el escritorio, el tablero en 3D se gira y se inclina arrastrando; en el móvil se ve
  // desde arriba. Sus estilos están en checkers.css y se enlazan al abrir la ventana: así la home no los carga (ni suma una petición).
  const MOBILE_QUERY = '(max-width: 767px)';
  /** Lo que tarda la máquina en contestar, como mínimo: así se ve su jugada. */
  const MACHINE_DELAY = 450;
  const THINK_MS = 300;

  const cryptoRand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  const storage = () => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  };

  let game = $state.raw<GameState>(newGame());
  let human = $state<Color>('w');
  let level = $state<Level>('easy');
  /** Las casillas elegidas de la jugada en curso: la ficha y, en una captura en cadena, dónde ha ido cayendo. */
  let partial = $state.raw<number[]>([]);
  let last = $state.raw<Move | null>(null);
  /** El estado antes de cada jugada propia, para deshacer. */
  let history = $state.raw<GameState[]>([]);
  let surrendered = $state(false);
  let thinking = $state(false);
  /** Lo que oye el lector de pantalla: la última jugada o el resultado. */
  let announce = $state('');
  let notice = $state('');
  let view = $state<View>(loadView(storage()));
  let mobile = $state(false);
  let cursor = $state(sq(SIZE - 1, 0));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let svg: SVGSVGElement | undefined = $state();
  /** Hasta que llegan los estilos, la ventana no se enseña: sin ellos el tablero saldría sin colores. */
  let styled = $state(false);

  type End =
    | { kind: 'win'; winner: Color; reason: 'no-pieces' | 'no-moves' | 'surrender' }
    | { kind: 'draw'; reason: 'repetition' | 'quiet' };
  const end = $derived<End | null>(surrendered ? { kind: 'win', winner: other(human), reason: 'surrender' } : outcome(game));
  const moves = $derived(!end && game.turn === human && !thinking ? legalMoves(game) : []);
  const candidates = $derived(moves.filter((m) => partial.every((s, i) => m.path[i] === s)));
  const movable = $derived(new Set(moves.map((m) => m.path[0])));
  const targets = $derived(partial.length ? [...new Set(candidates.map((m) => m.path[partial.length]).filter((s) => s !== undefined))] : []);
  const mustCapture = $derived(moves.some((m) => m.captures.length > 0));
  const lastSquares = $derived(new Set(last?.path ?? []));

  /** De la casilla tal como se ve (fila y columna desde quien juega) a la del reglamento, y al revés: con rojas, el tablero se da la vuelta. */
  const toLogical = (r: number, c: number) => (human === 'w' ? sq(r, c) : sq(SIZE - 1 - r, SIZE - 1 - c));
  const toDisplay = (s: number): [number, number] => (human === 'w' ? [row(s), col(s)] : [SIZE - 1 - row(s), SIZE - 1 - col(s)]);

  const hint = $derived.by(() => {
    if (end) return '';
    if (thinking || game.turn !== human) return 'Piensa la máquina…';
    if (notice) return notice;
    if (partial.length > 1) return 'Sigue capturando: elige la siguiente casilla.';
    if (mustCapture) return 'Capturar es obligatorio: elige una ficha marcada.';
    return partial.length ? 'Elige la casilla de destino.' : 'Elige una de tus fichas.';
  });

  const endText = $derived.by(() => {
    if (!end) return null;
    if (end.kind === 'draw') {
      return { title: 'Tablas', why: end.reason === 'repetition' ? 'La misma posición se ha repetido tres veces.' : '40 jugadas por bando sin capturas ni movimientos de peón.' };
    }
    const won = end.winner === human;
    const why =
      end.reason === 'surrender'
        ? 'Te has rendido.'
        : end.reason === 'no-pieces'
          ? won
            ? 'La máquina se ha quedado sin fichas.'
            : 'Te has quedado sin fichas.'
          : won
            ? 'La máquina no puede mover.'
            : 'No te quedan movimientos.';
    return { title: won ? '¡Has ganado!' : 'Gana la máquina', why };
  });

  $effect(() => {
    if (endText) announce = `${endText.title} ${endText.why}`;
  });

  function start() {
    clearTimeout(timer);
    human = cryptoRand() < 0.5 ? 'w' : 'r';
    game = newGame();
    partial = [];
    last = null;
    history = [];
    surrendered = false;
    thinking = false;
    notice = '';
    cursor = toLogical(SIZE - 1, 0);
    announce = `Partida nueva. Juegas con las ${COLOR_NAME[human].toLowerCase()}${human === 'r' ? '; empiezan las blancas, la máquina' : ''}.`;
    if (game.turn !== human) machineTurn();
  }

  function machineTurn() {
    thinking = true;
    timer = setTimeout(() => {
      const m = chooseMove(game, { level, rand: cryptoRand, now: () => performance.now(), budgetMs: THINK_MS });
      if (m) {
        const color = game.turn;
        game = applyMove(game, m);
        last = m;
        announce = describeMove(color, m);
      }
      thinking = false;
    }, MACHINE_DELAY);
  }

  function play(m: Move) {
    history = [...history, game];
    game = applyMove(game, m);
    last = m;
    partial = [];
    notice = '';
    announce = describeMove(human, m);
    if (!outcome(game)) machineTurn();
  }

  function choose(s: number) {
    if (end || thinking || game.turn !== human) return;
    notice = '';
    const piece = game.board[s];
    if (partial.length <= 1 && piece?.color === human) {
      if (movable.has(s)) partial = [s];
      else {
        partial = [];
        notice = mustCapture ? 'Capturar es obligatorio: esa ficha no puede capturar.' : 'Esa ficha no puede mover.';
      }
      return;
    }
    if (!partial.length || !targets.includes(s)) return;
    const next = [...partial, s];
    const prefix = (m: Move) => next.every((x, i) => m.path[i] === x);
    const done = candidates.find((m) => m.path.length === next.length && prefix(m));
    const longer = candidates.some((m) => m.path.length > next.length && prefix(m));
    if (done && !longer) play(done);
    else partial = next;
  }

  function undo() {
    if (!history.length || thinking) return;
    clearTimeout(timer);
    game = history[history.length - 1];
    history = history.slice(0, -1);
    partial = [];
    last = null;
    surrendered = false;
    notice = '';
    announce = 'Jugada deshecha.';
  }

  // ─── Vista: girar e inclinar ─────────────────────────────────────────────────────────────────
  let drag: { x: number; y: number; rot: number; tilt: number } | null = null;
  let dragged = false;
  let dragging = $state(false);

  function setView(v: View) {
    view = { rot: normRot(v.rot), tilt: clampTilt(v.tilt) };
    saveView(storage(), view);
  }
  function onpointerdown(e: PointerEvent) {
    if (mobile || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, rot: view.rot, tilt: view.tilt };
    dragged = false;
  }
  function onpointermove(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < 5) return;
    dragged = dragging = true;
    // Como empujar la mesa: arrastrar a la derecha gira hacia la izquierda; hacia abajo se ve más desde arriba.
    view = { rot: normRot(drag.rot - dx * 0.5), tilt: clampTilt(drag.tilt + dy * 0.35) };
  }
  function onpointerup() {
    if (drag && dragged) saveView(storage(), view);
    drag = null;
    dragging = false;
    // El clic que llega justo después de arrastrar no cuenta como jugada.
    setTimeout(() => (dragged = false), 0);
  }
  const clickCell = (s: number) => {
    if (dragged) return;
    cursor = s;
    choose(s);
  };

  // ─── Teclado: las flechas recorren las casillas oscuras tal como se ven desde quien juega ───────────────
  function onkeydown(e: KeyboardEvent, s: number) {
    const [r, c] = toDisplay(s);
    let nr = r;
    let nc = c;
    if (e.key === 'ArrowLeft') nc = c - 2;
    else if (e.key === 'ArrowRight') nc = c + 2;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      nr = r + (e.key === 'ArrowUp' ? -1 : 1);
      nc = c - 1 >= 0 ? c - 1 : c + 1;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(s);
      return;
    } else return;
    e.preventDefault();
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return;
    cursor = toLogical(nr, nc);
    svg?.querySelector<SVGElement>(`[data-square="${cursor}"]`)?.focus();
  }

  function cellLabel(s: number): string {
    const p = game.board[s];
    const piece = p ? `${p.king ? 'dama' : 'ficha'} ${p.color === 'w' ? 'blanca' : 'roja'}` : 'vacía';
    const extra = partial[0] === s ? ', elegida' : targets.includes(s) ? ', destino posible' : movable.has(s) && mustCapture ? ', puede capturar' : '';
    return `${squareName(s)}, ${piece}${extra}`;
  }

  // ─── El tablero en 3D (escritorio) ─────────────────────────────────────────────────────────────
  const scene = $derived.by(() => {
    const p = projector(view);
    const corners: [number, number][] = [
      [-OUTER, -OUTER],
      [OUTER, -OUTER],
      [OUTER, OUTER],
      [-OUTER, OUTER],
    ];
    const sides: { d: string; left: boolean }[] = [];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i];
      const [x2, z2] = corners[(i + 1) % 4];
      const [nx, nz] = p.turn(z2 - z1, -(x2 - x1));
      if (nz <= 0) continue;
      sides.push({ d: polygon([p.project(x1, z1), p.project(x2, z2), p.project(x2, z2, -THICK), p.project(x1, z1, -THICK)]), left: nx < 0 });
    }
    const shadow = polygon(corners.map(([x, z]) => p.project(x * 1.04, z * 1.04 + 8, -THICK)));
    const top = polygon(corners.map(([x, z]) => p.project(x, z)));
    const h = CELL / 2;
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [x, z] = cellCenter(r, c);
        const s = toLogical(r, c);
        const mid = p.project(x, z);
        cells.push({
          s,
          dark: (r + c) % 2 === 1,
          d: polygon([p.project(x - h, z - h), p.project(x + h, z - h), p.project(x + h, z + h), p.project(x - h, z + h)]),
          x,
          z,
          mid,
        });
      }
    }
    cells.sort((a, b) => b.mid.depth - a.mid.depth);
    const pieces = cells
      .filter((cell) => game.board[cell.s])
      .map((cell) => {
        const piece = game.board[cell.s]!;
        const base = cell.mid;
        const R = PIECE_R * base.scale;
        const ry = R * p.squash;
        const layers = Array.from({ length: piece.king ? 2 : 1 }, (_, i) => {
          const b = p.project(cell.x, cell.z, i * PIECE_H);
          const t = p.project(cell.x, cell.z, (i + 1) * PIECE_H);
          // Geometría relativa a la base: la posición va en `transform`, que es lo que se anima al mover.
          const bx = b.x - base.x;
          const by = b.y - base.y;
          const tx = t.x - base.x;
          const ty = t.y - base.y;
          return { side: `M${bx - R},${by} L${tx - R},${ty} L${tx + R},${ty} L${bx + R},${by} A${R},${ry} 0 0 1 ${bx - R},${by}z`, tx, ty };
        });
        return { s: cell.s, piece, x: base.x, y: base.y, R, ry, layers };
      });
    return { sides, shadow, top, cells, pieces, squash: p.squash };
  });

  // ─── Deslizar las fichas ───────────────────────────────────────────────────────────────────────
  // Las fichas se colocan con el atributo `transform` del SVG (en unidades del lienzo, igual en todos los navegadores) y el deslizamiento se
  // calcula aquí: una transformación CSS en píxeles dentro de un SVG escalado no se interpreta igual en todos los navegadores, y las fichas
  // salían desplazadas respecto a las casillas.
  const SLIDE_MS = 220;
  type Slide = { fx: number; fy: number };
  let slides = $state.raw<Map<number, Slide>>(new Map());
  let slideProgress = $state(1);
  let reduceMotion = false;
  let prevPos = new Map<number, { x: number; y: number }>();
  let prevBoard: GameState['board'] | null = null;
  let frame = 0;

  function startSlide(next: Map<number, Slide>) {
    cancelAnimationFrame(frame);
    slides = next;
    const t0 = performance.now();
    const step = (now: number) => {
      slideProgress = Math.min(1, (now - t0) / SLIDE_MS);
      if (slideProgress < 1) frame = requestAnimationFrame(step);
      else slides = new Map();
    };
    slideProgress = 0;
    frame = requestAnimationFrame(step);
  }

  $effect(() => {
    const pieces = scene.pieces;
    const board = game.board;
    untrack(() => {
      const now = new Map(pieces.map((p) => [p.piece.id, { x: p.x, y: p.y }]));
      // Solo se desliza cuando cambian las fichas de sitio; girar o inclinar el tablero las recoloca de golpe.
      if (prevBoard && board !== prevBoard && !reduceMotion) {
        const moved = new Map<number, Slide>();
        for (const [id, to] of now) {
          const from = prevPos.get(id);
          if (from && Math.hypot(from.x - to.x, from.y - to.y) > 0.5) moved.set(id, { fx: from.x, fy: from.y });
        }
        if (moved.size) startSlide(moved);
      }
      prevPos = now;
      prevBoard = board;
    });
  });

  /** Dónde se dibuja la ficha ahora: si se está deslizando, entre donde estaba y donde está. */
  function placed(pc: { piece: { id: number }; x: number; y: number }) {
    const s = slides.get(pc.piece.id);
    if (!s) return `translate(${pc.x.toFixed(2)} ${pc.y.toFixed(2)})`;
    const e = 1 - (1 - slideProgress) ** 3;
    return `translate(${(s.fx + (pc.x - s.fx) * e).toFixed(2)} ${(s.fy + (pc.y - s.fy) * e).toFixed(2)})`;
  }

  // ─── El tablero desde arriba (móvil) ──────────────────────────────────────────────────────────
  const TOP = 44;
  const flat = $derived(
    Array.from({ length: SIZE * SIZE }, (_, i) => {
      const r = Math.floor(i / SIZE);
      const c = i % SIZE;
      return { r, c, s: toLogical(r, c), dark: (r + c) % 2 === 1 };
    }),
  );

  onMount(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const sync = () => (mobile = mq.matches);
    sync();
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    mq.addEventListener('change', sync);
    start();
    return () => mq.removeEventListener('change', sync);
  });
  onDestroy(() => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  });
</script>

<svelte:window {onpointermove} {onpointerup} />
<svelte:head>
  <link rel="stylesheet" href={stylesheet} onload={() => (styled = true)} onerror={() => (styled = true)} />
</svelte:head>

<div class="checkers" class:dragging class:loading={!styled} data-testid="checkers" data-mode={mobile ? 'top' : '3d'} data-human={human}>
  <header class="checkers-bar">
    <div class="checkers-turn" data-testid="checkers-turn">
      <span class="checkers-dot {end ? '' : game.turn}" aria-hidden="true"></span>
      {end ? 'Partida terminada' : thinking || game.turn !== human ? 'Piensa la máquina…' : `Tu turno · ${COLOR_NAME[human].toLowerCase()}`}
    </div>
    <div class="checkers-count" data-testid="checkers-count">
      <span>Blancas {count(game.board, 'w')}</span>
      <span>Rojas {count(game.board, 'r')}</span>
    </div>
    <div class="checkers-seg" role="group" aria-label="Nivel">
      <button type="button" aria-pressed={level === 'easy'} data-testid="checkers-level-easy" onclick={() => (level = 'easy')}>Fácil</button>
      <button type="button" aria-pressed={level === 'normal'} data-testid="checkers-level-normal" onclick={() => (level = 'normal')}>Normal</button>
    </div>
  </header>

  <div class="checkers-stage">
    {#if endText}
      <div class="checkers-end" data-testid="checkers-end">
        <strong>{endText.title}</strong>
        <span>{endText.why}</span>
        <button type="button" class="checkers-btn primary" data-testid="checkers-again" onclick={start}>Jugar otra</button>
      </div>
    {/if}

    {#if mobile}
      <svg bind:this={svg} class="checkers-board top" viewBox="0 0 {TOP * SIZE} {TOP * SIZE}" role="group" aria-label="Tablero" data-testid="checkers-board">
        {#each flat as cell (cell.s)}
          {#if cell.dark}
            <rect
              class="checkers-cell dark"
              class:last={lastSquares.has(cell.s)}
              x={cell.c * TOP}
              y={cell.r * TOP}
              width={TOP}
              height={TOP}
              role="button"
              tabindex={cursor === cell.s ? 0 : -1}
              aria-label={cellLabel(cell.s)}
              data-square={cell.s}
              data-testid={`checkers-sq-${squareName(cell.s)}`}
              onclick={() => clickCell(cell.s)}
              onkeydown={(e) => onkeydown(e, cell.s)}
            />
          {:else}
            <rect class="checkers-cell light" x={cell.c * TOP} y={cell.r * TOP} width={TOP} height={TOP} />
          {/if}
        {/each}
        {#each flat as cell (cell.s)}
          {@const p = game.board[cell.s]}
          {@const cx = cell.c * TOP + TOP / 2}
          {@const cy = cell.r * TOP + TOP / 2}
          {#if targets.includes(cell.s)}<circle class="checkers-target" {cx} {cy} r="7" />{/if}
          {#if p}
            <g class="checkers-piece-top {p.color}" data-testid={`checkers-piece-${squareName(cell.s)}`} data-color={p.color} data-king={p.king}>
              {#if partial[0] === cell.s}<circle class="checkers-ring" {cx} {cy} r="20" />{:else if mustCapture && movable.has(cell.s)}<circle
                  class="checkers-ring must"
                  {cx}
                  {cy}
                  r="20"
                />{/if}
              <circle class="side" {cx} cy={cy + 1.5} r="16" />
              <circle class="face" {cx} {cy} r="15" />
              <circle class="inner" {cx} {cy} r="9.5" />
              {#if p.king}<path class="crown" d={`M${cx - 7},${cy + 3} l2,-7 l3,4 l2,-6 l2,6 l3,-4 l2,7z`} />{/if}
            </g>
          {/if}
        {/each}
      </svg>
    {:else}
      <svg
        bind:this={svg}
        class="checkers-board iso"
        viewBox="0 0 {VW} {VH}"
        role="group"
        aria-label="Tablero. Arrastra para girarlo e inclinarlo."
        data-testid="checkers-board"
        data-view={`${Math.round(view.rot)},${Math.round(view.tilt)}`}
        {onpointerdown}
      >
        <defs>
          <radialGradient id="ck-gw" cx="38%" cy="32%" r="70%"><stop offset="0%" class="ck-w-hi" /><stop offset="70%" class="ck-w" /></radialGradient>
          <radialGradient id="ck-gr" cx="38%" cy="32%" r="70%"><stop offset="0%" class="ck-r-hi" /><stop offset="70%" class="ck-r" /></radialGradient>
        </defs>
        <path class="checkers-shadow" d={scene.shadow} />
        {#each scene.sides as side, i (i)}<path class={side.left ? 'checkers-side-l' : 'checkers-side-r'} d={side.d} />{/each}
        <path class="checkers-frame" d={scene.top} />
        {#each scene.cells as cell (cell.s)}
          {#if cell.dark}
            <path
              class="checkers-cell dark"
              class:last={lastSquares.has(cell.s)}
              d={cell.d}
              role="button"
              tabindex={cursor === cell.s ? 0 : -1}
              aria-label={cellLabel(cell.s)}
              data-square={cell.s}
              data-testid={`checkers-sq-${squareName(cell.s)}`}
              onclick={() => clickCell(cell.s)}
              onkeydown={(e) => onkeydown(e, cell.s)}
            />
          {:else}
            <path class="checkers-cell light" d={cell.d} />
          {/if}
          {#if targets.includes(cell.s)}
            <ellipse class="checkers-target" cx={cell.mid.x} cy={cell.mid.y} rx={8 * cell.mid.scale} ry={8 * cell.mid.scale * scene.squash} />
          {/if}
        {/each}
        <g class="checkers-pieces" aria-hidden="true">
          {#each scene.pieces as pc (pc.piece.id)}
            <g
              class="checkers-piece {pc.piece.color}"
              transform={placed(pc)}
              data-testid={`checkers-piece-${squareName(pc.s)}`}
              data-color={pc.piece.color}
              data-king={pc.piece.king}
            >
              {#if partial[0] === pc.s}
                <ellipse class="checkers-ring" rx={pc.R * 1.3} ry={pc.ry * 1.3} />
              {:else if mustCapture && movable.has(pc.s)}
                <ellipse class="checkers-ring must" rx={pc.R * 1.3} ry={pc.ry * 1.3} />
              {/if}
              <ellipse class="checkers-piece-shadow" cx={pc.R * 0.15} cy={pc.ry * 0.12} rx={pc.R * 1.05} ry={pc.ry * 1.05} />
              {#each pc.layers as layer, i (i)}
                <path class="side" d={layer.side} />
                <ellipse class="face" cx={layer.tx} cy={layer.ty} rx={pc.R} ry={pc.ry} fill={`url(#${pc.piece.color === 'w' ? 'ck-gw' : 'ck-gr'})`} />
                <ellipse class="inner" cx={layer.tx} cy={layer.ty} rx={pc.R * 0.62} ry={pc.ry * 0.62} />
              {/each}
            </g>
          {/each}
        </g>
      </svg>
    {/if}
  </div>

  {#if !mobile}
    <div class="checkers-view">
      <span>Arrastra el tablero: de lado a lado lo giras y arriba o abajo lo inclinas.</span>
      <div class="checkers-seg" role="group" aria-label="Vista del tablero">
        <button type="button" aria-label="Girar a la izquierda" data-testid="checkers-rot-left" onclick={() => setView({ ...view, rot: view.rot - 45 })}>⟲</button>
        <button type="button" aria-label="Girar a la derecha" data-testid="checkers-rot-right" onclick={() => setView({ ...view, rot: view.rot + 45 })}>⟳</button>
        <button type="button" aria-label="Ver más desde arriba" data-testid="checkers-tilt-up" onclick={() => setView({ ...view, tilt: view.tilt + 10 })}>▲</button>
        <button type="button" aria-label="Ver más de lado" data-testid="checkers-tilt-down" onclick={() => setView({ ...view, tilt: view.tilt - 10 })}>▼</button>
        <button type="button" data-testid="checkers-reset-view" onclick={() => setView({ ...DEFAULT_VIEW })}>Restablecer</button>
      </div>
    </div>
  {/if}

  <footer class="checkers-foot">
    <span class="checkers-hint" class:warn={mustCapture || !!notice} data-testid="checkers-hint">{hint}</span>
    <div class="checkers-actions">
      <button type="button" class="checkers-btn" data-testid="checkers-undo" disabled={!history.length || thinking} onclick={undo}>Deshacer</button>
      {#if end}
        <button type="button" class="checkers-btn primary" data-testid="checkers-new" onclick={start}>Jugar otra</button>
      {:else}
        <button type="button" class="checkers-btn" data-testid="checkers-resign" onclick={() => (surrendered = true)}>Rendirse</button>
      {/if}
    </div>
  </footer>
  <p class="sr-only" role="status" data-testid="checkers-status">{announce}</p>
</div>
