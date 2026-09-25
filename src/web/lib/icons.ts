// 使うアイコンだけを読み込む（Material Symbols の輪郭線・角丸）
import IThermostat from '~icons/material-symbols/thermostat-outline-rounded';
import ISensors from '~icons/material-symbols/sensors-outline-rounded';
import IWeekend from '~icons/material-symbols/weekend-outline-rounded';
import ILiving from '~icons/material-symbols/living-outline-rounded';
import IBed from '~icons/material-symbols/bed-outline-rounded';
import IBedroomParent from '~icons/material-symbols/bedroom-parent-outline-rounded';
import IChildCare from '~icons/material-symbols/child-care-outline-rounded';
import IDesk from '~icons/material-symbols/desk-outline-rounded';
import IChair from '~icons/material-symbols/chair-outline-rounded';
import IKitchen from '~icons/material-symbols/kitchen-outline-rounded';
import IBathtub from '~icons/material-symbols/bathtub-outline-rounded';
import IShower from '~icons/material-symbols/shower-outline-rounded';
import IAcUnit from '~icons/material-symbols/ac-unit-outline-rounded';
import IDoorFront from '~icons/material-symbols/door-front-outline-rounded';
import IGarage from '~icons/material-symbols/garage-outline-rounded';
import IHome from '~icons/material-symbols/home-outline-rounded';
import ICottage from '~icons/material-symbols/cottage-outline-rounded';
import IPark from '~icons/material-symbols/park-outline-rounded';
import IYard from '~icons/material-symbols/yard-outline-rounded';
import INestEcoLeaf from '~icons/material-symbols/nest-eco-leaf-outline-rounded';
import IHumidity from '~icons/material-symbols/humidity-percentage-outline-rounded';
import ICo2 from '~icons/material-symbols/co2-outline-rounded';
import ISpeed from '~icons/material-symbols/speed-outline-rounded';
import IDewPoint from '~icons/material-symbols/dew-point-outline-rounded';
import IWaterDrop from '~icons/material-symbols/water-drop-outline-rounded';
import IMood from '~icons/material-symbols/mood-outline-rounded';
import IPower from '~icons/material-symbols/power-outline-rounded';
import IBatteryAlert from '~icons/material-symbols/battery-alert-outline-rounded';
import IBatteryFull from '~icons/material-symbols/battery-full-outline-rounded';
import IBattery1 from '~icons/material-symbols/battery-1-bar-outline-rounded';
import IBattery2 from '~icons/material-symbols/battery-2-bar-outline-rounded';
import IBattery3 from '~icons/material-symbols/battery-3-bar-outline-rounded';
import IBattery4 from '~icons/material-symbols/battery-4-bar-outline-rounded';
import IBattery5 from '~icons/material-symbols/battery-5-bar-outline-rounded';
import IBattery6 from '~icons/material-symbols/battery-6-bar-outline-rounded';
import IWifi4 from '~icons/material-symbols/network-wifi-outline-rounded';
import IWifi3 from '~icons/material-symbols/network-wifi-3-bar-outline-rounded';
import IWifi2 from '~icons/material-symbols/network-wifi-2-bar-outline-rounded';
import IWifi1 from '~icons/material-symbols/network-wifi-1-bar-outline-rounded';
import ISignal3 from '~icons/material-symbols/signal-cellular-alt-outline-rounded';
import ISignal2 from '~icons/material-symbols/signal-cellular-alt-2-bar-outline-rounded';
import ISignal1 from '~icons/material-symbols/signal-cellular-alt-1-bar-outline-rounded';
import ICloudOff from '~icons/material-symbols/cloud-off-outline-rounded';
import IWarning from '~icons/material-symbols/warning-rounded';
import ICheckCircle from '~icons/material-symbols/check-circle-rounded';
import IHowToReg from '~icons/material-symbols/how-to-reg-outline-rounded';
import IDashboard from '~icons/material-symbols/dashboard-outline-rounded';
import IShowChart from '~icons/material-symbols/show-chart-outline-rounded';
import ISmartphone from '~icons/material-symbols/smartphone-outline';
import IDevices from '~icons/material-symbols/devices-outline-rounded';
import IUpdate from '~icons/material-symbols/update-outline-rounded';
import IArrowUpward from '~icons/material-symbols/arrow-upward-outline-rounded';
import IArrowDownward from '~icons/material-symbols/arrow-downward-outline-rounded';
import ICheck from '~icons/material-symbols/check-outline-rounded';
import IClose from '~icons/material-symbols/close-outline-rounded';
import IExpandLess from '~icons/material-symbols/expand-less-rounded';
import IExpandMore from '~icons/material-symbols/expand-more-rounded';
import IVisibility from '~icons/material-symbols/visibility-outline-rounded';
import IVisibilityOff from '~icons/material-symbols/visibility-off-outline-rounded';
import IUpload from '~icons/material-symbols/upload-outline-rounded';
import IThermometer from '~icons/material-symbols/device-thermostat-rounded';
import IOpenInNew from '~icons/material-symbols/open-in-new-outline-rounded';

