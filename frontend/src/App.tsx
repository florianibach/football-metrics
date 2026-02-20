import { useMemo, useState } from 'react';

type Page = 'sessions' | 'upload' | 'analysis' | 'segments' | 'compare' | 'profile';
type Theme = 'light' | 'dark';
type SessionType = 'Training' | 'Match' | 'Rehab' | 'Athletics';
type QualityStatus = 'High' | 'Medium' | 'Low';
type MetricGroup = 'Aggregated' | 'External' | 'Internal' | 'Heatmap' | 'Windows';

type Session = {
  id: string;
  title: string;
  date: string;
  type: SessionType;
  quality: QualityStatus;
  durationMin: number;
  baselineCount: number;
};

type Segment = {
  id: string;
  name: string;
  category: 'Warm-up' | 'Spielform' | 'Technik' | 'Torschuss' | 'Athletik' | 'Cool-down';
  loadIndex: number;
};

type MetricCard = {
  key: string;
  label: string;
  value: string;
  helper: string;
  group: MetricGroup;
  visual: 'kpi' | 'progress' | 'trend' | 'zone' | 'heatmap' | 'bars';
};

const sessions: Session[] = [
  { id: 's-24-02-18', title: 'Ligaspiel vs. Blau-Weiß', date: '2026-02-18', type: 'Match', quality: 'High', durationMin: 92, baselineCount: 8 },
  { id: 's-24-02-16', title: 'Abschlusstraining', date: '2026-02-16', type: 'Training', quality: 'Medium', durationMin: 78, baselineCount: 6 },
  { id: 's-24-02-14', title: 'Athletik-Session', date: '2026-02-14', type: 'Athletics', quality: 'High', durationMin: 61, baselineCount: 8 }
];

const segmentData: Segment[] = [
  { id: 'seg-1', name: 'Aktivierung', category: 'Warm-up', loadIndex: 34 },
  { id: 'seg-2', name: '5v5 Pressing', category: 'Spielform', loadIndex: 78 },
  { id: 'seg-3', name: 'Abschluss unter Druck', category: 'Torschuss', loadIndex: 69 },
  { id: 'seg-4', name: 'Cooldown + Mobility', category: 'Cool-down', loadIndex: 25 }
];

const metrics: MetricCard[] = [
  { key: 'kpi-readiness', label: 'Kernaussage', value: 'Belastung hoch, aber stabil', helper: 'Ampelartige Session-Zusammenfassung für schnellen Mobile-Einstieg.', group: 'Aggregated', visual: 'kpi' },
  { key: 'distance', label: 'Distanz', value: '9.4 km', helper: 'KPI-Card mit Delta zur Baseline.', group: 'External', visual: 'kpi' },
  { key: 'max-speed', label: 'Max. Geschwindigkeit', value: '31.2 km/h', helper: 'KPI-Card + Trendline (üblich in Team-Sport Dashboards).', group: 'External', visual: 'trend' },
  { key: 'sprint-count', label: 'Sprints', value: '23', helper: 'Vertikale Balken für Wiederholungsmetriken.', group: 'External', visual: 'bars' },
  { key: 'high-intensity', label: 'High Intensity Time', value: '12:40 min', helper: 'Progress-Bar relativ zur persönlichen Zielzone.', group: 'External', visual: 'progress' },
  { key: 'hr-load', label: 'TRIMP', value: '86', helper: 'KPI-Card mit Belastungszonen-Kontext.', group: 'Internal', visual: 'kpi' },
  { key: 'hr-zones', label: 'Herzfrequenz-Zonen', value: 'Z1 22% · Z2 46% · Z3 32%', helper: 'Stacked Zone-Bar als Standarddarstellung im Sport-Tracking.', group: 'Internal', visual: 'zone' },
  { key: 'recovery', label: 'HF-Recovery (60s)', value: '24 bpm', helper: 'KPI-Card mit Interpretation „Regeneration gut/mittel/schwach“.', group: 'Internal', visual: 'kpi' },
  { key: 'heatmap', label: 'Positions-Heatmap', value: 'Angriffs-Halbraum betont', helper: '2D-Feldraster (Heatmap) für räumliche Aktivität.', group: 'Heatmap', visual: 'heatmap' },
  { key: 'window-load', label: '1/2/5 Min Deep-Dive', value: 'Peak in Minute 57', helper: 'Mini-Bar-Strip für Zeitfenstervergleiche.', group: 'Windows', visual: 'bars' }
];

