"use client";

// Last-resort boundary: catches errors thrown by the root/locale layouts
// themselves (including the i18n provider), so it cannot use translations and
// must render its own <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f1117", color: "#e7e9ee" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Something went wrong / Algo ha salido mal</h1>
          <p style={{ margin: 0, opacity: 0.7 }}>An unexpected error occurred. / Ha ocurrido un error inesperado.</p>
          <button
            onClick={reset}
            style={{ marginTop: "0.5rem", padding: "0.6rem 1.4rem", borderRadius: "0.75rem", border: "1px solid #3a3f4d", background: "#1c2030", color: "inherit", fontSize: "1rem", cursor: "pointer" }}
          >
            Try again / Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
