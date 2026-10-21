/**
 * Catálogo del Stack (M-05): qué dependencias, lenguajes y archivos cuentan como cada herramienta. Lo que no está aquí
 * no aparece en la ventana, así no salen librerías menores. Lo usa scripts/actualizar-stack.mjs sin compilar, así que
 * solo lleva sintaxis que Node ejecuta tal cual.
 */

export const CATEGORIES = [
  { id: 'lenguajes', label: 'Lenguajes' },
  { id: 'interfaz', label: 'Interfaz' },
  { id: 'escritorio', label: 'Escritorio' },
  { id: 'datos', label: 'Datos y servidor' },
  { id: 'ia', label: 'IA' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'publicacion', label: 'Publicación' },
  { id: 'calidad', label: 'Calidad' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export interface ToolDef {
  id: string;
  name: string;
  category: CategoryId;
  /** Nombres exactos de dependencias de `package.json`. Las de Cargo van como `cargo:nombre`. */
  deps?: string[];
  /** Prefijos de dependencias (`@radix-ui/` cubre todos sus paquetes). */
  depPrefixes?: string[];
  /** Lenguajes de GitHub. Cuenta si superan el 5 % del código del repositorio. */
  languages?: string[];
  /** Archivos que delatan la herramienta: la ruta completa, o el nombre en cualquier carpeta. */
  files?: string[];
  /**
   * Año en que la herramienta existió por primera vez. El año que se enseña no puede ser anterior: un repositorio de 2023
   * puede haber recibido un `CLAUDE.md` en 2026, pero Claude Code no existía en 2023.
   */
  introduced?: number;
}

export const TOOLS: readonly ToolDef[] = [
  // Lenguajes
  { id: 'typescript', name: 'TypeScript', category: 'lenguajes', languages: ['TypeScript'], deps: ['typescript'] },
  { id: 'javascript', name: 'JavaScript', category: 'lenguajes', languages: ['JavaScript'] },
  { id: 'html-css', name: 'HTML y CSS', category: 'lenguajes', languages: ['HTML', 'CSS'] },
  { id: 'python', name: 'Python', category: 'lenguajes', languages: ['Python'] },
  { id: 'rust', name: 'Rust', category: 'lenguajes', languages: ['Rust'], deps: ['cargo:tauri'] },
  { id: 'swift', name: 'Swift', category: 'lenguajes', languages: ['Swift'] },
  { id: 'sql', name: 'SQL (Postgres)', category: 'lenguajes', languages: ['PLpgSQL'] },
  // Interfaz
  { id: 'react', name: 'React', category: 'interfaz', deps: ['react', 'react-dom'] },
  { id: 'nextjs', name: 'Next.js', category: 'interfaz', deps: ['next'] },
  { id: 'astro', name: 'Astro', category: 'interfaz', deps: ['astro'], languages: ['Astro'] },
  { id: 'svelte', name: 'Svelte', category: 'interfaz', deps: ['svelte', '@sveltejs/kit'], languages: ['Svelte'] },
  { id: 'vite', name: 'Vite', category: 'interfaz', deps: ['vite'] },
  { id: 'tailwind', name: 'Tailwind CSS', category: 'interfaz', deps: ['tailwindcss'] },
  { id: 'shadcn', name: 'shadcn/ui', category: 'interfaz', files: ['components.json'], introduced: 2023 },
  { id: 'radix', name: 'Radix UI', category: 'interfaz', depPrefixes: ['@radix-ui/'] },
  { id: 'threejs', name: 'Three.js', category: 'interfaz', deps: ['three'] },
  { id: 'tanstack', name: 'TanStack', category: 'interfaz', depPrefixes: ['@tanstack/'], introduced: 2022 },
  // Escritorio
  { id: 'tauri', name: 'Tauri', category: 'escritorio', deps: ['@tauri-apps/cli', '@tauri-apps/api', 'cargo:tauri'], introduced: 2022 },
  // Datos y servidor
  { id: 'supabase', name: 'Supabase', category: 'datos', deps: ['@supabase/supabase-js', '@supabase/ssr'], files: ['supabase/config.toml'] },
  { id: 'cloudflare', name: 'Cloudflare Workers', category: 'datos', deps: ['wrangler', '@cloudflare/workers-types'], files: ['wrangler.jsonc', 'wrangler.toml', 'wrangler.json'] },
  { id: 'hono', name: 'Hono', category: 'datos', deps: ['hono'], introduced: 2022 },
  { id: 'upstash', name: 'Upstash', category: 'datos', depPrefixes: ['@upstash/'] },
  { id: 'zod', name: 'Zod', category: 'datos', deps: ['zod'] },
  // IA
  { id: 'claude-code', name: 'Claude Code', category: 'ia', files: ['CLAUDE.md'], introduced: 2025 },
  { id: 'anthropic', name: 'SDK de Anthropic', category: 'ia', deps: ['@anthropic-ai/sdk'], introduced: 2023 },
  { id: 'mcp', name: 'MCP', category: 'ia', deps: ['@modelcontextprotocol/sdk', 'mcp-handler'], introduced: 2024 },
  { id: 'vercel-ai', name: 'Vercel AI SDK', category: 'ia', deps: ['ai'], depPrefixes: ['@ai-sdk/'], introduced: 2023 },
  { id: 'openai', name: 'SDK de OpenAI', category: 'ia', deps: ['openai'] },
  { id: 'elevenlabs', name: 'ElevenLabs', category: 'ia', deps: ['elevenlabs'], depPrefixes: ['@elevenlabs/'] },
  // Servicios
  { id: 'resend', name: 'Resend', category: 'servicios', deps: ['resend'], introduced: 2023 },
  { id: 'twilio', name: 'Twilio', category: 'servicios', deps: ['twilio'] },
  { id: 'stripe', name: 'Stripe', category: 'servicios', deps: ['stripe'] },
  { id: 'liveblocks', name: 'Liveblocks', category: 'servicios', depPrefixes: ['@liveblocks/'] },
  { id: 'mapbox', name: 'Mapbox', category: 'servicios', deps: ['mapbox-gl'] },
  // Publicación
  { id: 'vercel', name: 'Vercel', category: 'publicacion', deps: ['@vercel/analytics', '@vercel/speed-insights'], files: ['vercel.json'] },
  { id: 'pnpm', name: 'pnpm', category: 'publicacion', files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'] },
  { id: 'github-actions', name: 'GitHub Actions', category: 'publicacion', files: ['.github/workflows'] },
  // Calidad
  { id: 'vitest', name: 'Vitest', category: 'calidad', deps: ['vitest'], introduced: 2022 },
  { id: 'playwright', name: 'Playwright', category: 'calidad', deps: ['@playwright/test', 'playwright'] },
  { id: 'eslint', name: 'ESLint', category: 'calidad', deps: ['eslint'] },
];
