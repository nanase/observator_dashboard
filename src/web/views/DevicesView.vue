<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { Device, DevicePatch, DeviceStatus } from '../../shared/api';
import { DEVICE_ICONS } from '../../shared/icons';
import DraftInput from '../components/DraftInput.vue';
import ReceptionStatus from '../components/ReceptionStatus.vue';
import { handleApiError, invalidateObservations } from '../composables/useObservations';
import { api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { deviceIcon, icons } from '../lib/icons';
import { formatTemperatureRange } from '../lib/range';
import { isCentral, kindLabel } from '../lib/status';

const devices = ref<Device[]>([]);
const loaded = ref(false);
const error = ref<string | null>(null);
const saved = ref<number | null>(null);
const editing = ref<number | null>(null);

async function load() {
  try {
    devices.value = await api.devices();
    loaded.value = true;
  } catch (e) {
    error.value = handleApiError(e);
  }
}
onMounted(load);

const byStatus = (status: DeviceStatus) =>
  devices.value.filter((d) => d.status === status).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
const pending = computed(() => byStatus('pending'));
const active = computed(() => byStatus('active'));
const ignored = computed(() => byStatus('ignored'));

async function save(device: Device, patch: DevicePatch) {
  const updated = await api.updateDevice(device.id, patch);
  devices.value = devices.value.map((d) => (d.id === updated.id ? updated : d));
}

function showSaved(id: number) {
  saved.value = id;
  setTimeout(() => {
    if (saved.value === id) saved.value = null;
  }, 2000);
}

async function update(device: Device, patch: DevicePatch): Promise<boolean> {
  try {
    await save(device, patch);
    error.value = null;
    showSaved(device.id);
    await invalidateObservations();
    return true;
  } catch (e) {
    error.value = handleApiError(e);
    return false;
  }
}

// 承認したデバイスは末尾に並べる
function approve(device: Device) {
  const last = Math.max(-1, ...active.value.map((d) => d.sortOrder));
  return update(device, { status: 'active', sortOrder: last + 1 });
}

async function move(device: Device, offset: -1 | 1) {
  const list = [...active.value];
  const i = list.findIndex((d) => d.id === device.id);
  const j = i + offset;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  try {
    // 並び順を 0 から振り直し、変わったものだけを保存する
    for (const [index, d] of list.entries()) {
      if (d.sortOrder !== index) await save(d, { sortOrder: index });
    }
    error.value = null;
    showSaved(device.id);
    await invalidateObservations();
  } catch (e) {
    error.value = handleApiError(e);
    await load();
  }
}

const parseNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value));

async function updateText(device: Device, key: 'name' | 'assetTag', value: string): Promise<boolean> {
  const text = value.trim();
  return update(device, { [key]: text === '' ? null : text });
}

async function updateNumber(
  device: Device,
  key: 'altitudeM' | 'temperatureMin' | 'temperatureMax',
  value: string,
): Promise<boolean> {
  const number = parseNumber(value);
  if (number !== null && !Number.isFinite(number)) {
    error.value = '数値を入力してください';
    return false;
  }
  return update(device, { [key]: number });
}

const summary = (d: Device) => {
  const r = d.lastReading;
  if (!r) return '受信なし';
  return [
    r.temperature != null ? `${formatNumber(r.temperature, 1)}℃` : null,
    r.humidity != null ? `${formatNumber(r.humidity, 0)}%` : null,
    r.co2 != null ? `CO2 ${formatNumber(r.co2, 0)} ppm` : null,
    r.battery != null ? `電池 ${r.battery}%` : null,
  ]
    .filter(Boolean)
    .join('・');
};
</script>

