import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DEVICE_PRESETS } from "../popup/device";

type PreviewEntry = {
  uid: string;
  deviceId: string;
  orientation: "portrait" | "landscape";
};

function WorkspaceApp() {
  const [url, setUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [selectedDevice, setSelectedDevice] = useState(
    DEVICE_PRESETS[0]?.id ?? ""
  );
  const [status, setStatus] = useState("");

  const [previewDevices, setPreviewDevices] = useState<
    PreviewEntry[]
  >([]);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [areaSize, setAreaSize] = useState({
    width: 0,
    height: 0,
  });
  const [captureUrl, setCaptureUrl] = useState("");

  const selected = DEVICE_PRESETS.find(
    (item) => item.id === selectedDevice
  );

  // Track the available preview area so we can scale devices to fit.
  useLayoutEffect(() => {
    const element = previewAreaRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      setAreaSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // Load the URL of the tab that launched the workspace.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialUrl = params.get("url");

    if (initialUrl) {
      setUrl(initialUrl);
      setLoadedUrl(initialUrl);
      setCaptureUrl(initialUrl);
    }
  }, []);

  // Track navigations inside the preview iframes so screenshots
  // capture the page the user is actually on. Cross-origin rules
  // prevent reading iframe.location directly, hence webNavigation.
  useEffect(() => {
    let myTabId: number | undefined;

    const matchesPreview = (details: any) =>
      details.tabId === myTabId &&
      details.frameId !== 0 &&
      details.parentFrameId === 0 &&
      details.url?.startsWith("http");

    const onNavigated = (details: any) => {
      if (matchesPreview(details)) {
        setCaptureUrl(details.url);
      }
    };

    browser.webNavigation.onCommitted.addListener(onNavigated);

    // SPAs change pages via history.pushState without a real
    // navigation — this event catches those route changes.
    browser.webNavigation.onHistoryStateUpdated.addListener(
      onNavigated
    );

    browser.tabs.getCurrent().then((tab) => {
      myTabId = tab?.id;
    });

    return () => {
      browser.webNavigation.onCommitted.removeListener(
        onNavigated
      );

      browser.webNavigation.onHistoryStateUpdated.removeListener(
        onNavigated
      );
    };
  }, []);

  const addDevice = () => {
    if (!selected) return;

    setPreviewDevices((devices) => [
      ...devices,
      {
        uid: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        deviceId: selected.id,
        orientation:
          selected.type === "desktop"
            ? "landscape"
            : "portrait",
      },
    ]);
  };

  const updateEntry = (
    uid: string,
    changes: Partial<PreviewEntry>
  ) => {
    setPreviewDevices((devices) =>
      devices.map((entry) =>
        entry.uid === uid ? { ...entry, ...changes } : entry
      )
    );
  };

  const removeEntry = (uid: string) => {
    setPreviewDevices((devices) =>
      devices.filter((entry) => entry.uid !== uid)
    );
  };

  const loadUrl = async () => {
    if (!url.trim()) return;

    const normalized = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;

    setUrl(normalized);
    setStatus("Preparing preview...");

    try {
      // Ask the background to strip X-Frame-Options/CSP for this site,
      // otherwise most sites refuse to render inside an iframe.
      const result = await browser.runtime.sendMessage({
        type: "ALLOW_IFRAME",
        url: normalized,
      });

      if (!result?.success) {
        throw new Error(
          result?.error || "Could not prepare preview"
        );
      }
    } catch (error) {
      setStatus(
        `⚠️ ${
          error instanceof Error
            ? error.message
            : "Preview preparation failed"
        } — loading anyway`
      );
    }

    setLoadedUrl(normalized);
  };

  const snapshot = async () => {
    const area = previewAreaRef.current;

    if (!area || !loadedUrl || previewDevices.length === 0) {
      return;
    }

    try {
      setStatus("Taking snapshot...");

      const rect = area.getBoundingClientRect();

      const result = await browser.runtime.sendMessage({
        type: "CAPTURE_WORKSPACE_SNAPSHOT",

        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      });

      if (!result?.success) {
        throw new Error(
          result?.error || "Snapshot failed"
        );
      }

      const link = document.createElement("a");

      link.href = `data:image/png;base64,${result.data}`;

      link.download = `snapshot-${Date.now()}.png`;

      link.click();

      setStatus("✅ Snapshot exported");
    } catch (error) {
      console.error("[Workspace] Snapshot error:", error);

      setStatus(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Snapshot failed"
        }`
      );
    }
  };

  const captureAll = async (mode: "viewport" | "full") => {
    if (!captureUrl || previewDevices.length === 0) return;

    for (const entry of previewDevices) {
      const device = DEVICE_PRESETS.find(
        (item) => item.id === entry.deviceId
      );

      if (!device) continue;

      try {
        setStatus(
          `Capturing ${device.name} (${mode})...`
        );

        const result = await browser.runtime.sendMessage({
          type: "CAPTURE_IN_WORKSPACE",

          url: captureUrl,
          width: device.width,
          height: device.height,
          orientation: entry.orientation,
          deviceType: device.type,
          mode,
        });

        if (!result?.success) {
          throw new Error(
            result?.error || "Screenshot failed"
          );
        }

        const link = document.createElement("a");

        link.href = `data:image/png;base64,${result.data}`;

        link.download =
          `${device.name.toLowerCase().replace(/\s+/g, "-")}-` +
          `${entry.orientation}-${mode}-${Date.now()}.png`;

        link.click();

        await new Promise((resolve) =>
          setTimeout(resolve, 300)
        );
      } catch (error) {
        console.error("[Workspace] Capture error:", error);

        setStatus(
          `❌ ${
            error instanceof Error
              ? error.message
              : "Screenshot failed"
          } (${device.name})`
        );

        return;
      }
    }

    setStatus(`✅ ${mode} screenshots exported`);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#1e1e1e",
        color: "#eee",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 10,
          background: "#2a2a2a",
          borderBottom: "1px solid #444",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ marginRight: 8 }}>
          Responsive Workspace
        </strong>

        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") loadUrl();
          }}
          placeholder="Enter website URL"
          style={{
            flex: 1,
            minWidth: 240,
            padding: 8,
            borderRadius: 4,
            border: "1px solid #555",
            background: "#1a1a1a",
            color: "#eee",
          }}
        />

        <button onClick={loadUrl}>Load</button>

        <select
          value={selectedDevice}
          onChange={(event) =>
            setSelectedDevice(event.target.value)
          }
          style={{
            padding: 8,
            borderRadius: 4,
            background: "#1a1a1a",
            color: "#eee",
            border: "1px solid #555",
          }}
        >
          {DEVICE_PRESETS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.width} × {item.height}
            </option>
          ))}
        </select>

        <button onClick={addDevice}>+ Add Device</button>

        <span style={{ flex: 1 }} />

        <button
          onClick={snapshot}
          disabled={!loadedUrl || previewDevices.length === 0}
        >
          Quick Snapshot
        </button>

        <button
          onClick={() => captureAll("viewport")}
          disabled={!loadedUrl || previewDevices.length === 0}
        >
          Screenshot All (Viewport)
        </button>

        <button
          onClick={() => captureAll("full")}
          disabled={!loadedUrl || previewDevices.length === 0}
        >
          Screenshot All (Full Page)
        </button>
      </div>

      {/* Preview Area */}
      <div
        ref={previewAreaRef}
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: 32,
          padding: 24,
          flexWrap: "wrap",
        }}
      >
        {previewDevices.length === 0 && !loadedUrl ? (
          <div
            style={{
              margin: "auto",
              color: "#777",
              textAlign: "center",
            }}
          >
            Enter a URL, press <strong>Load</strong>, then add
            devices to start testing.
          </div>
        ) : (
          previewDevices.map((entry) => {
            const device = DEVICE_PRESETS.find(
              (item) => item.id === entry.deviceId
            );

            if (!device) return null;

            const viewport =
              entry.orientation === "portrait"
                ? {
                    width: device.width,
                    height: device.height,
                  }
                : {
                    width: device.height,
                    height: device.width,
                  };

            // Fit this frame within the available area; when several
            // devices are shown they may wrap onto multiple rows.
            const scale =
              areaSize.width > 0
                ? Math.min(
                    1,
                    (areaSize.height - 120) / viewport.height
                  )
                : 1;

            return (
              <div
                key={entry.uid}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* Per-device controls */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <strong>{device.name}</strong>

                  {device.type !== "desktop" && (
                    <>
                      <button
                        onClick={() =>
                          updateEntry(entry.uid, {
                            orientation: "portrait",
                          })
                        }
                        style={{
                          fontWeight:
                            entry.orientation === "portrait"
                              ? "bold"
                              : "normal",
                          fontSize: 12,
                          padding: "2px 8px",
                        }}
                      >
                        Portrait
                      </button>

                      <button
                        onClick={() =>
                          updateEntry(entry.uid, {
                            orientation: "landscape",
                          })
                        }
                        style={{
                          fontWeight:
                            entry.orientation === "landscape"
                              ? "bold"
                              : "normal",
                          fontSize: 12,
                          padding: "2px 8px",
                        }}
                      >
                        Landscape
                      </button>
                    </>
                  )}

                  <span
                    style={{ color: "#888", fontSize: 12 }}
                  >
                    {viewport.width} × {viewport.height}
                    {scale < 1 &&
                      ` (${Math.round(scale * 100)}%)`}
                  </span>

                  <button
                    onClick={() => removeEntry(entry.uid)}
                    title="Remove device"
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      color: "#f88",
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Device frame */}
                <div
                  style={{
                    width: viewport.width * scale,
                    height: viewport.height * scale,

                    overflow: "hidden",
                    background: "#fff",
                    borderRadius: Math.min(16, 12 * scale),
                    boxShadow:
                      "0 4px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  {loadedUrl && (
                    <iframe
                      src={loadedUrl}
                      title={`${device.name} preview`}
                      style={{
                        width: viewport.width,
                        height: viewport.height,

                        zoom: scale,

                        border: "none",
                        background: "#fff",
                        display: "block",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Status Bar */}
      <div
        style={{
          padding: "6px 12px",
          fontSize: 13,
          color: "#aaa",
          background: "#2a2a2a",
          borderTop: "1px solid #444",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span
          style={{ overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {status}
          {captureUrl && (
            <span style={{ color: "#666" }}>
              {" "}
              · Capturing: {captureUrl}
            </span>
          )}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          {previewDevices.length} device
          {previewDevices.length === 1 ? "" : "s"} in preview
        </span>
      </div>
    </div>
  );
}

export default WorkspaceApp;
