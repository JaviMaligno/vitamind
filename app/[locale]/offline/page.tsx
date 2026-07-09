"use client";

export default function OfflinePage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0a0a1a 0%, #1a237e 100%)",
      color: "#FFD54F",
      fontFamily: "'DM Sans', sans-serif",
      padding: "2rem",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>&#9788;</div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Sin conexion
      </h1>
      <p style={{ color: "rgba(255,255,255,0.6)", maxWidth: "320px", lineHeight: 1.5 }}>
        Vitamina D Explorer necesita conexion a internet para cargar datos meteorologicos y de ciudades.
        Vuelve a intentarlo cuando tengas conexion.
      </p>
      <button
        onClick={() => typeof window !== "undefined" && window.location.reload()}
        style={{
          marginTop: "1.5rem",
          padding: "0.6rem 1.5rem",
          background: "rgba(255,213,79,0.15)",
          border: "1px solid rgba(255,213,79,0.3)",
          borderRadius: "8px",
          color: "#FFD54F",
          fontSize: "0.9rem",
          cursor: "pointer",
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
