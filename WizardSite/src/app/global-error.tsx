"use client";

// Catches errors in the root layout itself. Must render its own <html>/<body>.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Geist, system-ui, sans-serif",
          background: "#F4F1E9",
          color: "#151310",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>
            Something broke at the root.
          </h1>
          <p style={{ color: "#6b655b", marginBottom: 24 }}>
            Reload to try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#151310",
              color: "#F4F1E9",
              border: 0,
              padding: "10px 20px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
