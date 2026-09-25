<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useNow } from './composables/useNow';
import { useObservations } from './composables/useObservations';
import { useTheme } from './composables/useTheme';
import { formatAgo, formatDateLong, formatTime } from './lib/format';
import { icons } from './lib/icons';
import { STALE_SECONDS } from './lib/status';

const route = useRoute();
const now = useNow();
const { latest, shownDevices, fetchedAt, error, sessionExpired } = useObservations();
const theme = useTheme();

const THEME_LABELS = { system: 'デバイスの設定', light: 'ライト', dark: 'ダーク' } as const;
const THEME_ICONS = { system: 'contrast', light: 'light-mode', dark: 'dark-mode' } as const;

const receiving = computed(() => shownDevices.value.filter((d) => now.value - d.lastSeenAt <= STALE_SECONDS).length);

const bare = computed(() => route.meta.bare === true);
const pendingCount = computed(() => latest.value?.pendingCount ?? 0);

function relogin() {
  location.reload();
}
</script>

<template>
  <div v-if="sessionExpired" class="session" role="alert">
    <component :is="icons.warning" />
    ログインの有効期限が切れました。
    <button type="button" class="btn filled" @click="relogin">ログインし直す</button>
  </div>

  <RouterView v-if="bare" />

  <div v-else class="wrap">
    <div class="app">
      <header class="topbar">
        <RouterLink to="/" class="brand">
          <span class="logo" aria-hidden="true"><component :is="icons.sensors" /></span>
          <h1>Observator</h1>
        </RouterLink>
        <div class="clock">
          <span class="date">{{ formatDateLong(now) }}</span>
          <span class="time">{{ formatTime(now) }}</span>
          <span v-if="fetchedAt" class="ago" title="最終更新"
            ><component :is="icons.update" />{{ formatAgo(now - fetchedAt) }}</span
          >
          <span v-if="shownDevices.length" class="ago" title="受信中のデバイス">
            <i class="dot" :class="{ warn: receiving < shownDevices.length }" aria-hidden="true"></i>
            受信 {{ receiving }} / {{ shownDevices.length }} 台
          </span>
        </div>
        <div class="actions">
          <button
            type="button"
            class="icon-btn"
            :aria-label="`テーマ: ${THEME_LABELS[theme.mode.value]}（押すと切り替え）`"
            :title="`テーマ: ${THEME_LABELS[theme.mode.value]}`"
            @click="theme.cycle"
          >
            <component :is="icons[THEME_ICONS[theme.mode.value]]" />
          </button>
          <RouterLink
            to="/devices"
            class="icon-btn"
            :aria-label="pendingCount ? `承認待ちのデバイス ${pendingCount} 台` : 'デバイスの管理'"
            :title="pendingCount ? `承認待ち ${pendingCount} 台` : '承認待ちはありません'"
          >
            <component :is="icons['how-to-reg']" />
            <span v-if="pendingCount" class="badge">{{ pendingCount }}</span>
          </RouterLink>
        </div>
      </header>
      <nav class="tabs" aria-label="画面">
        <RouterLink to="/" :aria-current="route.path === '/' ? 'page' : undefined">
          <component :is="icons.dashboard" />ダッシュボード
        </RouterLink>
        <RouterLink to="/charts" :aria-current="route.path === '/charts' ? 'page' : undefined">
          <component :is="icons['show-chart']" />グラフ
        </RouterLink>
        <RouterLink to="/devices" :aria-current="route.path === '/devices' ? 'page' : undefined">
          <component :is="icons.devices" />デバイス
        </RouterLink>
        <RouterLink to="/mini"><component :is="icons.smartphone" />ミニマル</RouterLink>
      </nav>
      <main class="content">
        <p v-if="error" class="error">最新の値を取得できませんでした（{{ error }}）。30 秒後に再試行します。</p>
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px;
}
@media (max-width: 599px) {
  .wrap {
    padding: 0;
  }
  .app {
    border-radius: 0 !important;
  }
}
.app {
  background: var(--surface);
  border-radius: 24px;
  border: 1px solid var(--card-border);
  min-height: calc(100vh - 32px);
}
.topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 16px 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}
.logo {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--primary-container);
  color: var(--on-primary-container);
  font-size: 24px;
}
.brand h1 {
  font-size: 22px;
  font-weight: 500;
}
.clock {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-left: auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.date {
  color: var(--on-surface-variant);
  font-size: 13px;
}
.time {
  font-size: 22px;
  font-weight: 500;
}
.ago {
  color: var(--on-surface-variant);
  font-size: 13px;
  white-space: nowrap;
}
/* アイコンは文字のベースラインに載せ、ほかの要素と高さをそろえる */
.ago svg {
  font-size: 15px;
  vertical-align: -2px;
  margin-right: 4px;
}
.actions {
  display: flex;
  align-items: center;
}
.ago .dot {
  width: 8px;
  height: 8px;
  vertical-align: 0;
  margin-right: 6px;
}
.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--error);
  color: var(--on-primary);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}
@media (max-width: 599px) {
  .clock {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    margin-left: 0;
    padding: 0 0 4px 52px;
    gap: 8px;
  }
  .time {
    font-size: 18px;
  }
  .actions {
    margin-left: auto;
  }
}
.tabs {
  display: flex;
  gap: 4px;
  padding: 4px 16px 0;
  border-bottom: 1px solid var(--hairline);
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 12px 10px;
  text-decoration: none;
  color: var(--on-surface-variant);
  font-weight: 500;
  font-size: 14px;
  border-bottom: 3px solid transparent;
  border-radius: 3px 3px 0 0;
  white-space: nowrap;
}
.tabs a svg {
  font-size: 18px;
}
.tabs a[aria-current='page'] {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.tabs a:hover {
  background: var(--state-hover);
}
.content {
  padding: 16px;
}
@media (min-width: 720px) {
  .content {
    padding: 20px 24px 24px;
  }
}
.error {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--error-container);
  color: var(--on-error-container);
}
.session {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 12px;
  padding: 10px 16px;
  background: var(--error-container);
  color: var(--on-error-container);
}
.session svg {
  font-size: 20px;
}
</style>
