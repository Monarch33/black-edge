import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Sequence,
} from "remotion";

const EMERALD = "#10B981";
const BG = "#0A0A0A";
const TEXT = "#F5F5F5";

// ─── Helpers ──────────────────────────────────────────────
function fadeIn(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

function fadeOut(frame: number, start: number, duration = 15) {
  return interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function slideUp(frame: number, start: number, duration = 20) {
  return interpolate(frame, [start, start + duration], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
}

// ─── Stage 0: Cold Open (0-3s = frames 0-89) ─────────────
const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const textOpacity = fadeIn(frame, 10, 25);
  const lineWidth = interpolate(
    frame % 45,
    [0, 22, 45],
    [0, 200, 0],
    { extrapolateRight: "clamp" }
  );
  const exitOpacity = fadeOut(frame, 70, 20);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          width: lineWidth,
          height: 1,
          backgroundColor: EMERALD,
          marginBottom: 32,
        }}
      />
      <h1
        style={{
          color: TEXT,
          fontSize: 28,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          fontWeight: 300,
          fontFamily: "Inter, system-ui, sans-serif",
          opacity: textOpacity,
        }}
      >
        The Edge is Quantitative
      </h1>
    </AbsoluteFill>
  );
};

// ─── Stage 1: Product Reveal (3-6s = frames 90-179) ──────
const ProductReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = fadeIn(frame, 0, 20);
  const y = slideUp(frame, 0, 20);
  const scale = interpolate(frame, [0, 20], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const exitOpacity = fadeOut(frame, 70, 20);

  const bars = Array.from({ length: 20 }, (_, i) => {
    const height = interpolate(
      Math.sin(frame * 0.1 + i * 0.5),
      [-1, 1],
      [20, 100]
    );
    return height;
  });

  const percentages = [2.34, 1.87, 3.12, 4.56];

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: opacity * exitOpacity,
      }}
    >
      <div
        style={{
          transform: `translateY(${y}px) scale(${scale})`,
          width: 800,
          padding: 32,
          border: `1px solid ${EMERALD}33`,
          backgroundColor: `${BG}cc`,
          borderRadius: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `1px solid ${EMERALD}1a`,
            paddingBottom: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: EMERALD }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: `${EMERALD}4d` }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: `${EMERALD}4d` }} />
          </div>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: EMERALD,
              fontFamily: "monospace",
            }}
          >
            Terminal v3.0 // Active
          </div>
        </div>

        {/* Chart + Stats */}
        <div style={{ display: "flex", gap: 16, height: 200 }}>
          {/* Bars */}
          <div
            style={{
              flex: 2,
              backgroundColor: `${EMERALD}0d`,
              borderRadius: 4,
              padding: 16,
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  backgroundColor: `${EMERALD}66`,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>

          {/* Stats */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {percentages.map((pct, i) => {
              const pulseOpacity = interpolate(
                Math.sin(frame * 0.08 + i * 0.6),
                [-1, 1],
                [0.3, 1]
              );
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    backgroundColor: `${EMERALD}1a`,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 16px",
                  }}
                >
                  <div style={{ width: "50%", height: 2, backgroundColor: `${EMERALD}33`, borderRadius: 1 }} />
                  <div
                    style={{
                      color: EMERALD,
                      fontSize: 12,
                      fontFamily: "monospace",
                      opacity: pulseOpacity,
                    }}
                  >
                    +{pct.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Stage 2: Intelligence (6-9s = frames 180-269) ───────
const Intelligence: React.FC = () => {
  const frame = useCurrentFrame();

  const panels = [
    { label: "Signal Detection", text: "WAVEFORM LOCKED" },
    { label: "Kelly Criterion", text: "OPTIMAL SIZE: 4.2%" },
    { label: "Portfolio Execution", text: "EXECUTING..." },
  ];

  const titleOpacity = fadeIn(frame, 30, 20);
  const exitOpacity = fadeOut(frame, 70, 20);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 48,
          marginBottom: 48,
        }}
      >
        {panels.map((panel, i) => {
          const panelOpacity = fadeIn(frame, i * 8, 20);
          const panelY = slideUp(frame, i * 8, 20);
          const rotation = (frame * 3 + i * 120) % 360;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                opacity: panelOpacity,
                transform: `translateY(${panelY}px)`,
              }}
            >
              {/* Spinning circle */}
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: `1px solid ${EMERALD}4d`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    borderTop: `2px solid ${EMERALD}`,
                    borderRight: "2px solid transparent",
                    borderBottom: "2px solid transparent",
                    borderLeft: "2px solid transparent",
                    transform: `rotate(${rotation}deg)`,
                  }}
                />
                <div
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: `${EMERALD}99`,
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  {panel.label}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: EMERALD,
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  fontFamily: "monospace",
                }}
              >
                {panel.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtitle */}
      <h2
        style={{
          fontSize: 22,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          fontWeight: 300,
          color: TEXT,
          opacity: titleOpacity,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        AI-Powered Signals. Automated Execution.
      </h2>
    </AbsoluteFill>
  );
};

// ─── Stage 3: Logo Reveal (9-12s = frames 270-359) ───────
const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();

  const scale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = fadeIn(frame, 0, 30);
  const exitOpacity = fadeOut(frame, 70, 20);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: opacity * exitOpacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        {/* Diamond icon */}
        <div
          style={{
            width: 48,
            height: 48,
            border: `2px solid ${EMERALD}`,
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 24, height: 24, backgroundColor: EMERALD }} />
        </div>
        <h1
          style={{
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: TEXT,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          BLACK EDGE
        </h1>
      </div>
      <p
        style={{
          color: EMERALD,
          textTransform: "uppercase",
          letterSpacing: "0.4em",
          fontSize: 14,
          fontWeight: 300,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Prediction Market Intelligence
      </p>
    </AbsoluteFill>
  );
};

// ─── Stage 4: CTA (12-15s = frames 360-449) ─────────────
const CTA: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = fadeIn(frame, 0, 20);
  const lineWidth = interpolate(frame, [15, 45], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Particles
  const particles = Array.from({ length: 20 }, (_, i) => {
    const speed = 2 + (i % 5) * 0.5;
    const yOffset = interpolate(
      (frame * speed + i * 20) % 100,
      [0, 100],
      [0, -120]
    );
    const particleOpacity = interpolate(
      (frame * speed + i * 20) % 100,
      [0, 30, 70, 100],
      [0, 0.4, 0.4, 0]
    );
    return { yOffset, particleOpacity, x: (i - 10) * 12 };
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      {/* Logo small */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: `1px solid ${EMERALD}`,
            transform: "rotate(45deg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 16, height: 16, backgroundColor: EMERALD }} />
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: TEXT,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          BLACK EDGE
        </h1>
      </div>

      {/* URL + underline */}
      <div style={{ position: "relative" }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 300,
            letterSpacing: "0.15em",
            color: TEXT,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          blackedge.app
        </span>
        <div
          style={{
            position: "absolute",
            bottom: -8,
            left: 0,
            width: `${lineWidth}%`,
            height: 1,
            backgroundColor: EMERALD,
          }}
        />
      </div>

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: 80,
            left: `calc(50% + ${p.x}px)`,
            width: 1,
            height: 1,
            borderRadius: "50%",
            backgroundColor: "white",
            opacity: p.particleOpacity,
            transform: `translateY(${p.yOffset}px)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ─── Grid Background ─────────────────────────────────────
const Grid: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, 0, 60) * 0.12;

  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, ${EMERALD} 1px, transparent 1px), linear-gradient(to bottom, ${EMERALD} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    />
  );
};

// ─── Main Composition ────────────────────────────────────
export const BlackEdgeAd: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Grid />
      <Sequence from={0} durationInFrames={fps * 3} name="Cold Open">
        <ColdOpen />
      </Sequence>
      <Sequence from={fps * 3} durationInFrames={fps * 3} name="Product Reveal">
        <ProductReveal />
      </Sequence>
      <Sequence from={fps * 6} durationInFrames={fps * 3} name="Intelligence">
        <Intelligence />
      </Sequence>
      <Sequence from={fps * 9} durationInFrames={fps * 3} name="Logo Reveal">
        <LogoReveal />
      </Sequence>
      <Sequence from={fps * 12} durationInFrames={fps * 3} name="CTA">
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
