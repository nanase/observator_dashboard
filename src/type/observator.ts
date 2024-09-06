export type SensorType = 'temperature' | 'humidity' | 'pressure' | 'co2' | 'battery' | 'rssi';
export type ObservatorType = 'W3200010' | 'ESP32-Central';

export interface SensorValue<T extends SensorType> {
  type: T;
  name?: string;
  value: number;
  unit: string;
  precision: number;
}

export interface Observator {
  address: string;
  type: ObservatorType;
  sequence: number;
  fetchedAt: number;
  sensor: SensorValue<SensorType>[];
}

export interface ObservatorW3200010 extends Observator {
  type: 'W3200010';
  sensor: [SensorValue<'temperature'>, SensorValue<'humidity'>, SensorValue<'battery'>, SensorValue<'rssi'>];
}

export interface ObservatorESP32Central extends Observator {
  type: 'ESP32-Central';
  sensor: [
    SensorValue<'temperature'>,
    SensorValue<'humidity'>,
    SensorValue<'pressure'>,
    SensorValue<'co2'>,
    SensorValue<'rssi'>,
  ];
}

export interface ObservationResultContainer {
  sequence: number;
  result: Observator[];
}

export interface ObservatorItem {
  address: string;
  name: string;
  result?: Observator;
  hidden?: boolean;
}
