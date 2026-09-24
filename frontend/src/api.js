const BASE_URL = "https://gridpulse-backend-production.up.railway.app";

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
  scaling: () => get("/api/scaling"),
  roi: () => get("/api/roi"),
  thresholdSweep: () => get("/api/threshold-sweep"),
  realDataValidation: () => get("/api/real-data-validation"),
  realDataValidationRecent: () => get("/api/real-data-validation/recent"),
  realDataValidationAz: () => get("/api/real-data-validation/azerbaijan"),
  reliabilityImpact: () => get("/api/reliability-impact"),
  backupStatus: () => get("/api/admin/backup-status"),

  // Qaz sızıntısı monitorinqi
  gasSummary: () => get("/api/gas/summary"),
  gasZoneRisk: () => get("/api/gas/zones/risk"),
  gasMeters: () => get("/api/gas/meters"),
  gasMeterHistory: (meterId) => get(`/api/gas/meters/${meterId}/history`),
  gasAnomalies: (days = 30) => get(`/api/gas/anomalies?days=${days}`),
  gasSecurityAlerts: () => get("/api/gas/security-alerts"),
  gasForecast: () => get("/api/gas/forecast"),
  gasInfraDevices: () => get("/api/gas/infra/devices"),
  gasInfraDeviceDetail: (id) => get(`/api/gas/infra/devices/${id}`),
  gasDispatchQueue: () => get("/api/gas/dispatch/queue"),

  // Kritik infrastruktur (metro/xəstəxana/mobillik)
  criticalInfraDevices: () => get("/api/critical-infra/devices"),
  criticalInfraDeviceDetail: (id) => get(`/api/critical-infra/devices/${id}`),

  // Fəlakət ssenarisi
  disasterScenario: (zone = "Zona D") => get(`/api/disaster-scenario?zone=${encodeURIComponent(zone)}`),
  disasterScenarioZones: () => get("/api/disaster-scenario/zones"),
  copilotAsk: (question, lang = "az") =>
    fetch(`${BASE_URL}/api/copilot/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, lang }),
    }).then((r) => r.json()),
};