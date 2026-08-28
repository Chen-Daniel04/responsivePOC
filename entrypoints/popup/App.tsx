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
    orientation: "portraitPrimary" | "landscapePrimary",
    deviceType: "phone" | "tablet" | "desktop"
  ) => {
    try {
      setStatus("Applying viewport...");

      const result = await browser.runtime.sendMessage({
        type: "SET_VIEWPORT",
        width,
        height,
        orientation,
        deviceType,
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

  const captureFullPage = async () => {
    try {
      setStatus("Capturing full page...");

      const result = await browser.runtime.sendMessage({
        type: "CAPTURE_FULL_PAGE",
      });

      if (!result?.success) {
        throw new Error(
          result?.error || "Screenshot failed"
        );
      }

      const link = document.createElement("a");

      link.href = `data:image/png;base64,${result.data}`;

      link.download = `responsive-full-page-${Date.now()}.png`;

      link.click();

      setStatus(
        `✅ Full page exported (${result.width} × ${result.height})`
      );
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

  const openWorkspace = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    const url = tab?.url ?? "";

    await browser.tabs.create({
      url: browser.runtime.getURL(
        `/workspace.html${url ? `?url=${encodeURIComponent(url)}` : ""}`
      ),
    });
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
        {device.type !== "desktop" && (
          <button
            onClick={() =>
              setViewport(
                device.width,
                device.height,
                "portraitPrimary",
                device.type
              )
            }
          >
            Portrait
          </button>
        )}

        <button
          onClick={() =>
            setViewport(
              device.height,
              device.width,
              "landscapePrimary",
              device.type
            )
          }
        >
          {device.type === "desktop"
            ? "Apply Viewport"
            : "Landscape"}
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

      {/* Full Page Screenshot */}
      <button
        onClick={captureFullPage}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 16,
        }}
      >
        Capture Full Page
      </button>

      {/* Workspace */}
      <button
        onClick={openWorkspace}
        style={{
          width: "100%",
          padding: 8,
          marginBottom: 16,
          fontWeight: "bold",
        }}
      >
        Open Responsive Workspace
      </button>

      {/* Status */}
      <p>{status}</p>
    </div>
  );
}

export default App;