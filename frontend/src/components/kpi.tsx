export type MetricListItemProps = {
  label: string;
  value: string | number;
  helpText: string;
};

export type KpiCardDeltaRow = {
  label: string;
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
};

export type KpiCardComparisonDelta = {
  value: string;
  tone: 'positive' | 'negative' | 'neutral';
};

export type KpiCardProps = {
  label: string;
  primaryValue?: string;
  primaryValues?: string[];
  helpText: string;
  comparisonAverage?: string | null;
  comparisonBest?: string | null;
  comparisonDelta?: KpiCardComparisonDelta | null;
  secondaryRows?: string[];
  deltaRows?: KpiCardDeltaRow[];
  trendHint?: string;
  actions?: Array<{ label: string; onClick: () => void }>;
};

export type HrZoneBar = {
  label: string;
  value: string;
  percent: number;
};

function emitMetricHelp(label: string, helpText: string) {
  window.dispatchEvent(new CustomEvent('metric-help-open', { detail: { label, helpText } }));
}

export function MetricListItem({ label, value, helpText }: MetricListItemProps) {
  return (
    <li className="list-group-item">
      <strong>{label}:</strong> {value}{' '}
      <button
        type="button"
        className="metric-help"
        aria-label={`${label} explanation`}
        onClick={() => emitMetricHelp(label, helpText)}
      >
        <i className="bi bi-info-circle" aria-hidden="true" />
      </button>
    </li>
  );
}

export function KpiCard({ label, primaryValue, primaryValues = [], helpText, comparisonAverage, comparisonBest, comparisonDelta, secondaryRows = [], deltaRows = [], trendHint, actions = [] }: KpiCardProps) {
  return (
    <article className="kpi-card" aria-label={label}>
      <header className="kpi-card__header">
        <h4>{label}</h4>
        <button
          type="button"
          className="metric-help"
          aria-label={`${label} explanation`}
          onClick={() => emitMetricHelp(label, trendHint ? `${helpText} ${trendHint}` : helpText)}
        >
          <i className="bi bi-info-circle" aria-hidden="true" />
        </button>
      </header>
      {(primaryValues.length > 0 ? primaryValues : (primaryValue ? [primaryValue] : [])).map((value) => (
        <p className="kpi-card__primary" key={value}>{value}</p>
      ))}
      {secondaryRows.length > 0 && (
        <div className="kpi-card__secondary">
          {secondaryRows.map((row) => <p key={row}>{row}</p>)}
        </div>
      )}
      {(comparisonAverage || comparisonBest) && (
        <div className="kpi-card__comparison">
          {comparisonAverage ? <p><i className="bi bi-slash-circle" aria-hidden="true" /> <span className="visually-hidden">Average last five: </span>{comparisonAverage}{comparisonDelta ? <span className={`kpi-card__inline-delta kpi-card__inline-delta--${comparisonDelta.tone}`}> ({comparisonDelta.value})</span> : null}</p> : null}
          {comparisonBest ? <p><i className="bi bi-star-fill" aria-hidden="true" /> <span className="visually-hidden">Best season: </span>{comparisonBest}</p> : null}
        </div>
      )}
      {deltaRows.length > 0 && (
        <div className="kpi-card__delta">
          {deltaRows.map((row) => (
            <p key={`${row.label}:${row.value}`} className={`kpi-card__delta-row kpi-card__delta-row--${row.tone}`}>
              {row.label}: {row.value}
            </p>
          ))}
        </div>
      )}
      {actions.length > 0 && (
        <div className="kpi-card__actions">
          {actions.map((action) => (
            <button key={action.label} type="button" className="secondary-button" onClick={action.onClick}>{action.label}</button>
          ))}
        </div>
      )}
    </article>
  );
}

export function HrZonesKpiCard({ label, helpText, zones }: { label: string; helpText: string; zones: HrZoneBar[] }) {
  return (
    <article className="kpi-card" aria-label={label}>
      <header className="kpi-card__header">
        <h4>{label}</h4>
        <button
          type="button"
          className="metric-help"
          aria-label={`${label} explanation`}
          onClick={() => emitMetricHelp(label, helpText)}
        >
          <i className="bi bi-info-circle" aria-hidden="true" />
        </button>
      </header>
      <div className="kpi-card__zones">
        {zones.map((zone) => (
          <div key={zone.label} className="kpi-card__zone-row">
            <span className="kpi-card__zone-label">{zone.label}</span>
            <div className="kpi-card__zone-track" aria-hidden="true">
              <div className="kpi-card__zone-fill" style={{ width: `${zone.percent}%` }} />
            </div>
            <span className="kpi-card__zone-value">{zone.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
