import { useMemo, useState } from 'react';

type Locale = 'de' | 'en';
type Theme = 'light' | 'dark';
type Page = 'sessions' | 'upload' | 'analysis' | 'segments' | 'compare' | 'profile';
type SessionType = 'Training' | 'Match' | 'Rehab';
type SegmentType = 'Warm-up' | 'Spielform' | 'Technik' | 'Torschuss' | 'Athletik' | 'Cool-down';

type Session = {
  id: string;
  title: string;
  date: string;
  type: SessionType;
  quality: 'High' | 'Medium' | 'Low';
  metrics: {
    loadScore: number;
    distanceKm: number;
    sprintMeters: number;
    maxSpeed: number;
    hiMinutes: number;
    trimp: number;
    hrRecovery: number;
  };
  segmentType: SegmentType;
};

const sessions: Session[] = [
  {
    id: 's1',
    title: 'Abendtraining 7v7',
    date: '2026-02-18',
    type: 'Training',
    quality: 'High',
    segmentType: 'Spielform',
    metrics: { loadScore: 78, distanceKm: 8.4, sprintMeters: 790, maxSpeed: 31.6, hiMinutes: 18, trimp: 112, hrRecovery: 24 }
  },
  {
    id: 's2',
    title: 'Liga Spieltag 12',
    date: '2026-02-14',
    type: 'Match',
    quality: 'Medium',
    segmentType: 'Athletik',
    metrics: { loadScore: 84, distanceKm: 9.1, sprintMeters: 910, maxSpeed: 32.8, hiMinutes: 21, trimp: 125, hrRecovery: 21 }
  },
  {
    id: 's3',
    title: 'Regeneration',
    date: '2026-02-10',
    type: 'Rehab',
    quality: 'Low',
    segmentType: 'Cool-down',
    metrics: { loadScore: 38, distanceKm: 4.3, sprintMeters: 120, maxSpeed: 21.2, hiMinutes: 4, trimp: 54, hrRecovery: 31 }
  }
];

const baselineHint = 'Automatische Baseline: letzte 8 vergleichbare Sessions (Fallback auf 3-7).';

const copy = {
  de: {
    appName: 'Football-Metriken',
    subtitle: 'Mobile-first Analyse für Amateurfußball',
    nav: { sessions: 'Sessions', upload: 'Upload', analysis: 'Analyse', segments: 'Segmente', compare: 'Vergleich', profile: 'Profil' },
    findStart: 'Finden & Starten',
    filterType: 'Typ',
    filterQuality: 'Qualität',
    uploadTitle: 'Upload-Flow',
    uploadStep1: '1) Datei wählen',
    uploadStep2: '2) Qualitätsübersicht',
    uploadStep3: '3) Direkt zur Session-Analyse',
    qualityImpact: 'Impact: Medium Qualität kann GPS-Spitzen leicht unterschätzen.',
    analysisTitle: 'Session-Analyse',
    aggregateMessage: 'Aggregierte Kernaussage',
    aggregateText: 'Belastung hoch, intensive Minuten über Baseline, Erholung stabil.',
    extMetrics: 'Externe Metriken',
    intMetrics: 'Interne Metriken',
    unavailable: 'Nicht verfügbar',
    metricInfo: 'Info',
    segmentsTitle: 'Segment-Analyse',
    compareTitle: 'Vergleich',
    profileTitle: 'Profil & Einstellungen',
    theme: 'Designmodus',
    language: 'Sprache',
    light: 'Hell',
    dark: 'Dunkel',
    metricExplainer: 'Metrikbeschreibungen',
    minutesMode: 'Deep-Dive 1/2/5 Minuten',
    qualityDetails: 'Qualitätsdetails'
  },
  en: {
    appName: 'Football Metrics',
    subtitle: 'Mobile-first analytics for amateur football',
    nav: { sessions: 'Sessions', upload: 'Upload', analysis: 'Analysis', segments: 'Segments', compare: 'Compare', profile: 'Profile' },
    findStart: 'Find & Start',
    filterType: 'Type',
    filterQuality: 'Quality',
    uploadTitle: 'Upload flow',
    uploadStep1: '1) Choose file',
    uploadStep2: '2) Quality summary',
    uploadStep3: '3) Open session analysis',
    qualityImpact: 'Impact: Medium quality may slightly underestimate GPS peaks.',
    analysisTitle: 'Session analysis',
    aggregateMessage: 'Aggregated insight',
    aggregateText: 'High load, intense minutes above baseline, recovery stable.',
    extMetrics: 'External metrics',
    intMetrics: 'Internal metrics',
    unavailable: 'Not available',
    metricInfo: 'Info',
    segmentsTitle: 'Segment analysis',
    compareTitle: 'Comparison',
    profileTitle: 'Profile & settings',
    theme: 'Theme mode',
    language: 'Language',
    light: 'Light',
    dark: 'Dark',
    metricExplainer: 'Metric descriptions',
    minutesMode: 'Deep dive 1/2/5 minutes',
    qualityDetails: 'Quality details'
  }
};

