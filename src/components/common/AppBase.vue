<script setup lang="ts">
import { ref, useSlots } from 'vue';
import { ThemeToggleButton } from '@nanase/alnilam';

const { toolbarTitle } = defineProps<{
  toolbarTitle?: string;
}>();

const drawerOpened = ref<boolean>();
const errorSnackbar = ref<boolean>();

defineExpose({
  showErrorSnackbar: function () {
    errorSnackbar.value = true;
  },
  closeErrorSnackbar: function () {
    errorSnackbar.value = false;
  },
});
</script>

<template>
  <v-app>
    <slot name="drawer" opened="drawerOpened"></slot>

    <v-snackbar v-model="errorSnackbar" timeout="10000">
      <slot name="errorSnackbar">データの読み込みができませんでした。しばらくしてから再読み込みしてください。</slot>
      <template #actions>
        <v-btn color="red-lighten-2" variant="text" @click="errorSnackbar = false">閉じる</v-btn>
      </template>
    </v-snackbar>

    <v-main>
      <v-app-bar flat floating density="compact">
        <slot name="appbarPrepend"></slot>
        <v-app-bar-nav-icon
          v-if="useSlots()['drawer']"
          variant="text"
          @click.stop="drawerOpened = !drawerOpened"
          aria-label="ナビゲーションを表示"
        />
        <v-toolbar-title>{{ toolbarTitle }}</v-toolbar-title>
        <slot name="appbarAppend"></slot>
        <template #append>
          <slot name="toolbarPrepend"></slot>
          <ThemeToggleButton />
          <slot name="toolbarAppend"></slot>
        </template>
      </v-app-bar>

      <slot name="header"></slot>

      <v-container>
        <slot></slot>
      </v-container>

      <slot name="footer"></slot>
    </v-main>
  </v-app>
</template>