import IContrast from '~icons/material-symbols/contrast-rounded';
import ILightMode from '~icons/material-symbols/light-mode-outline-rounded';
import IDarkMode from '~icons/material-symbols/dark-mode-outline-rounded';

import type { Component } from 'vue';
import type { DeviceIcon } from '../../shared/icons';

export const icons = {
  thermostat: IThermostat,
  sensors: ISensors,
  weekend: IWeekend,
  living: ILiving,
  bed: IBed,
  'bedroom-parent': IBedroomParent,
  'child-care': IChildCare,
  desk: IDesk,
  chair: IChair,
  kitchen: IKitchen,
  bathtub: IBathtub,
  shower: IShower,
  'ac-unit': IAcUnit,
  'door-front': IDoorFront,
  garage: IGarage,
  home: IHome,
  cottage: ICottage,
  park: IPark,
  yard: IYard,
  'nest-eco-leaf': INestEcoLeaf,
  humidity: IHumidity,
  co2: ICo2,
  speed: ISpeed,
  'dew-point': IDewPoint,
  'water-drop': IWaterDrop,
  mood: IMood,
  power: IPower,
  'battery-alert': IBatteryAlert,
  'battery-full': IBatteryFull,
  'battery-1': IBattery1,
  'battery-2': IBattery2,
  'battery-3': IBattery3,
  'battery-4': IBattery4,
  'battery-5': IBattery5,
  'battery-6': IBattery6,
  'wifi-4': IWifi4,
  'wifi-3': IWifi3,
  'wifi-2': IWifi2,
  'wifi-1': IWifi1,
  'signal-3': ISignal3,
  'signal-2': ISignal2,
  'signal-1': ISignal1,
  'cloud-off': ICloudOff,
  warning: IWarning,
  'check-circle': ICheckCircle,
  'how-to-reg': IHowToReg,
  dashboard: IDashboard,
  'show-chart': IShowChart,
  smartphone: ISmartphone,
  devices: IDevices,
  update: IUpdate,
  'arrow-upward': IArrowUpward,
  'arrow-downward': IArrowDownward,
  check: ICheck,
  close: IClose,
  'expand-less': IExpandLess,
  'expand-more': IExpandMore,
  visibility: IVisibility,
  'visibility-off': IVisibilityOff,
  upload: IUpload,
  thermometer: IThermometer,
  'open-in-new': IOpenInNew,
  contrast: IContrast,
  'light-mode': ILightMode,
  'dark-mode': IDarkMode,
} satisfies Record<string, Component>;

export type IconName = keyof typeof icons;

export function deviceIcon(icon: DeviceIcon | null, central: boolean): Component {
  return icons[icon ?? (central ? 'sensors' : 'thermostat')];
}

export function batteryIcon(percent: number): IconName {
  if (percent < 20) return 'battery-alert';
  if (percent >= 90) return 'battery-full';
  return `battery-${Math.min(6, Math.max(1, Math.round((percent / 100) * 7)))}` as IconName;
}

export function signalIcon(rssi: number, central: boolean): IconName {
  if (central) return rssi >= -60 ? 'wifi-4' : rssi >= -70 ? 'wifi-3' : rssi >= -80 ? 'wifi-2' : 'wifi-1';
  return rssi >= -75 ? 'signal-3' : rssi >= -85 ? 'signal-2' : 'signal-1';
}