const metricDefinitions = [
  { key: 'distanceKm', label: 'Distanz (km)', info: 'Klassische KPI als Primärwertkarte.', visual: 'KPI card + baseline pill.' },
  { key: 'sprintMeters', label: 'Sprintdistanz (m)', info: 'Zeigt Explosivität über horizontale Progress-Bar.', visual: 'Progress bar with target marker.' },
  { key: 'maxSpeed', label: 'Max Speed (km/h)', info: 'Top-Speed im kompakten Tachometer-Stil.', visual: 'Ring gauge.' },
  { key: 'hiMinutes', label: 'High Intensity (min)', info: 'Intensive Minuten als 1/2/5 Min Sparkbars.', visual: 'Mini bar timeline.' },
  { key: 'trimp', label: 'TRIMP', info: 'Interne Belastung in farbneutraler Last-Karte.', visual: 'Load card with badge.' },
  { key: 'hrRecovery', label: 'HF-Recovery 60s', info: 'Regeneration als Delta-Indikator.', visual: 'Delta chip (+/- baseline).' }
] as const;

function MetricCard({ label, value, unit, info, unavailable }: { label: string; value: number | null; unit: string; info: string; unavailable?: boolean }) {
  return (
    <div className="card metric-card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <h3 className="h6 mb-2">{label}</h3>
          <span className="badge text-bg-secondary">i</span>
        </div>
        <p className="small text-body-secondary mb-2">{info}</p>
        <div className="display-6 fw-semibold">{unavailable || value === null ? '—' : `${value}${unit}`}</div>
      </div>
    </div>
  );
}

