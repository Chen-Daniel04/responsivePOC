import { useState } from "react";

function App() {
  const [status, setStatus] = useState("Ready");

  const setViewport = async (width: number, height: number) => {
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        setStatus("No active tab");
        return;
      }

      const target = {
        tabId: tab.id,
      };

      // Check whether the debugger is already attached
      const targets = await browser.debugger.getTargets();

      const isAttached = targets.some(
        (item) =>
          item.tabId === tab.id &&
          item.attached === true
      );

      // Attach only when necessary
      if (!isAttached) {
        await browser.debugger.attach(target, "1.3");
      }

      // Change viewport
      await browser.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
          scale: 1,
          screenWidth: width,
          screenHeight: height,
        }
      );

      setStatus(`✅ ${width} × ${height}`);
    } catch (error) {
      console.error("[POC] Viewport error:", error);
      setStatus("❌ Viewport change failed");
    }
  };

  return (
    <div style={{ padding: 20, width: 260 }}>
      <h2>Responsive POC</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setViewport(390, 844)}>
          Portrait
        </button>

        <button onClick={() => setViewport(844, 390)}>
          Landscape
        </button>
      </div>

      <p>{status}</p>
    </div>
  );
}

export default App;