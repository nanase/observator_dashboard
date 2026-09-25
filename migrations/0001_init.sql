-- 時刻はすべて UNIX 秒

CREATE TABLE devices (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ignored')),
  name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  altitude_m REAL,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL DEFAULT 0,
  last_reading TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX devices_status ON devices (status, sort_order);

CREATE TABLE readings_1m (
  device_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  temperature REAL,
  humidity REAL,
  pressure REAL,
  co2 REAL,
  battery REAL,
  rssi REAL,
  PRIMARY KEY (device_id, ts)
) WITHOUT ROWID;

CREATE TABLE readings_10m (
  device_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  n INTEGER NOT NULL,
  temperature_avg REAL, temperature_min REAL, temperature_max REAL,
  humidity_avg REAL, humidity_min REAL, humidity_max REAL,
  pressure_avg REAL, pressure_min REAL, pressure_max REAL,
  co2_avg REAL, co2_min REAL, co2_max REAL,
  battery_avg REAL, battery_min REAL, battery_max REAL,
  rssi_avg REAL, rssi_min REAL, rssi_max REAL,
  PRIMARY KEY (device_id, ts)
) WITHOUT ROWID;

-- ts は JST 0 時
CREATE TABLE readings_1d (
  device_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  n INTEGER NOT NULL,
  temperature_avg REAL, temperature_min REAL, temperature_max REAL,
  humidity_avg REAL, humidity_min REAL, humidity_max REAL,
  pressure_avg REAL, pressure_min REAL, pressure_max REAL,
  co2_avg REAL, co2_min REAL, co2_max REAL,
  battery_avg REAL, battery_min REAL, battery_max REAL,
  rssi_avg REAL, rssi_min REAL, rssi_max REAL,
  PRIMARY KEY (device_id, ts)
) WITHOUT ROWID;

-- 集計し直すべきバケット。遅れて届いた値も拾うため、受信のたびに積む
CREATE TABLE rollup_queue (
  granularity TEXT NOT NULL CHECK (granularity IN ('10m', '1d')),
  device_id INTEGER NOT NULL,
  bucket_ts INTEGER NOT NULL,
  PRIMARY KEY (granularity, device_id, bucket_ts)
) WITHOUT ROWID;