<template>
  <div class="devices">
    <p v-if="error" class="error">{{ error }}</p>

    <section v-if="pending.length" class="group">
      <h2>承認待ち</h2>
      <p class="lead">
        近くにある同じ機種も検出されます。自分のデバイスだけを承認してください。承認するまで観測値は記録されません。
      </p>
      <article v-for="d in pending" :key="d.id" class="panel row">
        <span class="avatar"><component :is="deviceIcon(d.icon, isCentral(d.kind))" /></span>
        <div class="ttl">
          <h3>{{ d.address }}</h3>
          <p class="sub">{{ kindLabel(d.kind) }}・{{ summary(d) }}</p>
        </div>
        <ReceptionStatus :last-seen-at="d.lastSeenAt" />
        <div class="actions">
          <button type="button" class="btn" @click="update(d, { status: 'ignored' })">無視する</button>
          <button type="button" class="btn filled" @click="approve(d)"><component :is="icons.check" />承認する</button>
        </div>
      </article>
    </section>

    <section class="group">
      <h2>デバイス</h2>
      <p v-if="loaded && active.length === 0" class="lead">承認済みのデバイスはまだありません。</p>
      <article v-for="(d, index) in active" :key="d.id" class="panel device" :class="{ hidden: d.hidden }">
        <div class="row">
          <span class="avatar"><component :is="deviceIcon(d.icon, isCentral(d.kind))" /></span>
          <div class="ttl">
            <h3>
              {{ d.name ?? d.address }}
              <span v-if="d.assetTag" class="asset-tag">{{ d.assetTag }}</span>
              <span v-if="d.hidden" class="tag"><component :is="icons['visibility-off']" />非表示</span>
              <span v-if="saved === d.id" class="tag ok"><component :is="icons.check" />保存しました</span>
            </h3>
            <p class="sub">
              {{ kindLabel(d.kind) }}・{{ summary(d) }}
              <template v-if="formatTemperatureRange(d.temperatureMin, d.temperatureMax)">
                ・適正 {{ formatTemperatureRange(d.temperatureMin, d.temperatureMax) }}
              </template>
            </p>
          </div>
          <ReceptionStatus :last-seen-at="d.lastSeenAt" />
          <div class="actions">
            <button type="button" class="icon-btn" aria-label="上へ" :disabled="index === 0" @click="move(d, -1)">
              <component :is="icons['expand-less']" />
            </button>
            <button
              type="button"
              class="icon-btn"
              aria-label="下へ"
              :disabled="index === active.length - 1"
              @click="move(d, 1)"
            >
              <component :is="icons['expand-more']" />
            </button>
            <button
              type="button"
              class="btn"
              :aria-expanded="editing === d.id"
              @click="editing = editing === d.id ? null : d.id"
            >
              {{ editing === d.id ? '閉じる' : '設定' }}
            </button>
          </div>
        </div>

        <div v-if="editing === d.id" class="edit">
          <div class="grid">
            <label class="field">
              名前
              <DraftInput
                :id="`name-${d.id}`"
                type="text"
                maxlength="64"
                :value="d.name ?? ''"
                :placeholder="d.address"
                :save="(v) => updateText(d, 'name', v)"
              />
            </label>
            <label class="field">
              管理番号
              <DraftInput
                :id="`tag-${d.id}`"
                type="text"
                maxlength="32"
                :value="d.assetTag ?? ''"
                placeholder="なし"
                :save="(v) => updateText(d, 'assetTag', v)"
              />
            </label>
            <label class="field">
              温度の適正範囲 下限（℃）
              <DraftInput
                :id="`tmin-${d.id}`"
                type="number"
                step="0.1"
                :value="String(d.temperatureMin ?? '')"
                placeholder="なし"
                :save="(v) => updateNumber(d, 'temperatureMin', v)"
              />
            </label>
            <label class="field">
              温度の適正範囲 上限（℃）
              <DraftInput
                :id="`tmax-${d.id}`"
                type="number"
                step="0.1"
                :value="String(d.temperatureMax ?? '')"
                placeholder="なし"
                :save="(v) => updateNumber(d, 'temperatureMax', v)"
              />
            </label>
            <label v-if="isCentral(d.kind) || d.lastReading?.pressure != null" class="field">
              設置場所の標高（m）
              <DraftInput
                :id="`alt-${d.id}`"
                type="number"
                step="0.1"
                :value="String(d.altitudeM ?? '')"
                placeholder="未設定"
                :save="(v) => updateNumber(d, 'altitudeM', v)"
              />
            </label>
          </div>
          <p class="hint">適正範囲は、片方だけでも設定できます。空欄にすると範囲なしになります。</p>

          <div class="field">
            アイコン
            <div class="icons" role="radiogroup" aria-label="アイコン">
              <button
                v-for="name in DEVICE_ICONS"
                :key="name"
                type="button"
                class="icon-choice"
                role="radio"
                :aria-checked="(d.icon ?? (isCentral(d.kind) ? 'sensors' : 'thermostat')) === name"
                :aria-label="name"
                @click="update(d, { icon: name })"
              >
                <component :is="icons[name]" />
              </button>
            </div>
          </div>

          <div class="edit-actions">
            <button type="button" class="btn" @click="update(d, { hidden: !d.hidden })">
              <component :is="d.hidden ? icons.visibility : icons['visibility-off']" />
              {{ d.hidden ? 'ダッシュボードに表示する' : 'ダッシュボードで非表示にする' }}
            </button>
            <button type="button" class="btn" @click="update(d, { status: 'ignored' })">記録をやめる（無視）</button>
          </div>
          <p class="hint">
            非表示にしても記録は続きます。無視すると、以後の観測値は記録されません。アドレス {{ d.address }}
          </p>
        </div>
      </article>
    </section>

    <section v-if="ignored.length" class="group">
      <h2>無視しているデバイス</h2>
      <article v-for="d in ignored" :key="d.id" class="panel row">
        <span class="avatar"><component :is="deviceIcon(d.icon, isCentral(d.kind))" /></span>
        <div class="ttl">
          <h3>
            {{ d.name ?? d.address }}<span v-if="d.assetTag" class="asset-tag">{{ d.assetTag }}</span>
          </h3>
          <p class="sub">{{ kindLabel(d.kind) }}・{{ d.address }}</p>
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="approve(d)">承認に戻す</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.devices {
  display: grid;
  gap: 28px;
}
.group {
  display: grid;
  gap: 12px;
}
.group h2 {
  font-size: 18px;
  font-weight: 500;
}
.lead,
.hint {
  font-size: 13px;
  color: var(--on-surface-variant);
}
.error {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--error-container);
  color: var(--on-error-container);
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.device {
  display: grid;
  gap: 12px;
}
.device.hidden .avatar,
.device.hidden h3 {
  opacity: 0.6;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: none;
  background: var(--secondary-container);
  color: var(--on-secondary-container);
  font-size: 22px;
}
.ttl {
  min-width: 0;
  flex: 1 1 200px;
}
.ttl h3 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 16px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.sub {
  font-size: 12px;
  color: var(--on-surface-variant);
}
.asset-tag {
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--on-surface-variant);
}
.tag.ok {
  color: var(--dot-ok);
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px 8px;
  margin-left: auto;
}
.edit {
  display: grid;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--hairline);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  gap: 12px;
}
.icons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.icon-choice {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--outline-variant);
  background: transparent;
  display: grid;
  place-items: center;
  font-size: 22px;
  cursor: pointer;
  color: var(--on-surface-variant);
}
.icon-choice:hover {
  background: var(--state-hover);
}
.icon-choice[aria-checked='true'] {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
  border-color: transparent;
}
.edit-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
</style>
