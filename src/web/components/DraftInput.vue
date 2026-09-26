<script setup lang="ts">
// 入力中の文字を手元に持つ入力欄。確定（フォーカスを外す、Enter）したときだけ保存する。
// 保存した値が画面の再描画で書き戻されても、入力中の文字は消えない
import { nextTick, ref, watch } from 'vue';

// save は保存できたら true を返す
const props = defineProps<{ value: string; save: (value: string) => Promise<boolean> }>();

// type="number" の欄では、v-model が数値に変えて返す
const draft = ref<string | number>(props.value);
const editing = ref(false);
let saving = false;

// 保存が済んで値が変わったら、入力中でなければ表示を合わせる
watch(
  () => props.value,
  (value) => {
    if (!editing.value) draft.value = value;
  },
);

async function commit() {
  const sent = String(draft.value);
  if (saving || sent === props.value) return;
  saving = true;
  let saved = false;
  try {
    saved = await props.save(sent);
  } finally {
    saving = false;
  }
  // 前後の空白を除くなど、保存した値が整えられていれば、それに合わせる。失敗したら入力を残す
  await nextTick();
  if (saved && String(draft.value) === sent) draft.value = props.value;
}

function blur() {
  editing.value = false;
  commit();
}
</script>

<template>
  <input v-model="draft" @focus="editing = true" @blur="blur" @keydown.enter="commit" />
</template>
