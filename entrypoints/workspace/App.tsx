import { useState } from "react";

const DEVICES = {
  iPhone: {
    width: 390,
    height: 844,
  },
  Tablet: {
    width: 768,
    height: 1024,
  },
  Desktop: {
    width: 1920,
    height: 1080,
  },
};

function App() {
  const [device, setDevice] =
    useState<keyof typeof DEVICES>("iPhone");

  const [orientation, setOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");

  const base = DEVICES[device];

  const width =
    orientation === "portrait"
      ? base.width
      : base.height;

  const height =
    orientation === "portrait"
      ? base.height
      : base.width;

  const debugScroll = () => {
    const deviceElement = document.querySelector(
      ".device"
    ) as HTMLElement | null;

    const websiteElement = document.querySelector(
      ".website"
    ) as HTMLElement | null;

    if (!deviceElement || !websiteElement) {
      console.warn("[POC] Device or website element not found.");
      return;
    }

    console.table({
      orientation,

      deviceWidth: deviceElement.clientWidth,
      deviceHeight: deviceElement.clientHeight,

      deviceScrollHeight: deviceElement.scrollHeight,
      deviceScrollTop: deviceElement.scrollTop,

      websiteHeight: websiteElement.clientHeight,
      websiteScrollHeight: websiteElement.scrollHeight,

      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
  };

  return (
    <div className="workspace">
      <header className="toolbar">
        <h1>Responsive POC</h1>

        <select
          value={device}
          onChange={(event) =>
            setDevice(
              event.target.value as keyof typeof DEVICES
            )
          }
        >
          {Object.keys(DEVICES).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          onClick={() =>
            setOrientation((current) =>
              current === "portrait"
                ? "landscape"
                : "portrait"
            )
          }
        >
          {orientation === "portrait"
            ? "Landscape"
            : "Portrait"}
        </button>

        <span>
          {width} × {height}
        </span>

        <button onClick={debugScroll}>
          Debug Scroll
        </button>
      </header>

      <main className="canvas">
        <div
          className="device"
          style={{
            width: `${width}px`,
            height: `${height}px`,
          }}
        >
          <div className="website">
            <h2>Website Preview</h2>

            <p>
              This is our test website inside the responsive
              device viewport.
            </p>

            <p>
              Current orientation:{" "}
              <strong>{orientation}</strong>
            </p>

            <p>
              Viewport:{" "}
              <strong>
                {width} × {height}
              </strong>
            </p>

            {Array.from({ length: 30 }).map((_, index) => (
              <section key={index}>
                <h3>Section {index + 1}</h3>

                <p>
                  Lorem ipsum dolor sit amet, consectetur
                  adipiscing elit. This content exists to
                  test whether the device viewport can
                  scroll completely from the top to the
                  bottom.
                </p>

                <p>
                  The goal is to reach Section 30 in both
                  portrait and landscape orientations.
                </p>
              </section>
            ))}

            <div
              style={{
                padding: "30px",
                marginTop: "40px",
                border: "2px solid #000",
                textAlign: "center",
              }}
            >
              <strong>
                END OF PAGE
              </strong>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;