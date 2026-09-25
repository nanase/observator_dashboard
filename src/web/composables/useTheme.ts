import { readonly, ref } from 'vue';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'observator.theme';
// 押すたびに デバイスの設定 → ライト → ダーク の順に切り替える
const ORDER: ThemeMode[] = ['system', 'light', 'dark'];

function load(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return ORDER.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
  } catch {
    return 'system';
  }
}

const mode = ref<ThemeMode>(load());

function apply() {
  const root = document.documentElement;
  if (mode.value === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode.value);
}

// 描画前に呼び、読み込み直後に配色がちらつかないようにする
export function applyStoredTheme() {
  apply();
}

export function useTheme() {
  function cycle() {
    mode.value = ORDER[(ORDER.indexOf(mode.value) + 1) % ORDER.length];
    try {
      localStorage.setItem(STORAGE_KEY, mode.value);
    } catch {
      // 保存できなくても、この画面を開いている間は切り替わる
    }
    apply();
  }
  return { mode: readonly(mode), cycle };
}
