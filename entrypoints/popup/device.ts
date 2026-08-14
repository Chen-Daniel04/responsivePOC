export type DevicePreset = {
    id: string;
    name: string;
    width: number;
    height: number;
}

export const DEVICE_PRESETS: DevicePreset[] = [
    {
        id: "iphone-15",
        name: "iPhone 15",
        width: 430,
        height: 932,
    },
    {
        id: "ipad",
        name: "iPad",
        width: 768,
        height: 1024,
    },
    {
        id: "desktop",
        name: "Desktop",
        width: 1440,
        height: 900,
    },
];