function qualityClass(quality: QualityStatus): string {
  return quality === 'High' ? 'fm-badge-success' : quality === 'Medium' ? 'fm-badge-warning' : 'fm-badge-danger';
}

function MetricVisual({ metric }: { metric: MetricCard }) {
  if (metric.visual === 'progress') {
    return (
      <div className="progress" role="img" aria-label={`${metric.label} progress`}>
        <div className="progress-bar" style={{ width: '72%' }}>72%</div>
      </div>
    );
  }

  if (metric.visual === 'zone') {
    return (
      <div className="fm-zone-bar" role="img" aria-label={`${metric.label} zones`}>
        <span style={{ width: '22%' }} className="fm-zone-zone1">Z1</span>
        <span style={{ width: '46%' }} className="fm-zone-zone2">Z2</span>
        <span style={{ width: '32%' }} className="fm-zone-zone3">Z3</span>
      </div>
    );
  }

  if (metric.visual === 'trend') {
    return <div className="fm-trendline" role="img" aria-label={`${metric.label} trend`} />;
  }

  if (metric.visual === 'heatmap') {
    return (
      <div className="fm-heatmap" role="img" aria-label="Pitch heatmap">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} className={`fm-cell fm-cell-${(i % 5) + 1}`} />
        ))}
      </div>
    );
  }

  if (metric.visual === 'bars') {
    return (
      <div className="fm-bars" role="img" aria-label={`${metric.label} bars`}>
        {[45, 65, 38, 82, 56, 74].map((height, i) => (
          <span key={`${metric.key}-${i}`} style={{ height: `${height}%` }} />
        ))}
      </div>
    );
  }

  return <div className="fm-kpi-pill">Baseline +6%</div>;
}

