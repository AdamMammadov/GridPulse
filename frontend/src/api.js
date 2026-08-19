const BASE_URL = "http://localhost:8000";

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API xətası: ${path} (${res.status})`);
  return res.json();
}

export const api = {
  health: () => get("/api/health"),
  meters: () => get("/api/meters"),
  meterHistory: (meterId) => get(`/api/meters/${meterId}/history`),
  anomalies: (days = 30) => get(`/api/anomalies?days=${days}`),
  zoneRisk: () => get("/api/zones/risk"),
  forecast: () => get("/api/forecast"),
  summary: () => get("/api/summary"),
  devices: () => get("/api/devices"),
  deviceDetail: (deviceId) => get(`/api/devices/${deviceId}`),
  dispatchQueue: () => get("/api/dispatch/queue"),
  meterSecurityAlerts: () => get("/api/meters/security-alerts"),
  copilotAsk: (question) =>
    fetch(`${BASE_URL}/api/copilot/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }).then((r) => r.json()),
};