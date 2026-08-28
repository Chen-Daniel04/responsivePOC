export type DevicePreset = {
    id: string;
    name: string;
    type: "phone" | "tablet" | "desktop";
    width: number;
    height: number;
}

export const DEVICE_PRESETS: DevicePreset[] = [
    {
        id: "iphone-15",
        name: "iPhone 15",
        type: "phone",
        width: 430,
        height: 932,
    },
    {
        id: "ipad",
        name: "iPad",
        type: "tablet",
        width: 768,
        height: 1024,
    },
    {
        id: "desktop",
        name: "Desktop",
        type: "desktop",
        width: 1440,
        height: 900,
    },
];