:root {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

body {
  margin: 0;
  padding: 24px;
  background: #0b0f19;
  color: #e9eefc;
}

.card {
  max-width: 820px;
  margin: 0 auto;
  background: #121a2a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  padding: 18px;
}

h1 { margin: 0 0 16px; font-size: 20px; }

.grid { display: grid; gap: 14px; }

.label { opacity: 0.75; font-size: 12px; margin-bottom: 6px; }
.value { font-size: 14px; }

.pre {
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 12px;
  overflow: auto;
}

.small { font-size: 12px; opacity: 0.9; }

.row { display: flex; gap: 10px; }

button {
  appearance: none;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.08);
  color: #e9eefc;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
}

button:hover {
  background: rgba(255,255,255,0.12);
}
