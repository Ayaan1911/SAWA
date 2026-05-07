import './App.css'

function App() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">Autonomous Productivity Agent</div>
        <h1>SAWA keeps the thread when your attention breaks.</h1>
        <p className="lede">
          A heartbeat-driven TypeScript agent that reads its memory vault, detects execution gaps,
          scores drift, reasons about the next move, and pushes the intervention back to you.
        </p>
        <div className="actions">
          <a className="primary" href="http://localhost:3000" target="_blank" rel="noreferrer">
            Open Dashboard
          </a>
          <a className="secondary" href="#stack">
            View Architecture
          </a>
        </div>
      </section>

      <section className="metrics">
        <article>
          <span>Memory Vault</span>
          <strong>Goals, logs, decisions, fingerprint</strong>
        </article>
        <article>
          <span>Core Loop</span>
          <strong>Gap detection, drift, Claude, escalation</strong>
        </article>
        <article>
          <span>Delivery</span>
          <strong>WhatsApp first, Telegram fallback</strong>
        </article>
      </section>

      <section className="stack" id="stack">
        <div className="panel wide">
          <h2>Operating Stack</h2>
          <ol>
            <li>User intent and execution evidence land in the vault.</li>
            <li>Heartbeat reads goals, behavior, fingerprint, and recent logs.</li>
            <li>Gap and drift engines decide whether recovery mode should trigger.</li>
            <li>Claude reasoning formats the best next intervention and writes it back.</li>
          </ol>
        </div>
        <div className="panel">
          <h2>Integrations</h2>
          <ul>
            <li>Anthropic Claude API</li>
            <li>GitHub repo intelligence</li>
            <li>Google Calendar meeting intelligence</li>
            <li>arXiv research digest</li>
          </ul>
        </div>
        <div className="panel">
          <h2>Execution Bias</h2>
          <ul>
            <li>Confidence-weighted planning</li>
            <li>Cross-goal conflict detection</li>
            <li>Restart cards for fast recovery</li>
            <li>Weekly reviews and intervention memory</li>
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App