export function App() {
  const [activePage, setActivePage] = useState<Page>('sessions');
  const [theme, setTheme] = useState<Theme>('dark');
  const [sessionFilter, setSessionFilter] = useState<SessionType | 'All'>('All');
  const [qualityFilter, setQualityFilter] = useState<QualityStatus | 'All'>('All');

  const filteredSessions = useMemo(
    () => sessions.filter((session) => (sessionFilter === 'All' || session.type === sessionFilter) && (qualityFilter === 'All' || session.quality === qualityFilter)),
    [sessionFilter, qualityFilter]
  );

  return (
    <div className="fm-app" data-theme={theme}>
      <header className="navbar fm-nav sticky-top">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">Football-Metriken</span>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setActivePage('profile')}>Profil</button>
        </div>
      </header>

      <main className="container-fluid fm-main">
        {activePage === 'sessions' && (
          <section>
            <h2 className="h4 mb-2">Session-Liste</h2>
            <p className="text-secondary small">Mobile-first Einstieg: Neueste Session zuerst, dann direkt analysieren oder Upload starten.</p>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label" htmlFor="sessionTypeFilter">Sessiontyp</label>
                <select id="sessionTypeFilter" className="form-select" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value as SessionType | 'All')}>
                  <option value="All">Alle</option>
                  <option value="Training">Training</option>
                  <option value="Match">Match</option>
                  <option value="Rehab">Rehab</option>
                  <option value="Athletics">Athletics</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label" htmlFor="qualityFilter">Qualität</label>
                <select id="qualityFilter" className="form-select" value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as QualityStatus | 'All')}>
                  <option value="All">Alle</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="fm-stack">
              {filteredSessions.map((session) => (
                <article key={session.id} className="card shadow-sm fm-card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h3 className="h6 mb-0">{session.title}</h3>
                      <span className={`badge ${qualityClass(session.quality)}`}>{session.quality}</span>
                    </div>
                    <p className="small text-secondary mb-2">{session.date} · {session.type} · {session.durationMin} min</p>
                    <p className="small mb-3">Baseline: {session.baselineCount >= 3 ? `${session.baselineCount} vergleichbare Sessions` : 'zu wenig Historie'}</p>
                    <div className="d-flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => setActivePage('analysis')}>Session öffnen</button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => setActivePage('upload')}>Upload starten</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'upload' && (
          <section>
            <h2 className="h4 mb-2">Upload-Flow</h2>
            <ol className="list-group list-group-numbered mb-3">
              <li className="list-group-item">Datei hochladen (.tcx)</li>
              <li className="list-group-item">Qualitätsübersicht mit Impact-Hinweis</li>
              <li className="list-group-item">Direkt in Session-Analyse wechseln</li>
            </ol>
            <div className="alert alert-warning" role="alert">
              Qualität: <strong>Medium</strong> – GPS leicht verrauscht, Distanz kann um ~3% abweichen.
            </div>
            <button className="btn btn-primary" onClick={() => setActivePage('analysis')}>Zur Session-Analyse</button>
          </section>
        )}

        {activePage === 'analysis' && (
          <section>
            <h2 className="h4 mb-2">Session-Analyse</h2>
            <p className="small text-secondary mb-3">Struktur: Kernaussage → intern/externer Drill-down → Heatmap → 1/2/5 Min Deep-Dive.</p>
            <div className="fm-stack">
              {metrics.map((metric) => (
                <article key={metric.key} className="card fm-card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <p className="small text-secondary mb-1">{metric.group}</p>
                        <h3 className="h6 mb-1">{metric.label}</h3>
                        <p className="mb-2 fw-semibold">{metric.value}</p>
                      </div>
                    </div>
                    <MetricVisual metric={metric} />
                    <p className="small text-secondary mt-2 mb-0">{metric.helper}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'segments' && (
          <section>
            <h2 className="h4 mb-2">Segment-Analyse</h2>
            <p className="small text-secondary">Gleiche Analysegrammatik wie Session-Ebene – pro Segmentkategorie mit freier Benennung.</p>
            <div className="fm-stack">
              {segmentData.map((segment) => (
                <article key={segment.id} className="card fm-card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h3 className="h6 mb-1">{segment.name}</h3>
                        <p className="small text-secondary mb-0">{segment.category}</p>
                      </div>
                      <span className="badge text-bg-secondary">Load {segment.loadIndex}</span>
                    </div>
                    <div className="progress mt-3">
                      <div className="progress-bar" style={{ width: `${segment.loadIndex}%` }}>{segment.loadIndex}%</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activePage === 'compare' && (
          <section>
            <h2 className="h4 mb-2">Vergleich</h2>
            <p className="small text-secondary">Sekundärer Pfad: Session vs. Session, Segment vs. Segment, Halbzeit A vs. B und Baseline.</p>
            <div className="card fm-card">
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr><th>Metrik</th><th>Aktuelle Session</th><th>Baseline</th><th>Delta</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Distanz</td><td>9.4 km</td><td>8.8 km</td><td className="text-success">+6.8%</td></tr>
                      <tr><td>TRIMP</td><td>86</td><td>81</td><td className="text-success">+6.2%</td></tr>
                      <tr><td>Sprints</td><td>23</td><td>25</td><td className="text-danger">-8.0%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePage === 'profile' && (
          <section>
            <h2 className="h4 mb-2">Profil & Einstellungen</h2>
            <div className="card fm-card mb-3">
              <div className="card-body">
                <h3 className="h6">Theme</h3>
                <p className="small text-secondary">Dark/Light Umschaltung für bessere Lesbarkeit in Kabine und Outdoor.</p>
                <div className="btn-group" role="group" aria-label="Theme toggle">
                  <button className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTheme('light')}>Light</button>
                  <button className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTheme('dark')}>Dark</button>
                </div>
              </div>
            </div>
            <div className="card fm-card">
              <div className="card-body">
                <h3 className="h6">Farbschema-Vorschlag (clean, wenig Farben)</h3>
                <ul className="small mb-0">
                  <li>Primary: Tiefes Blau #3A5A78 (Navigation, Fokus, CTA)</li>
                  <li>Neutral: Slate-Grau #8A97A6 (Texte, Border, Sekundärinfos)</li>
                  <li>Success: Grün #2F7D5B (positive Deltas)</li>
                  <li>Warning: Amber #C78B3B (Qualitätshinweise)</li>
                  <li>Danger: Rot #B85353 (kritische Warnungen)</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="fm-bottom-nav" aria-label="Hauptnavigation">
        <button className={`btn btn-link ${activePage === 'sessions' ? 'active' : ''}`} onClick={() => setActivePage('sessions')}>Sessions</button>
        <button className={`btn btn-link ${activePage === 'upload' ? 'active' : ''}`} onClick={() => setActivePage('upload')}>Upload</button>
        <button className={`btn btn-link ${activePage === 'analysis' ? 'active' : ''}`} onClick={() => setActivePage('analysis')}>Analyse</button>
        <button className={`btn btn-link ${activePage === 'segments' ? 'active' : ''}`} onClick={() => setActivePage('segments')}>Segmente</button>
        <button className={`btn btn-link ${activePage === 'compare' ? 'active' : ''}`} onClick={() => setActivePage('compare')}>Vergleich</button>
      </nav>
    </div>
  );
}
