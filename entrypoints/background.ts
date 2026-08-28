export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
      // ==================================================
      // SET VIEWPORT
      // ==================================================
      if (message.type === "SET_VIEWPORT") {
        handleSetViewport(
          message.width,
          message.height,
          message.orientation,
          message.deviceType
        )
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Viewport change failed",
            })
          );

        return true;
      }

      // ==================================================
      // SNAPSHOT FROM WORKSPACE PREVIEW
      // ==================================================
      if (message.type === "CAPTURE_WORKSPACE_SNAPSHOT") {
        handleWorkspaceSnapshot(message)
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Snapshot failed",
            })
          );

        return true;
      }

      // ==================================================
      // CAPTURE FROM WORKSPACE
      // ==================================================
      if (message.type === "CAPTURE_IN_WORKSPACE") {
        handleWorkspaceCapture(message)
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Workspace capture failed",
            })
          );

        return true;
      }

      // ==================================================
      // ALLOW IFRAME PREVIEW (strip frame-blocking headers)
      // ==================================================
      if (message.type === "ALLOW_IFRAME") {
        handleAllowIframe(message.url)
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to allow iframe preview",
            })
          );

        return true;
      }

      // ==================================================
      // CAPTURE CURRENT VIEWPORT
      // ==================================================
      if (message.type === "CAPTURE_VIEWPORT") {
        handleCaptureViewport()
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Screenshot failed",
            })
          );

        return true;
      }

      // ==================================================
      // CAPTURE FULL PAGE
      // ==================================================
      if (message.type === "CAPTURE_FULL_PAGE") {
        handleCaptureFullPage()
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Full page screenshot failed",
            })
          );

        return true;
      }
    }
  );

  // ======================================================
  // SET VIEWPORT
  // ======================================================

  async function handleSetViewport(
  width: number,
  height: number,
  orientation: "portraitPrimary" | "landscapePrimary",
  deviceType: "phone" | "tablet" | "desktop" = "phone"
) {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error("No active tab");
  }

  const target = { tabId: tab.id };

  await ensureDebuggerAttached(tab.id);

  // Page domain must be enabled for reliable emulation/screenshot behavior
  await browser.debugger.sendCommand(target, "Page.enable");

  const isDesktop = deviceType === "desktop";

  await browser.debugger.sendCommand(
    target,
    "Emulation.setDeviceMetricsOverride",
    {
      width,
      height,

      // Desktop pages should render with desktop behavior and DPR 1.
      deviceScaleFactor: isDesktop ? 1 : 2,

      mobile: !isDesktop,

      // scale must stay at 1: scaling the visual viewport desyncs the
      // layout viewport and breaks scrolling (especially in portrait).
      scale: 1,

      // screenWidth/screenHeight intentionally omitted — matching DevTools
      // behavior. Setting them to the viewport size makes Chrome apply
      // shrink-to-fit scaling, which broke scrolling and landscape layout.

      screenOrientation: isDesktop
        ? undefined
        : {
            type: orientation,
            angle:
              orientation === "portraitPrimary" ? 0 : 90,
          },
    }
  );

  // Reload so the page lays out from scratch under the emulated metrics.
  // Pages laid out before the override never resync their scroll area,
  // which was causing the "can't scroll fully in portrait" issue.
  await browser.debugger.sendCommand(target, "Page.reload");

  return {
    success: true,
    width,
    height,
    orientation,
  };
}

  // ======================================================
  // CAPTURE CURRENT VIEWPORT
  // ======================================================

  async function handleCaptureViewport() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab");
    }

    const target = {
      tabId: tab.id,
    };

    await ensureDebuggerAttached(tab.id);

    const screenshot =
      (await browser.debugger.sendCommand(
        target,
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: false,
        }
      )) as {
        data: string;
      };

    return {
      success: true,
      data: screenshot.data,
    };
  }

  // ======================================================
  // CAPTURE FULL PAGE
  // ======================================================
  //
  // Kept for compatibility with the existing App.tsx.
  // Full-page capture is currently deferred for the POC.
  //
  // ======================================================

  async function handleCaptureFullPage() {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab");
    }

    const target = {
      tabId: tab.id,
    };

    await ensureDebuggerAttached(tab.id);

    await browser.debugger.sendCommand(target, "Page.enable");

    // Remember the current emulated metrics so we can restore them.
    const metricsBefore =
      (await browser.debugger.sendCommand(
        target,
        "Page.getLayoutMetrics"
      )) as any;

    const previousViewport =
      metricsBefore.cssVisualViewport ??
      metricsBefore.visualViewport;

    const restoreMetrics = () =>
      browser.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width: Math.max(1, Math.floor(previousViewport?.clientWidth ?? 0)),
          height: Math.max(1, Math.floor(previousViewport?.clientHeight ?? 0)),
          deviceScaleFactor: 2,
          mobile: true,
          scale: 1,
          screenWidth: Math.max(1, Math.floor(previousViewport?.clientWidth ?? 0)),
          screenHeight: Math.max(1, Math.floor(previousViewport?.clientHeight ?? 0)),
        }
      );

    // Use cssContentSize from CDP instead of Runtime.evaluate scrollHeight —
    // it is the authoritative layout size under device emulation.
    const contentSize =
      (metricsBefore.cssContentSize ??
        metricsBefore.contentSize) as
      | { width: number; height: number }
      | undefined;

    let fullWidth = Math.ceil(contentSize?.width ?? 0);
    let fullHeight = Math.ceil(contentSize?.height ?? 0);

    // Fallback to document dimensions if cssContentSize is unavailable.
    if (!fullWidth || !fullHeight) {
      const evaluation =
        (await browser.debugger.sendCommand(
          target,
          "Runtime.evaluate",
          {
            expression: `
              (() => {
                const documentElement =
                  document.documentElement;

                const body = document.body;

                return JSON.stringify({
                  width: Math.max(
                    documentElement?.scrollWidth || 0,
                    body?.scrollWidth || 0
                  ),

                  height: Math.max(
                    documentElement?.scrollHeight || 0,
                    body?.scrollHeight || 0
                  )
                });
              })()
            `,
            returnByValue: true,
          }
        )) as any;

      const dimensions = evaluation?.result?.value
        ? JSON.parse(evaluation.result.value)
        : { width: 0, height: 0 };

      fullWidth = Math.ceil(dimensions.width);
      fullHeight = Math.ceil(dimensions.height);
    }

    console.log("[POC] Full page dimensions:", {
      width: fullWidth,
      height: fullHeight,
    });

    if (fullWidth <= 0 || fullHeight <= 0) {
      throw new Error("Invalid page dimensions");
    }

    try {
      // Temporarily expand the emulated viewport to the full content size.
      // Capturing a clip larger than the surface fails silently or loops,
      // which was the cause of the previous unreliable behavior.
      await browser.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width: fullWidth,
          height: fullHeight,

          deviceScaleFactor: 2,

          mobile: true,

          scale: 1,

          screenWidth: fullWidth,
          screenHeight: fullHeight,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 150));

      const screenshot = (await browser.debugger.sendCommand(
        target,
        "Page.captureScreenshot",
        {
          format: "png",

          clip: {
            x: 0,
            y: 0,
            width: fullWidth,
            height: fullHeight,
            scale: 1,
          },

          captureBeyondViewport: false,
          fromSurface: true,
        }
      )) as {
        data: string;
      };

      return {
        success: true,
        data: screenshot.data,
        width: fullWidth,
        height: fullHeight,
      };
    } finally {
      // Always restore the original viewport, even on failure — leftover
      // overrides were causing repeated/looping capture behavior before.
      await restoreMetrics().catch(() => {});
    }
  }

  // ======================================================
  // SNAPSHOT FROM WORKSPACE PREVIEW
  // ======================================================
  //
  // Captures exactly what is visible in the workspace: attaches the
  // debugger to the workspace tab itself and crops the screenshot to
  // the preview iframe's on-screen rectangle. Lower resolution than
  // the emulated capture (it captures the visually scaled frame) but
  // reflects live page state.
  //
  // ======================================================

  async function handleWorkspaceSnapshot(message: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      throw new Error("No active tab");
    }

    const target = { tabId: tab.id };

    await ensureDebuggerAttached(tab.id);

    await browser.debugger.sendCommand(
      target,
      "Page.enable"
    );

    try {
      const dpr =
        (await browser.debugger.sendCommand(
          target,
          "Runtime.evaluate",
          {
            expression: "window.devicePixelRatio",
            returnByValue: true,
          }
        )) as any;

      const scale = dpr?.result?.value || 1;

      const screenshot =
        (await browser.debugger.sendCommand(
          target,
          "Page.captureScreenshot",
          {
            format: "png",
            captureBeyondViewport: false,
            fromSurface: true,

            clip: {
              x: message.x,
              y: message.y,
              width: message.width,
              height: message.height,
              scale,
            },
          }
        )) as { data: string };

      return {
        success: true,
        data: screenshot.data,
      };
    } finally {
      await browser.debugger
        .detach(target)
        .catch(() => {});
    }
  }

  // ======================================================
  // CAPTURE FROM WORKSPACE
  // ======================================================
  //
  // Opens the site in a hidden tab, applies real device emulation
  // via CDP, captures, then cleans up. This keeps screenshots
  // pixel-accurate at true device dimensions, independent of the
  // visually scaled iframe preview.
  //
  // ======================================================

  type WorkspaceCaptureMessage = {
    url: string;
    width: number;
    height: number;
    orientation: "portrait" | "landscape";
    deviceType: "phone" | "tablet" | "desktop";
    mode: "viewport" | "full";
  };

  function waitForTabComplete(
    tabId: number,
    timeoutMs = 20000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const listener = (
        updatedTabId: number,
        changeInfo: any
      ) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          browser.tabs.onUpdated.removeListener(listener);
          clearTimeout(timer);
          resolve();
        }
      };

      const timer = setTimeout(() => {
        browser.tabs.onUpdated.removeListener(listener);
        reject(new Error("Page load timed out"));
      }, timeoutMs);

      browser.tabs.onUpdated.addListener(listener);
    });
  }

  async function waitForContentStable(
    target: { tabId: number },
    maxWaitMs = 8000,
    settleMs = 500
  ) {
    const readHeight = async () => {
      const result =
        (await browser.debugger.sendCommand(
          target,
          "Runtime.evaluate",
          {
            expression:
              "document.documentElement.scrollHeight",
            returnByValue: true,
          }
        )) as any;

      return result?.result?.value ?? 0;
    };

    const start = Date.now();

    let previous = await readHeight();

    while (Date.now() - start < maxWaitMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, settleMs)
      );

      const current = await readHeight();

      if (current === previous) {
        return;
      }

      previous = current;
    }
  }

  async function handleWorkspaceCapture(
    message: WorkspaceCaptureMessage
  ) {
    if (!message.url) {
      throw new Error("No URL to capture");
    }

    await handleAllowIframe(message.url).catch(() => {});

    const isDesktop = message.deviceType === "desktop";

    const emulatedWidth =
      message.orientation === "portrait"
        ? message.width
        : message.height;

    const emulatedHeight =
      message.orientation === "portrait"
        ? message.height
        : message.width;

    const tab = await browser.tabs.create({
      url: message.url,
      active: false,
    });

    try {
      await waitForTabComplete(tab.id!);

      const target = { tabId: tab.id! };

      await ensureDebuggerAttached(tab.id!);

      await browser.debugger.sendCommand(
        target,
        "Page.enable"
      );

      await browser.debugger.sendCommand(
        target,
        "Emulation.setDeviceMetricsOverride",
        {
          width: emulatedWidth,
          height: emulatedHeight,

          deviceScaleFactor: isDesktop ? 1 : 2,

          mobile: !isDesktop,

          scale: 1,

          screenOrientation: isDesktop
            ? undefined
            : {
                type:
                  message.orientation === "portrait"
                    ? "portraitPrimary"
                    : "landscapePrimary",
                angle:
                  message.orientation === "portrait" ? 0 : 90,
              },
        }
      );

      // Reload so the page lays out under the emulated metrics.
      await browser.debugger.sendCommand(target, "Page.reload");

      await waitForTabComplete(tab.id!);

      // SPAs render content after the load event (data fetching,
      // hydration, lazy loading). Wait until scrollHeight stops
      // changing so we don't measure/capture a half-rendered page.
      await waitForContentStable(target);

      let screenshotData: string;

      if (message.mode === "viewport") {
        const screenshot =
          (await browser.debugger.sendCommand(
            target,
            "Page.captureScreenshot",
            {
              format: "png",
              captureBeyondViewport: false,
            }
          )) as { data: string };

        screenshotData = screenshot.data;
      } else {
        // Full page: expand the emulated viewport to the content size,
        // capture, then restore.
        const metrics =
          (await browser.debugger.sendCommand(
            target,
            "Page.getLayoutMetrics"
          )) as any;

        const contentSize =
          metrics.cssContentSize ?? metrics.contentSize;

        const fullWidth = Math.ceil(contentSize?.width ?? emulatedWidth);
        const fullHeight = Math.ceil(contentSize?.height ?? emulatedHeight);

        if (fullWidth <= 0 || fullHeight <= 0) {
          throw new Error("Invalid page dimensions");
        }

        // Chrome's screenshot surface caps at ~16384px physical pixels.
        // At deviceScaleFactor 2, very tall pages exceed it and the
        // capture fails or truncates — reduce the clip scale to fit.
        const MAX_SURFACE_PIXELS = 16000;
        const dpr = isDesktop ? 1 : 2;

        const captureScale = Math.min(
          1,
          MAX_SURFACE_PIXELS / (fullHeight * dpr),
          MAX_SURFACE_PIXELS / (fullWidth * dpr)
        );

        await browser.debugger.sendCommand(
          target,
          "Emulation.setDeviceMetricsOverride",
          {
            width: fullWidth,
            height: fullHeight,

            deviceScaleFactor: isDesktop ? 1 : 2,

            mobile: !isDesktop,

            scale: 1,
          }
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 150)
        );

        const screenshot =
          (await browser.debugger.sendCommand(
            target,
            "Page.captureScreenshot",
            {
              format: "png",

              clip: {
                x: 0,
                y: 0,
                width: fullWidth,
                height: fullHeight,
                scale: captureScale,
              },

              captureBeyondViewport: false,
              fromSurface: true,
            }
          )) as { data: string };

        screenshotData = screenshot.data;
      }

      return {
        success: true,
        data: screenshotData,
        mode: message.mode,
      };
    } finally {
      await browser.debugger
        .detach({ tabId: tab.id! })
        .catch(() => {});

      await browser.tabs.remove(tab.id!).catch(() => {});
    }
  }

  // ======================================================
  // ALLOW IFRAME PREVIEW
  // ======================================================

  async function handleAllowIframe(url: string) {
    const hostname = new URL(url).hostname;

    // Session rules: strip headers that block embedding, scoped to
    // this hostname and sub_frame requests only.
    await browser.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: [
        {
          id: 1,
          priority: 1,
          action: {
            type: "modifyHeaders",
            responseHeaders: [
              { header: "X-Frame-Options", operation: "remove" },
              { header: "Content-Security-Policy", operation: "remove" },
            ],
          },
          condition: {
            requestDomains: [hostname],
            resourceTypes: ["sub_frame"],
          },
        },
      ],
    });

    return { success: true };
  }

  // ======================================================
  // ENSURE DEBUGGER ATTACHED
  // ======================================================

  async function ensureDebuggerAttached(
    tabId: number
  ) {
    const targets =
      await browser.debugger.getTargets();

    const isAttached = targets.some(
      (targetInfo) =>
        targetInfo.tabId === tabId &&
        targetInfo.attached === true
    );

    if (!isAttached) {
      await browser.debugger.attach(
        {
          tabId,
        },
        "1.3"
      );
    }
  }
});