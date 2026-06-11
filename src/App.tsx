import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "./App.css";

function App() {
  const ping = useQuery(api.ping.ping);

  return (
    <main className="app">
      <header className="app-header">
        <p className="app-badge">Badminton Inventory</p>
        <h1>Kelola stok peralatan badminton dengan mudah</h1>
        <p className="app-subtitle">
          React + TypeScript + Vite + Convex
        </p>
      </header>

      <section className="app-status">
        <span>Status Convex:</span>
        <strong>{ping === undefined ? "Menghubungkan..." : ping}</strong>
      </section>
    </main>
  );
}

export default App;
