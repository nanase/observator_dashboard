-- 本体に貼った管理番号。名前や ID とは別に持つ。NULL は未設定
ALTER TABLE devices ADD COLUMN asset_tag TEXT;
