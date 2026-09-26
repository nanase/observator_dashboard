// ローカル開発用の例示データを SQL で出力する。本番には使わない
//   node scripts/seed-local.mjs > .wrangler/seed.sql
//   bunx wrangler d1 execute DB --local --file .wrangler/seed.sql

const now = Math.floor(Date.now() / 1000);
const MIN = 60;
const DAY = 86400;
const JST = 9 * 3600;

// アドレスはローカル管理アドレス（02:...）の架空の値
const devices = [
  {
    id: 1,
    address: '02:00:00:00:00:01',
    kind: 'ESP32-Central',
    name: '居間',
    assetTag: 'C-01',
    icon: 'weekend',
    base: 24.5,
    amp: 1.8,
    hum: 55,
    co2: true,
    altitude: 380,
  },
  {
    id: 2,
    address: '02:00:00:00:00:02',
    kind: 'W3400010',
    name: '寝室',
    assetTag: 'T-01',
    icon: 'bed',
    base: 23.5,
    amp: 1.2,
    hum: 60,
    battery: 88,
  },
  {
    id: 3,
    address: '02:00:00:00:00:03',
    kind: 'W3400010',
    name: '書斎',
    assetTag: 'T-02',
    icon: 'desk',
    base: 25.5,
    amp: 2.0,
    hum: 50,
    battery: 64,
  },
  {
    id: 4,
    address: '02:00:00:00:00:04',
    kind: 'W3400010',
    name: '浴室',
    assetTag: 'T-03',
    icon: 'bathtub',
    base: 25,
    amp: 2.5,
    hum: 80,
    battery: 45,
  },
  {
    id: 5,
    address: '02:00:00:00:00:05',
    kind: 'W3400010',
    name: '屋外',
    icon: 'park',
    base: 21,
    amp: 4.5,
    hum: 75,
    battery: 92,
    staleMinutes: 18,
  },
  {
    id: 6,
    address: '02:00:00:00:00:06',
    kind: 'W3400010',
    name: '冷蔵庫',
    assetTag: 'T-05',
    icon: 'kitchen',
    base: 4,
    amp: 0.6,
    hum: 40,
    battery: 17,
    range: [0, 6],
  },
];

const hourOf = (t) => ((((t + JST) % DAY) + DAY) % DAY) / 3600;
const noise = (t, seed) => Math.sin(t / 1700 + seed) * 0.3 + Math.sin(t / 530 + seed * 3) * 0.1;

function reading(d, t) {
  const h = hourOf(t);
  const season = Math.cos((2 * Math.PI * ((t - now) / DAY)) / 365) * (d.name === '冷蔵庫' ? 0 : 3);
  const temperature = d.base + season + d.amp * Math.cos((2 * Math.PI * (h - 15)) / 24) + noise(t, d.id);
  const humidity = Math.min(
    99,
    Math.max(10, d.hum - 3 * Math.cos((2 * Math.PI * (h - 15)) / 24) + noise(t, d.id + 10) * 5),
  );
  const r = { temperature: +temperature.toFixed(2), humidity: +humidity.toFixed(1), rssi: -60 - d.id * 5 };
  if (d.co2) {
    r.co2 = Math.round(600 + 500 * Math.max(0, Math.sin((2 * Math.PI * (h - 13)) / 24)) + 40 * noise(t, 5));
    r.pressure = +(968 + 3 * Math.sin(t / (4.3 * DAY)) + 0.5 * Math.cos((2 * Math.PI * (h - 10)) / 12)).toFixed(2);
  }
  // 電池は日に 0.05% ずつ減ってきた扱いにする
  if (d.battery !== undefined) r.battery = Math.min(100, Math.round(d.battery + ((now - t) / DAY) * 0.05));
  return r;
}

const cols = ['temperature', 'humidity', 'pressure', 'co2', 'battery', 'rssi'];
const q = (v) => (v === undefined || v === null ? 'NULL' : typeof v === 'string' ? `'${v}'` : String(v));
const out = [
  'DELETE FROM devices;',
  'DELETE FROM readings_1m;',
  'DELETE FROM readings_10m;',
  'DELETE FROM readings_1d;',
  'DELETE FROM rollup_queue;',
];

function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += 200)
    out.push(`INSERT INTO ${table} VALUES ${rows.slice(i, i + 200).join(',')};`);
}

for (const d of devices) {
  const last = Math.floor(now / MIN) * MIN - (d.staleMinutes ?? 0) * MIN;
  const lr = { observedAt: last, ...reading(d, last) };
  out.push(
    `INSERT INTO devices (id, address, kind, status, name, asset_tag, icon, sort_order, hidden, altitude_m, temperature_min, temperature_max, first_seen_at, last_seen_at, last_reading, updated_at) VALUES (${d.id}, '${d.address}', '${d.kind}', 'active', '${d.name}', ${q(d.assetTag)}, '${d.icon}', ${d.id}, 0, ${q(d.altitude)}, ${q(d.range?.[0])}, ${q(d.range?.[1])}, ${now - 400 * DAY}, ${last}, '${JSON.stringify(lr)}', ${now});`,
  );

  const m1 = [];
  for (let t = Math.floor((now - 2 * DAY) / MIN) * MIN; t <= last; t += MIN) {
    const r = reading(d, t);
    m1.push(`(${d.id}, ${t}, ${cols.map((c) => q(r[c])).join(', ')})`);
  }
  insertRows('readings_1m', m1);

  const agg = (from, span, step) => {
    const values = {};
    for (const c of cols) values[c] = [];
    for (let t = from; t < from + span; t += step) {
      const r = reading(d, t);
      for (const c of cols) if (r[c] !== undefined) values[c].push(r[c]);
    }
    const parts = cols.flatMap((c) => {
      const v = values[c];
      if (!v.length) return ['NULL', 'NULL', 'NULL'];
      return [(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), Math.min(...v), Math.max(...v)];
    });
    return `(${d.id}, ${from}, ${Math.round(span / MIN)}, ${parts.join(', ')})`;
  };
  const m10 = [];
  for (let t = Math.floor((now - 60 * DAY) / 600) * 600; t + 600 <= now; t += 600) m10.push(agg(t, 600, 2 * MIN));
  insertRows('readings_10m', m10);
  const d1 = [];
  const today = Math.floor((now + JST) / DAY) * DAY - JST;
  for (let t = today - 400 * DAY; t < today; t += DAY) d1.push(agg(t, DAY, 30 * MIN));
  insertRows('readings_1d', d1);
}

console.log(out.join('\n'));
