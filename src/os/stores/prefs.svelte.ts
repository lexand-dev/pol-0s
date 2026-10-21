/**
 * Estado compartido de las preferencias: lo leen Ajustes y la barra de menú.
 * Cada cambio se aplica a <html> al momento y se intenta guardar; si no se puede, vale para la visita.
 */
import { DEFAULT_PREFS, applyPrefs, getStorage, loadPrefs, savePrefs, type Prefs } from '../../lib/prefs';

const DARK_QUERY = '(prefers-color-scheme: dark)';

class PrefsStore {
  current = $state<Prefs>({ ...DEFAULT_PREFS });
  /** Tema del sistema, para saber qué se ve cuando la preferencia es "Automático". */
  systemDark = $state(false);

  /** Tema que se está viendo de verdad. */
  isDark = $derived(this.current.theme === 'dark' || (this.current.theme === 'auto' && this.systemDark));

  /** Se llama una vez al montar el sistema. Devuelve la función de limpieza. */
  init(): () => void {
    this.current = loadPrefs(getStorage());
    applyPrefs(document.documentElement, this.current);
    const mq = matchMedia(DARK_QUERY);
    this.systemDark = mq.matches;
    const onChange = () => (this.systemDark = mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }

  set(patch: Partial<Prefs>) {
    this.current = { ...this.current, ...patch };
    applyPrefs(document.documentElement, this.current);
    savePrefs(getStorage(), this.current);
  }

  /** Conmutador de la barra de menú: pasa al tema contrario del que se ve. */
  toggleTheme() {
    this.set({ theme: this.isDark ? 'light' : 'dark' });
  }
}

export const prefs = new PrefsStore();
