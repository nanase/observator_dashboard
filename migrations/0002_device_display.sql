-- 画面でデバイスを見分けるためのアイコン。NULL は種別ごとの既定
ALTER TABLE devices ADD COLUMN icon TEXT;

-- 温度の適正範囲（℃）。どちらか片方だけでもよく、NULL は範囲なし
ALTER TABLE devices ADD COLUMN temperature_min REAL;
ALTER TABLE devices ADD COLUMN temperature_max REAL;
