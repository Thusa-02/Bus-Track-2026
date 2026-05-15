import { useState, useEffect, useCallback, useRef } from "react";
import {
  authApi, busApi, updateApi,
  STOPS, DIRECTIONS, DIRECTION_LABELS, CROWD_LEVELS, UPDATE_TYPES,
  getToken, setToken, clearToken, getUser, setUser, clearUser,
  timeAgo, getDeviceId,
} from "./api.js";

// ─────────────────────────────────────────────────────────────────────────────
// Toast System
// ─────────────────────────────────────────────────────────────────────────────
let _addToast = null;

function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  _addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}

const toast = (msg, type) => _addToast?.(msg, type);

// ─────────────────────────────────────────────────────────────────────────────
// Stop Progress Bar
// ─────────────────────────────────────────────────────────────────────────────
function StopProgress({ currentStop, direction }) {
  const orderedStops = direction === "TO_VAVUNIYA" ? [...STOPS].reverse() : STOPS;
  const activeIdx = currentStop ? orderedStops.indexOf(currentStop) : -1;

  return (
    <div className="stop-progress">
      <div className="stop-track">
        {orderedStops.map((stop, i) => {
          const isPassed = activeIdx >= 0 && i < activeIdx;
          const isActive = i === activeIdx;
          return (
            <div key={stop} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div className="stop-node">
                <div className={`stop-circle ${isActive ? "active" : isPassed ? "passed" : ""}`} />
                <span className={`stop-label ${isActive ? "active" : isPassed ? "passed" : ""}`}>{stop}</span>
              </div>
              {i < orderedStops.length - 1 && (
                <div className={`stop-line ${isPassed || isActive ? "passed" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Page
// ─────────────────────────────────────────────────────────────────────────────
function LivePage({ buses }) {
  const [direction, setDirection] = useState("TO_UNIVERSITY");
  const [directionReports, setDirectionReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const loadDirectionReports = useCallback(async () => {
    if (buses.length === 0) {
      setDirectionReports([]);
      return;
    }

    setLoading(true);
    const results = await Promise.all(
      buses.map(async (bus) => {
        const { ok, data } = await updateApi.getAll(bus._id);
        if (!ok || !Array.isArray(data)) return [];
        return data.map((report) => ({
          ...report,
          busNumber: bus.busNumber,
          routeName: bus.routeName,
        }));
      })
    );
    setLoading(false);

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const reports = results
      .flat()
      .filter((report) => report.direction === direction)
      .filter((report) => new Date(report.timestamp).getTime() >= oneDayAgo)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    setDirectionReports(reports);
    setLastRefreshedAt(new Date());
  }, [buses, direction]);

  useEffect(() => {
    if (directionReports.length === 0) {
      setSelectedReportId("");
      return;
    }

    const selectedStillExists = directionReports.some((report) => report._id === selectedReportId);
    if (!selectedStillExists) {
      setSelectedReportId(directionReports[0]._id);
    }
  }, [directionReports, selectedReportId]);

  useEffect(() => {
    loadDirectionReports();
    clearInterval(intervalRef.current);
    if (buses.length > 0) {
      intervalRef.current = setInterval(loadDirectionReports, 30000);
    }
    return () => clearInterval(intervalRef.current);
  }, [buses.length, loadDirectionReports]);

  const selectedDirectionLabel = DIRECTION_LABELS[direction] || direction;
  const selectedReport = directionReports.find((report) => report._id === selectedReportId) || directionReports[0];
  const formatReportDateTime = (timestamp) => {
    if (!timestamp) return "Unknown time";
    return new Date(timestamp).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="centered-page">
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(62,207,142,0.13) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.10) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
          REAL-TIME TRACKING
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Live <em>Tracker</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Real-time bus reports by direction
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 760 }}>
        <div className="corner-accent corner-tl" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-tr" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-bl" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-br" style={{ borderColor: "var(--green)" }} />

        <div className="center-form-inner">
          <div className="section-header">
            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Direction Filter
            </span>
            <button className="btn btn-ghost btn-sm" onClick={loadDirectionReports} disabled={loading}>
              {loading ? <><div className="spinner" /> Refreshing...</> : "Refresh"}
            </button>
          </div>

          <div className="select-wrap" style={{ marginBottom: "1.5rem" }}>
            <select value={direction} onChange={e => setDirection(e.target.value)}>
              {DIRECTIONS.map(d => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
            </select>
          </div>

          <div className="live-panel">
            <div className="data-badge" style={{ color: "var(--green)", background: "rgba(62,207,142,0.10)", borderColor: "rgba(62,207,142,0.25)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              LAST 24 HOURS - {selectedDirectionLabel}
            </div>

            <div className="eta-display">
              {directionReports.length} report{directionReports.length === 1 ? "" : "s"} found
            </div>

            {lastRefreshedAt && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "0.72rem", marginBottom: "1rem" }}>
                Last refreshed: {formatReportDateTime(lastRefreshedAt)}
              </div>
            )}

            <StopProgress currentStop={selectedReport?.currentStop} direction={direction} />

            {!loading && buses.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">Bus</div>
                <h3>No buses registered</h3>
                <p>Add buses first to view live reports</p>
              </div>
            )}

            {!loading && buses.length > 0 && directionReports.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">Signal</div>
                <h3>No reports found</h3>
                <p>No location updates were submitted for this direction in the last 24 hours</p>
              </div>
            )}

            {directionReports.length > 0 && (
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
                {directionReports.map(report => {
                  const isSelected = report._id === selectedReport?._id;
                  return (
                  <div
                    key={report._id}
                    className="card"
                    onClick={() => setSelectedReportId(report._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => (e.key === "Enter" || e.key === " ") && setSelectedReportId(report._id)}
                    style={{
                      cursor: "pointer",
                      borderColor: isSelected ? "rgba(232,184,75,0.55)" : undefined,
                      boxShadow: isSelected ? "0 0 0 1px rgba(232,184,75,0.22), 0 0 24px rgba(232,184,75,0.10)" : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                      <div>
                        <div className="card-label">{report.busNumber} - {report.routeName}</div>
                        <div className="card-value" style={{ color: "var(--accent)", fontSize: "1.05rem" }}>
                          {report.currentStop}
                        </div>
                      </div>
                      <span className={`tag tag-${report.updateType}`}>{report.updateType}</span>
                    </div>
                    <div style={{ display: "grid", gap: "0.45rem", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                      <span>{selectedDirectionLabel}</span>
                      <span>Crowd: {report.crowdLevel}</span>
                      <span>Updated: {formatReportDateTime(report.timestamp)} ({timeAgo(report.timestamp)})</span>
                      <span>Reported by {report.reportedBy}</span>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* return (
    <div className="centered-page">
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(62,207,142,0.13) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.10) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" style={{ background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
          REAL-TIME TRACKING
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Live <em>Tracker</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Real-time bus location · Vavuniya–University
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 680 }}>
        <div className="corner-accent corner-tl" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-tr" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-bl" style={{ borderColor: "var(--green)" }} />
        <div className="corner-accent corner-br" style={{ borderColor: "var(--green)" }} />

        <div className="center-form-inner">
        <div className="section-header">
          <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            🚌 Select Bus
          </span>
          {loading && <div className="spinner" style={{ color: "var(--accent)" }} />}
        </div>
        <div className="select-wrap" style={{ marginBottom: "1.5rem" }}>
          <select value={busId} onChange={e => setBusId(e.target.value)}>
            <option value="">— Choose a bus —</option>
            {buses.map(b => (
              <option key={b._id} value={b._id}>{b.busNumber} · {b.routeName}</option>
            ))}
          </select>
        </div>

      {!busId && (
          <div className="empty-state">
            <div className="empty-icon">🚌</div>
            <h3>Select a bus</h3>
            <p>Choose a bus above to see live tracking data</p>
          </div>
        )}

        {busId && !liveData && !loading && (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <h3>No data available</h3>
            <p>No location updates have been submitted for this bus yet</p>
          </div>
        )}

        {liveData && (
          <div className="live-panel">
            <div
              className="data-badge"
              style={{
                color:       isStale ? "var(--red)"    : "var(--green)",
                background:  isStale ? "rgba(240,64,64,0.12)" : "rgba(62,207,142,0.10)",
                borderColor: isStale ? "rgba(240,64,64,0.25)" : "rgba(62,207,142,0.25)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
              {isStale ? "STALE DATA" : "LIVE"} · Last report: {liveData.lastReportedAt ? timeAgo(liveData.lastReportedAt) : "—"}
            </div>

            <div className="eta-display">
              {liveData.eta?.message || "ETA unavailable"}
            </div>

            <StopProgress currentStop={liveData?.currentStop} direction={liveData?.direction || "TO_UNIVERSITY"} />

            <div className="grid-3">
              <div className="card">
                <div className="card-label">Current Stop</div>
                <div className="card-value" style={{ color: "var(--accent)" }}>{liveData.currentStop || "—"}</div>
              </div>
              <div className="card">
                <div className="card-label">Direction</div>
                <div className="card-value" style={{ fontSize: "0.95rem" }}>
                  {DIRECTION_LABELS[liveData.direction] || liveData.direction || "—"}
                </div>
              </div>
              <div className="card">
                <div className="card-label">Update Type</div>
                <div className="card-value" style={{ fontSize: "0.95rem", textTransform: "capitalize" }}>
                  {liveData.updateType || "—"}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-label">Crowd Level</div>
                <div className="card-value" style={{ fontSize: "1rem" }}>{liveData.crowdLevel || "—"}</div>
                <div className="crowd-bar">
                  {crowdSegments().map((color, i) => (
                    <div key={i} className={`crowd-seg ${color ? `fill-${color}` : ""}`} />
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-label">Data Reliability</div>
                <div className="card-value" style={{ fontSize: "1rem" }}>
                  {liveData.reliability?.label || "—"}
                </div>
                <div className="rel-dots">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={`rel-dot ${i < (liveData.reliability?.score || 0) ? "fill" : ""}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
*/
}

// Schedule Page
// ─────────────────────────────────────────────────────────────────────────────
function SchedulePage({ buses }) {
  const [busId, setBusId] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [nextDep, setNextDep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterDir, setFilterDir] = useState("ALL");
  const [filterStop, setFilterStop] = useState("Vavuniya");

  const loadSchedule = async (id) => {
    if (!id) { setSchedule([]); setNextDep(null); return; }
    setLoading(true);
    const { ok, data } = await busApi.getSchedule(id);
    setLoading(false);
    if (ok) setSchedule(data.schedule || []);
  };

  const loadNextDep = async () => {
    if (!busId || !filterStop || filterDir === "ALL") { setNextDep(null); return; }
    const { ok, data } = await busApi.nextDeparture(busId, filterDir, filterStop);
    if (ok) setNextDep(data);
    else setNextDep(null);
  };

  useEffect(() => { loadSchedule(busId); }, [busId]);
  useEffect(() => { loadNextDep(); }, [busId, filterDir, filterStop]);

  const filtered = filterDir === "ALL" ? schedule : schedule.filter(t => t.direction === filterDir);

  return (
    <div className="centered-page">
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(74,144,217,0.14) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.09) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" style={{ background: "var(--blue)", boxShadow: "0 0 8px var(--blue)" }} />
          TIMETABLE
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Bus <em>Schedule</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Stop-by-stop departure times · Vavuniya ↔ University
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 720, boxShadow: "0 0 0 1px rgba(74,144,217,0.06), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(74,144,217,0.04) inset" }}>
        <div className="corner-accent corner-tl" style={{ borderColor: "var(--blue)" }} />
        <div className="corner-accent corner-tr" style={{ borderColor: "var(--blue)" }} />
        <div className="corner-accent corner-bl" style={{ borderColor: "var(--blue)" }} />
        <div className="corner-accent corner-br" style={{ borderColor: "var(--blue)" }} />

        <div className="center-form-inner">
        <div className="form-row" style={{ marginBottom: "1.5rem" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><span className="label-icon">🚌</span> Select Bus</label>
            <div className="select-wrap">
              <select value={busId} onChange={e => setBusId(e.target.value)}>
                <option value="">— Choose a bus —</option>
                {buses.map(b => (
                  <option key={b._id} value={b._id}>{b.busNumber} · {b.routeName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label><span className="label-icon">🧭</span> Direction Filter</label>
            <div className="select-wrap">
              <select value={filterDir} onChange={e => setFilterDir(e.target.value)}>
                <option value="ALL">All Directions</option>
                {DIRECTIONS.map(d => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
              </select>
            </div>
          </div>
        </div>

      {busId && filterDir !== "ALL" && (
          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <label><span className="label-icon">📍</span> Check Next Departure From</label>
                <div className="select-wrap" style={{ minWidth: 160 }}>
                  <select value={filterStop} onChange={e => setFilterStop(e.target.value)}>
                    {STOPS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {nextDep && (
                <div className="next-dep-badge">
                  🕐 Next: <strong>{nextDep.nextDeparture?.time}</strong>
                  {nextDep.nextDeparture?.wrapsToTomorrow && " (tomorrow)"}
                </div>
              )}
            </div>
          </div>
        )}

        {!busId && (
          <div className="empty-state">
            <div className="empty-icon">🗓</div>
            <h3>Select a bus</h3>
            <p>Choose a bus to view its schedule</p>
          </div>
        )}

        {busId && !loading && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No schedule found</h3>
            <p>No trips have been added for this bus yet</p>
          </div>
        )}

        {loading && <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Loading schedule…</div>}

        <div className="schedule-grid">
          {filtered.map((trip, i) => {
            const orderedTimes = trip.direction === "TO_VAVUNIYA"
              ? [...trip.stopTimes].reverse()
              : trip.stopTimes;
            return (
              <div key={trip._id || i} className="trip-card">
                <div className="trip-card-header">
                  <span className="trip-direction">{DIRECTION_LABELS[trip.direction]}</span>
                  <span className="tag" style={{ color: "var(--muted)", background: "var(--bg2)", borderColor: "var(--border)" }}>
                    {trip.stopTimes.length} stops
                  </span>
                </div>
                <div className="trip-times">
                  {trip.stopTimes.map((st, j) => (
                    <div key={st.stop} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div className="trip-stop">
                        <div className="trip-stop-name">{st.stop}</div>
                        <div className="trip-stop-time">{st.time}</div>
                      </div>
                      {j < trip.stopTimes.length - 1 && (
                        <div className="trip-arrow">›</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Page — Centered glass panel with visual glow effects
// ─────────────────────────────────────────────────────────────────────────────
function ReportPage({ buses, user }) {
  const [form, setForm] = useState({
    busId: "", currentStop: "", direction: "TO_UNIVERSITY",
    updateType: "spotted", crowdLevel: "seats_available",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.busId || !form.currentStop) {
      toast("Please fill in all fields", "error"); return;
    }
    setLoading(true);
    const { ok, data } = await updateApi.create({
      ...form,
      deviceId: getDeviceId(),
    });
    setLoading(false);
    if (ok) {
      toast("Update submitted successfully!", "success");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      setForm(p => ({ ...p, busId: "", currentStop: "" }));
    } else {
      toast(data.message || "Failed to submit update", "error");
    }
  };

  const crowdIcon = { seats_available: "🟢", standing_only: "🟡", fully_crowded: "🔴" };
  const dirIcon   = { TO_UNIVERSITY: "→", TO_VAVUNIYA: "←" };

  return (
    <div className="centered-page">
      {/* Ambient glow orbs */}
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" />
          LIVE REPORTING
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Report <em>Location</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Help others · Submit a bus update
        </p>
      </div>

      <div className="center-form-shell">
        {/* Decorative corner accents */}
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />

        <div className="center-form-inner">
          {/* Bus selector */}
          <div className="form-group">
            <label>
              <span className="label-icon">🚌</span> Bus
            </label>
            <div className="select-wrap">
              <select value={form.busId} onChange={e => set("busId", e.target.value)}>
                <option value="">— Select bus —</option>
                {buses.map(b => (
                  <option key={b._id} value={b._id}>{b.busNumber} · {b.routeName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stop + Direction */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <span className="label-icon">📍</span> Current Stop
              </label>
              <div className="select-wrap">
                <select value={form.currentStop} onChange={e => set("currentStop", e.target.value)}>
                  <option value="">— Select stop —</option>
                  {STOPS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">🧭</span> Direction
              </label>
              <div className="select-wrap">
                <select value={form.direction} onChange={e => set("direction", e.target.value)}>
                  {DIRECTIONS.map(d => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Update Type + Crowd Level as visual toggle pills */}
          <div className="form-row">
            <div className="form-group">
              <label>
                <span className="label-icon">👁</span> Update Type
              </label>
              <div className="pill-toggle">
                {UPDATE_TYPES.map(t => (
                  <button
                    key={t.value}
                    className={`pill-btn ${form.updateType === t.value ? "pill-active" : ""}`}
                    onClick={() => set("updateType", t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>
                <span className="label-icon">👥</span> Crowd Level
              </label>
              <div className="pill-toggle">
                {CROWD_LEVELS.map(c => (
                  <button
                    key={c.value}
                    className={`pill-btn ${form.crowdLevel === c.value ? "pill-active" : ""}`}
                    onClick={() => set("crowdLevel", c.value)}
                  >
                    {crowdIcon[c.value]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary preview strip */}
          {form.busId && form.currentStop && (
            <div className="report-preview">
              <span className="preview-dot" />
              <span>
                Reporting bus at <strong style={{ color: "var(--accent)" }}>{form.currentStop}</strong>
                {" "}{dirIcon[form.direction]}{" "}
                {crowdIcon[form.crowdLevel]}
              </span>
            </div>
          )}

          {user && (
            <div className="reporter-badge">
              <span className="reporter-avatar">{user.name[0].toUpperCase()}</span>
              <span>Reporting as <span style={{ color: "var(--accent)" }}>{user.name}</span></span>
            </div>
          )}

          <button
            className={`btn btn-primary submit-glow ${submitted ? "submit-success" : ""}`}
            style={{ width: "100%", marginTop: "0.25rem", padding: "14px 20px", fontSize: "0.85rem" }}
            onClick={submit}
            disabled={loading}
          >
            {loading
              ? <><div className="spinner" /> Submitting…</>
              : submitted
              ? "✓ Submitted!"
              : "Submit Update"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Bus Page — Centered glass panel (Admin)
// ─────────────────────────────────────────────────────────────────────────────
function AddBusPage({ onBusAdded }) {
  const [form, setForm] = useState({ busNumber: "", routeName: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.busNumber.trim() || !form.routeName.trim()) {
      toast("Both fields are required", "error"); return;
    }
    setLoading(true);
    const { ok, data } = await busApi.create(form);
    setLoading(false);
    if (ok) {
      toast(`Bus ${form.busNumber} registered!`, "success");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      setForm({ busNumber: "", routeName: "" });
      onBusAdded?.();
    } else {
      toast(data.message || "Failed to create bus", "error");
    }
  };

  return (
    <div className="centered-page">
      {/* Ambient glow orbs */}
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(74,144,217,0.18) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.12) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" style={{ background: "var(--blue)" }} />
          ADMIN · BUS REGISTRY
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Add <em>Bus</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Register a new bus to the system
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 460 }}>
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />

        {/* Bus icon medallion */}
        <div className="form-medallion">
          <span>🚌</span>
        </div>

        <div className="center-form-inner" style={{ paddingTop: "1rem" }}>
          <div className="form-group">
            <label>
              <span className="label-icon">#</span> Bus Number
            </label>
            <input
              type="text"
              placeholder="e.g. Bus-01"
              value={form.busNumber}
              onChange={e => set("busNumber", e.target.value)}
              className="glow-input"
            />
          </div>
          <div className="form-group">
            <label>
              <span className="label-icon">🗺</span> Route Name
            </label>
            <input
              type="text"
              placeholder="e.g. Vavuniya–University"
              value={form.routeName}
              onChange={e => set("routeName", e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              className="glow-input"
            />
          </div>

          {/* Live preview */}
          {(form.busNumber || form.routeName) && (
            <div className="report-preview" style={{ marginBottom: "1rem" }}>
              <span className="preview-dot" style={{ background: "var(--blue)" }} />
              <span>
                <strong style={{ color: "var(--accent)" }}>{form.busNumber || "—"}</strong>
                {" · "}
                <span style={{ color: "var(--muted)" }}>{form.routeName || "unnamed route"}</span>
              </span>
            </div>
          )}

          <button
            className={`btn btn-primary submit-glow ${submitted ? "submit-success" : ""}`}
            style={{ width: "100%", padding: "14px 20px", fontSize: "0.85rem" }}
            onClick={submit}
            disabled={loading}
          >
            {loading
              ? <><div className="spinner" /> Registering…</>
              : submitted
              ? "✓ Bus Registered!"
              : "Register Bus"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Page
// ─────────────────────────────────────────────────────────────────────────────
function HistoryPage({ buses }) {
  const [busId, setBusId] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async (id) => {
    if (!id) { setHistory([]); return; }
    setLoading(true);
    const { ok, data } = await updateApi.getAll(id);
    setLoading(false);
    if (ok) setHistory(data);
    else { setHistory([]); toast("Failed to load history", "error"); }
  };

  useEffect(() => { load(busId); }, [busId]);

  const crowdTag = (cl) => {
    if (cl === "seats_available") return <span className="tag tag-seats">Seats</span>;
    if (cl === "standing_only")   return <span className="tag tag-standing">Standing</span>;
    if (cl === "fully_crowded")   return <span className="tag tag-crowded">Crowded</span>;
    return cl;
  };

  const deleteUpdate = async (id) => {
    if (!window.confirm("Remove this update report?")) return;
    const { ok } = await updateApi.delete(id);
    if (ok) { toast("Update removed", "success"); load(busId); }
    else toast("Failed to delete update", "error");
  };

  return (
    <div className="centered-page">
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.12) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(74,144,217,0.08) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" />
          AUDIT LOG
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Update <em>History</em>
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Past location reports for each bus
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 860 }}>
        <div className="corner-accent corner-tl" />
        <div className="corner-accent corner-tr" />
        <div className="corner-accent corner-bl" />
        <div className="corner-accent corner-br" />

        <div className="center-form-inner">
          <div className="section-header">
            <span className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="label-icon">📜</span> Select Bus
            </span>
            {history.length > 0 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)" }}>
                {history.length} records
              </span>
            )}
          </div>
          <div className="select-wrap" style={{ marginBottom: "1.5rem" }}>
            <select value={busId} onChange={e => setBusId(e.target.value)}>
              <option value="">— Choose a bus —</option>
              {buses.map(b => (
                <option key={b._id} value={b._id}>{b.busNumber} · {b.routeName}</option>
              ))}
            </select>
          </div>

          {!busId && (
            <div className="empty-state">
              <div className="empty-icon">📜</div>
              <h3>Select a bus</h3>
              <p>Choose a bus to view its update history</p>
            </div>
          )}

          {busId && !loading && history.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🚌</div>
              <h3>No history found</h3>
              <p>No updates have been submitted for this bus yet</p>
            </div>
          )}

          {loading && <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Loading…</div>}

          {history.length > 0 && (
            <div className="card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Stop</th>
                      <th>Direction</th>
                      <th>Type</th>
                      <th>Crowd</th>
                      <th>Reporter</th>
                      <th>When</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(u => (
                      <tr key={u._id}>
                        <td style={{ fontWeight: 500 }}>{u.currentStop}</td>
                        <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                          {DIRECTION_LABELS[u.direction] || u.direction}
                        </td>
                        <td><span className={`tag tag-${u.updateType}`}>{u.updateType}</span></td>
                        <td>{crowdTag(u.crowdLevel)}</td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--muted)" }}>
                          {u.reportedBy}
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--muted)" }}>
                          {timeAgo(u.timestamp)}
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteUpdate(u._id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Page — Manage Buses + Schedules
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage({ buses, onReload }) {
  const [editModal, setEditModal] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [schedModal, setSchedModal] = useState(null);
  const [schedLoading, setSchedLoading] = useState(false);
  const [busSchedules, setBusSchedules] = useState({});

  const loadBusSchedule = async (busId) => {
    const { ok, data } = await busApi.getSchedule(busId);
    if (ok) setBusSchedules(p => ({ ...p, [busId]: data.schedule || [] }));
  };

  const handleDeleteBus = async (id, number) => {
    if (!window.confirm(`Delete bus ${number} and all its updates?`)) return;
    const { ok, data } = await busApi.delete(id);
    if (ok) { toast(`Bus ${number} deleted`, "success"); onReload(); }
    else toast(data.message || "Failed to delete bus", "error");
  };

  const handleEditBus = async () => {
    setEditLoading(true);
    const { ok, data } = await busApi.update(editModal.id, { status: editModal.status });
    setEditLoading(false);
    if (ok) { toast("Bus updated!", "success"); setEditModal(null); onReload(); }
    else toast(data.message || "Failed to update", "error");
  };

  const emptyStopTimes = (dir) => {
    const stops = dir === "TO_VAVUNIYA" ? [...STOPS].reverse() : STOPS;
    return stops.map(stop => ({ stop, time: "06:00" }));
  };

  const openAddTrip = (bus) => {
    setSchedModal({
      busId: bus._id, busNumber: bus.busNumber,
      tripId: null, direction: "TO_UNIVERSITY",
      stopTimes: emptyStopTimes("TO_UNIVERSITY"),
    });
    loadBusSchedule(bus._id);
  };

  const handleSchedDirChange = (dir) => {
    setSchedModal(p => ({ ...p, direction: dir, stopTimes: emptyStopTimes(dir) }));
  };

  const handleTimeChange = (idx, time) => {
    setSchedModal(p => {
      const st = [...p.stopTimes];
      st[idx] = { ...st[idx], time };
      return { ...p, stopTimes: st };
    });
  };

  const handleSaveTrip = async () => {
    setSchedLoading(true);
    const body = { direction: schedModal.direction, stopTimes: schedModal.stopTimes };
    let res;
    if (schedModal.tripId) {
      res = await busApi.updateTrip(schedModal.busId, schedModal.tripId, body);
    } else {
      res = await busApi.addTrip(schedModal.busId, body);
    }
    setSchedLoading(false);
    if (res.ok) {
      toast(schedModal.tripId ? "Trip updated!" : "Trip added!", "success");
      setSchedModal(null);
      loadBusSchedule(schedModal.busId);
    } else {
      toast(res.data.message || "Failed to save trip", "error");
    }
  };

  const handleDeleteTrip = async (busId, tripId) => {
    if (!window.confirm("Delete this schedule trip?")) return;
    const { ok, data } = await busApi.deleteTrip(busId, tripId);
    if (ok) { toast("Trip deleted", "success"); loadBusSchedule(busId); }
    else toast(data.message || "Failed", "error");
  };

  const handleEditTrip = (bus, trip) => {
    setSchedModal({
      busId: bus._id, busNumber: bus.busNumber,
      tripId: trip._id, direction: trip.direction,
      stopTimes: trip.stopTimes.map(s => ({ ...s })),
    });
  };

  return (
    <div className="centered-page">
      <div className="ambient-orb orb-1" style={{ background: "radial-gradient(circle, rgba(240,64,64,0.10) 0%, transparent 70%)" }} />
      <div className="ambient-orb orb-2" style={{ background: "radial-gradient(circle, rgba(232,184,75,0.10) 0%, transparent 70%)" }} />

      <div className="page-header-centered">
        <div className="page-eyebrow">
          <span className="eyebrow-dot" style={{ background: "var(--red)", boxShadow: "0 0 8px var(--red)" }} />
          ADMIN · SYSTEM CONTROL
        </div>
        <h1 className="hero-title" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <em>Admin</em> Panel
        </h1>
        <p className="hero-sub" style={{ textAlign: "center" }}>
          Manage buses · Edit schedules · View system
        </p>
      </div>

      <div className="center-form-shell" style={{ maxWidth: 860, boxShadow: "0 0 0 1px rgba(240,64,64,0.05), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(240,64,64,0.03) inset" }}>
        <div className="corner-accent corner-tl" style={{ borderColor: "var(--red)" }} />
        <div className="corner-accent corner-tr" style={{ borderColor: "var(--red)" }} />
        <div className="corner-accent corner-bl" style={{ borderColor: "var(--red)" }} />
        <div className="corner-accent corner-br" style={{ borderColor: "var(--red)" }} />

        <div className="center-form-inner">
        <div className="section-header" style={{ marginBottom: "1.25rem" }}>
          <span className="section-title">All Buses</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)" }}>
            {buses.length} registered
          </span>
        </div>

      {buses.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🚌</div>
          <h3>No buses registered</h3>
          <p>Go to "Add Bus" tab to register the first bus</p>
        </div>
      )}

      {buses.map(b => (
        <div key={b._id} className="card" style={{ marginBottom: "1rem" }}>
          <div className="bus-row" style={{ border: "none", padding: 0, marginBottom: "1rem" }}>
            <div>
              <div className="bus-number">{b.busNumber}</div>
              <div className="bus-route">{b.routeName}</div>
            </div>
            <div className="bus-actions">
              <span className={b.status === "active" ? "status-active" : "status-inactive"}>{b.status}</span>
              <button className="btn btn-ghost btn-sm"
                onClick={() => setEditModal({ id: b._id, status: b.status })}>
                Edit Status
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBus(b._id, b.busNumber)}>
                Delete
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div className="section-header" style={{ marginBottom: "0.75rem" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Schedule Trips
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                openAddTrip(b);
                loadBusSchedule(b._id);
              }}>+ Add Trip</button>
            </div>

            {!busSchedules[b._id] && (
              <button className="btn btn-ghost btn-sm" onClick={() => loadBusSchedule(b._id)}>
                View Schedule
              </button>
            )}

            {busSchedules[b._id] && busSchedules[b._id].length === 0 && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--muted)" }}>
                No trips added yet
              </p>
            )}

            {busSchedules[b._id]?.map(trip => (
              <div key={trip._id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.6rem 0.75rem", background: "var(--bg2)",
                borderRadius: 8, marginBottom: 6, gap: "1rem",
              }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent)" }}>
                    {DIRECTION_LABELS[trip.direction]}
                  </span>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>
                    {trip.stopTimes.map(s => `${s.stop} ${s.time}`).join(" › ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEditTrip(b, trip)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTrip(b._id, trip._id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {editModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditModal(null); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            <div className="modal-title">Edit Bus Status</div>
            <div className="form-group">
              <label>Status</label>
              <div className="select-wrap">
                <select value={editModal.status}
                  onChange={e => setEditModal(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditBus} disabled={editLoading}>
                {editLoading ? <><div className="spinner" /> Saving…</> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {schedModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSchedModal(null); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <button className="modal-close" onClick={() => setSchedModal(null)}>✕</button>
            <div className="modal-title">
              {schedModal.tripId ? "Edit" : "Add"} Schedule Trip · {schedModal.busNumber}
            </div>

            <div className="form-group">
              <label>Direction</label>
              <div className="select-wrap">
                <select
                  value={schedModal.direction}
                  onChange={e => handleSchedDirChange(e.target.value)}
                  disabled={!!schedModal.tripId}
                >
                  {DIRECTIONS.map(d => <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>)}
                </select>
              </div>
            </div>

            <label style={{ marginBottom: "0.75rem", display: "block" }}>Stop Times</label>
            <div className="stop-times-grid">
              {schedModal.stopTimes.map((st, i) => (
                <div key={st.stop} className="stop-time-row">
                  <span className="stop-time-name">{st.stop}</span>
                  <input
                    type="time"
                    value={st.time}
                    onChange={e => handleTimeChange(i, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSchedModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTrip} disabled={schedLoading}>
                {schedLoading ? <><div className="spinner" /> Saving…</> : "Save Trip"}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Page
// ─────────────────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setLoading(true);
    const { ok, data } = mode === "login"
      ? await authApi.login({ email: form.email, password: form.password })
      : await authApi.register(form);
    setLoading(false);

    if (ok) {
      setToken(data.token);
      setUser(data.user);
      onAuth(data.user);
    } else {
      toast(data.message || "Authentication failed", "error");
    }
  };

  return (
    <div className="auth-center">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🚌</div>
          Bus<span>Track</span>
        </div>
        <div className="auth-title">{mode === "login" ? "Welcome back" : "Create account"}</div>
        <div className="auth-sub">
          {mode === "login" ? "Sign in to report bus locations" : "Join to help track bus locations"}
        </div>

        {mode === "register" && (
          <div className="form-group">
            <label>Name</label>
            <input type="text" placeholder="Your name" value={form.name} onChange={e => set("name", e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label>Email</label>
          <input type="email" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} />
        </div>

        <div className="form-group">
          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(p => !p)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}
          onClick={submit} disabled={loading}>
          {loading
            ? <><div className="spinner" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
            : mode === "login" ? "Sign In" : "Create Account"
          }
        </button>

        <div className="auth-toggle">
          {mode === "login"
            ? <>Don't have an account? <button onClick={() => setMode("register")}>Register</button></>
            : <>Already have an account? <button onClick={() => setMode("login")}>Sign in</button></>
          }
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App Root
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "live",     label: "Live",     public: true  },
  { id: "schedule", label: "Schedule", public: true  },
  { id: "report",   label: "Report",   public: false },
  { id: "add-bus",  label: "Add Bus",  public: false, adminOnly: true },
  { id: "history",  label: "History",  public: false },
  { id: "admin",    label: "Admin",    public: false, adminOnly: true },
];

export default function App() {
  const [user, setUserState] = useState(getUser);
  const [tab, setTab] = useState("live");
  const [buses, setBuses] = useState([]);
  const [busLoading, setBusLoading] = useState(true);

  const loadBuses = useCallback(async () => {
    setBusLoading(true);
    const { ok, data } = await busApi.getAll();
    setBusLoading(false);
    if (ok) setBuses(data);
  }, []);

  useEffect(() => { loadBuses(); }, [loadBuses]);

  useEffect(() => {
    if (getToken() && !user) {
      authApi.me().then(({ ok, data }) => {
        if (ok) { setUserState(data.user); setUser(data.user); }
        else { clearToken(); clearUser(); }
      });
    }
  }, []);

  const handleAuth = (u) => { setUserState(u); setTab("live"); };

  const handleLogout = () => {
    clearToken(); clearUser(); setUserState(null); setTab("live");
    toast("Signed out", "info");
  };

  useEffect(() => {
    const current = TABS.find(t => t.id === tab);
    if (current && !current.public && !user) setTab("live");
    if (current?.adminOnly && user?.role !== "admin") setTab("live");
  }, [tab, user]);

  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly) return user?.role === "admin";
    return true;
  });

  return (
    <>
      <ToastContainer />

      {!user && tab !== "live" && tab !== "schedule" ? (
        <AuthPage onAuth={handleAuth} />
      ) : (
        <>
          <header className="header">
            <div className="logo">
              <div className="logo-icon">🚌</div>
              Bus<span>Track</span>
            </div>

            <nav className="nav-tabs">
              {visibleTabs.map(t => (
                <button
                  key={t.id}
                  className={`nav-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => {
                    if (!t.public && !user) {
                      toast("Please sign in to access this tab", "info");
                      return;
                    }
                    setTab(t.id);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="header-right">
              <div className="status-pill">
                <div className="status-dot" />
                {busLoading ? "Loading…" : `${buses.length} buses`}
              </div>
              {user ? (
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setTab("__auth__")}>
                  Sign In
                </button>
              )}
            </div>
          </header>

          {tab === "__auth__" && (
            <AuthPage onAuth={handleAuth} />
          )}

          {tab !== "__auth__" && (
            <main>
              {tab === "live"     && <LivePage buses={buses} />}
              {tab === "schedule" && <SchedulePage buses={buses} />}
              {tab === "report"   && user && <ReportPage buses={buses} user={user} />}
              {tab === "add-bus"  && user?.role === "admin" && <AddBusPage onBusAdded={loadBuses} />}
              {tab === "history"  && user && <HistoryPage buses={buses} />}
              {tab === "admin"    && user?.role === "admin" && <AdminPage buses={buses} onReload={loadBuses} />}
            </main>
          )}
        </>
      )}
    </>
  );
}
