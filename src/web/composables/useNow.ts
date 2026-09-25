import { readonly, ref } from 'vue';

const now = ref(Math.floor(Date.now() / 1000));
let timer: ReturnType<typeof setInterval> | undefined;

// 経過時間の表示に使う現在時刻（UNIX 秒）。画面全体で 1 つのタイマーを共有する
export function useNow() {
  timer ??= setInterval(() => {
    now.value = Math.floor(Date.now() / 1000);
  }, 1000);
  return readonly(now);
}