export function App() {
  const [locale, setLocale] = useState<Locale>(navigator.language.startsWith('de') ? 'de' : 'en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [page, setPage] = useState<Page>('sessions');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<'All' | SessionType>('All');
  const [qualityFilter, setQualityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const active = sessions[0];
  const t = copy[locale];

  const filteredSessions = useMemo(
    () =>
      sessions.filter(
        (s) => (sessionTypeFilter === 'All' || s.type === sessionTypeFilter) && (qualityFilter === 'All' || s.quality === qualityFilter)
      ),
    [qualityFilter, sessionTypeFilter]
  );

  return (
    <div data-bs-theme={theme} className="app-shell pb-5">
      <header className="sticky-top app-header border-bottom">
        <div className="container-fluid py-2">
          <h1 className="h4 mb-0">{t.appName}</h1>
          <p className="small mb-0 text-body-secondary">{t.subtitle}</p>
        </div>
      </header>

      <main className="container-fluid py-3">
        {page === 'sessions' && (
          <section>
            <h2 className="h5">{t.findStart}</h2>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label mb-1">{t.filterType}</label>
                <select className="form-select" value={sessionTypeFilter} onChange={(e) => setSessionTypeFilter(e.target.value as 'All' | SessionType)}>
                  <option>All</option><option>Training</option><option>Match</option><option>Rehab</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label mb-1">{t.filterQuality}</label>
                <select className="form-select" value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value as 'All' | 'High' | 'Medium' | 'Low')}>
                  <option>All</option><option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>
            <div className="d-grid gap-2">
              {filteredSessions.map((s) => (
                <button key={s.id} className="btn btn-outline-secondary text-start session-item" onClick={() => setPage('analysis')}>
                  <div className="fw-semibold">{s.title}</div>
                  <div className="small text-body-secondary">{s.date} · {s.type} · {s.quality}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {page === 'upload' && (
          <section>
            <h2 className="h5">{t.uploadTitle}</h2>
            <ol className="list-group list-group-numbered">
              <li className="list-group-item">{t.uploadStep1}</li>
              <li className="list-group-item">{t.uploadStep2}<div className="small text-body-secondary mt-1">{t.qualityImpact}</div></li>
              <li className="list-group-item">{t.uploadStep3}</li>
            </ol>
          </section>
        )}

        {page === 'analysis' && (
          <section>
            <h2 className="h5">{t.analysisTitle}</h2>
            <div className="alert alert-primary" role="status">
              <strong>{t.aggregateMessage}:</strong> {t.aggregateText}
            </div>
            <p className="small mb-2 text-body-secondary">{baselineHint}</p>
            <h3 className="h6">{t.extMetrics}</h3>
            <div className="row g-2 mb-3">
              <div className="col-12 col-sm-6"><MetricCard label="Distanz" value={active.metrics.distanceKm} unit=" km" info="Standard KPI für Sessionvolumen." /></div>
              <div className="col-12 col-sm-6"><MetricCard label="Sprintdistanz" value={active.metrics.sprintMeters} unit=" m" info="Fortschrittsbalken inkl. Zielbereich." /></div>
              <div className="col-12"><div className="progress" role="progressbar" aria-label="Sprint progress" aria-valuenow={active.metrics.sprintMeters} aria-valuemin={0} aria-valuemax={1000}><div className="progress-bar" style={{ width: `${Math.min((active.metrics.sprintMeters / 1000) * 100, 100)}%` }} /></div></div>
            </div>
            <h3 className="h6">{t.intMetrics}</h3>
            <div className="row g-2">
              <div className="col-6"><MetricCard label="TRIMP" value={active.metrics.trimp} unit="" info="Interne Last für Belastungssteuerung." /></div>
              <div className="col-6"><MetricCard label="HF-Recovery" value={active.metrics.hrRecovery} unit=" bpm" info="Drop nach 60s als Erholungsqualität." /></div>
              <div className="col-12"><div className="hr-zones" aria-label="Heart rate zones visualization" /></div>
            </div>
          </section>
        )}

        {page === 'segments' && (
          <section>
            <h2 className="h5">{t.segmentsTitle}</h2>
            <div className="card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center"><strong>{active.segmentType}</strong><span className="badge text-bg-info">Segment A</span></div>
                <p className="small text-body-secondary mb-1">Gleiche Analysegrammatik wie Session-Ansicht.</p>
                <div className="heatmap-grid" aria-label="heatmap" />
              </div>
            </div>
          </section>
        )}

        {page === 'compare' && (
          <section>
            <h2 className="h5">{t.compareTitle}</h2>
            <p className="small text-body-secondary">Session vs Session und Segment vs Segment, 1 Schritt entfernt.</p>
            <table className="table table-sm">
              <thead><tr><th>Metrik</th><th>Aktuell</th><th>Baseline</th><th>Δ</th></tr></thead>
              <tbody>
                <tr><td>Load Score</td><td>{active.metrics.loadScore}</td><td>72</td><td className="text-success">+6</td></tr>
                <tr><td>Distanz</td><td>{active.metrics.distanceKm} km</td><td>7.8 km</td><td className="text-success">+0.6</td></tr>
                <tr><td>{t.unavailable}</td><td>—</td><td>—</td><td>—</td></tr>
              </tbody>
            </table>
          </section>
        )}

        {page === 'profile' && (
          <section>
            <h2 className="h5">{t.profileTitle}</h2>
            <div className="card mb-2"><div className="card-body">
              <label htmlFor="theme-select" className="form-label">{t.theme}</label>
              <select id="theme-select" className="form-select mb-3" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                <option value="light">{t.light}</option>
                <option value="dark">{t.dark}</option>
              </select>
              <label htmlFor="language-select" className="form-label">{t.language}</label>
              <select id="language-select" className="form-select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div></div>
            <h3 className="h6">{t.metricExplainer}</h3>
            <ul className="list-group">
              {metricDefinitions.map((m) => (
                <li className="list-group-item" key={m.key}><strong>{m.label}:</strong> {m.info} <span className="text-body-secondary">({m.visual})</span></li>
              ))}
            </ul>
            <p className="small text-body-secondary mt-2">{t.minutesMode} · {t.qualityDetails}</p>
          </section>
        )}
      </main>

      <nav className="mobile-nav border-top">
        <div className="container-fluid d-flex justify-content-between py-2">
          {(['sessions', 'upload', 'analysis', 'segments', 'compare', 'profile'] as Page[]).map((item) => (
            <button key={item} className={`btn btn-sm ${page === item ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setPage(item)}>
              {t.nav[item]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
