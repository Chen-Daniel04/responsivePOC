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
          message.orientation
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
    orientation: "portraitPrimary" | "landscapePrimary"
  ) {
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

    // --------------------------------------------------
    // Get current visual viewport metrics
    // --------------------------------------------------

    const metrics =
      (await browser.debugger.sendCommand(
        target,
        "Page.getLayoutMetrics"
      )) as any;

    const visualViewport =
      metrics.cssVisualViewport ??
      metrics.visualViewport;

    const availableWidth =
      visualViewport?.clientWidth ?? width;

    const availableHeight =
      visualViewport?.clientHeight ?? height;

    // --------------------------------------------------
    // Calculate a scale that allows large devices
    // to fit inside the available viewport.
    // --------------------------------------------------

    const fitScale = Math.min(
      1,
      availableWidth / width,
      availableHeight / height
    );

    console.log("[POC] Viewport calculation:", {
      requestedWidth: width,
      requestedHeight: height,
      availableWidth,
      availableHeight,
      fitScale,
    });

    // --------------------------------------------------
    // Apply device metrics
    // --------------------------------------------------

    await browser.debugger.sendCommand(
      target,
      "Emulation.setDeviceMetricsOverride",
      {
        width,
        height,

        deviceScaleFactor: 2,

        mobile: true,

        scale: fitScale,

        screenWidth: width,
        screenHeight: height,

        screenOrientation: {
          type: orientation,
          angle:
            orientation === "portraitPrimary"
              ? 0
              : 90,
        },
      }
    );

    return {
      success: true,
      width,
      height,
      orientation,
      scale: fitScale,
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

    // Get the actual document dimensions.
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
                  documentElement?.offsetWidth || 0,
                  documentElement?.clientWidth || 0,
                  body?.scrollWidth || 0,
                  body?.offsetWidth || 0,
                  body?.clientWidth || 0
                ),

                height: Math.max(
                  documentElement?.scrollHeight || 0,
                  documentElement?.offsetHeight || 0,
                  documentElement?.clientHeight || 0,
                  body?.scrollHeight || 0,
                  body?.offsetHeight || 0,
                  body?.clientHeight || 0
                )
              });
            })()
          `,
          returnByValue: true,
        }
      )) as any;

    if (!evaluation?.result?.value) {
      throw new Error(
        "Could not determine page dimensions"
      );
    }

    const dimensions = JSON.parse(
      evaluation.result.value
    );

    const fullWidth = Math.ceil(dimensions.width);
    const fullHeight = Math.ceil(dimensions.height);

    console.log("[POC] Full page dimensions:", {
      width: fullWidth,
      height: fullHeight,
    });

    if (fullWidth <= 0 || fullHeight <= 0) {
      throw new Error(
        "Invalid page dimensions"
      );
    }

    const screenshot =
      (await browser.debugger.sendCommand(
        target,
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: true,
          fromSurface: true,

          clip: {
            x: 0,
            y: 0,
            width: fullWidth,
            height: fullHeight,
            scale: 1,
          },
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