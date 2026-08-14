import { useState } from "react";
import { DEVICE_PRESETS } from "./device";

function App() {
  const [status, setStatus] = useState("Ready");

  const [selectedDevice, setSelectedDevice] = useState<string>(
    DEVICE_PRESETS[0]?.id ?? ""
  );

  const device = DEVICE_PRESETS.find(
    (item) => item.id === selectedDevice
  );

  const setViewport = async (
    width: number,
    height: number,
    orientation: "portraitPrimary" | "landscapePrimary"
  ) => {
    try {
      setStatus("Applying viewport...");

      const result = await browser.runtime.sendMessage({
        type: "SET_VIEWPORT",
        width,
        height,
        orientation,
      });

      if (!result?.success) {
        throw new Error(
          result?.error || "Viewport change failed"
        );
      }

      setStatus(`✅ ${result.width} × ${result.height}`);
    } catch (error) {
      console.error("[POC] Viewport error:", error);

      setStatus(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Viewport change failed"
        }`
      );
    }
  };

  const captureViewport = async () => {
    try {
      setStatus("Capturing viewport...");

      const result = await browser.runtime.sendMessage({
        type: "CAPTURE_VIEWPORT",
      });

      if (!result?.success) {
        throw new Error(
          result?.error || "Screenshot failed"
        );
      }

      const link = document.createElement("a");

      link.href = `data:image/png;base64,${result.data}`;

      link.download = `responsive-viewport-${Date.now()}.png`;

      link.click();

      setStatus("✅ Viewport screenshot exported");
    } catch (error) {
      console.error("[POC] Screenshot error:", error);

      setStatus(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Screenshot failed"
        }`
      );
    }
  };

  if (!device) {
    return (
      <div style={{ padding: 20 }}>
        <p>No device presets available.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 20,
        width: 300,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h2>Responsive POC</h2>

      {/* Device Selection */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="device"
          style={{
            display: "block",
            marginBottom: 6,
            fontWeight: "bold",
          }}
        >
          Device
        </label>

        <select
          id="device"
          value={selectedDevice}
          onChange={(event) =>
            setSelectedDevice(event.target.value)
          }
          style={{
            width: "100%",
            padding: 8,
          }}
        >
          {DEVICE_PRESETS.map((device) => (
            <option
              key={device.id}
              value={device.id}
            >
              {device.name} — {device.width} × {device.height}
            </option>
          ))}
        </select>
      </div>

      {/* Device Information */}
      <div
        style={{
          marginBottom: 16,
          padding: 10,
          background: "#f5f5f5",
          borderRadius: 6,
        }}
      >
        <strong>{device.name}</strong>

        <div>
          Portrait: {device.width} × {device.height}
        </div>

        <div>
          Landscape: {device.height} × {device.width}
        </div>
      </div>

      {/* Orientation Controls */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() =>
            setViewport(
              device.width,
              device.height,
              "portraitPrimary"
            )
          }
        >
          Portrait
        </button>

        <button
          onClick={() =>
            setViewport(
              device.height,
              device.width,
              "landscapePrimary"
            )
          }
        >
          Landscape
        </button>
      </div>

      {/* Screenshot */}
      <button
        onClick={captureViewport}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 16,
        }}
      >
        Capture Viewport
      </button>

      {/* Status */}
      <p>{status}</p>
    </div>
  );
}

export default App;