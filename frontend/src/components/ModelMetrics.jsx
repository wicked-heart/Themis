export default function ModelMetrics({ results }) {
  if (!results) return null

  const riskColors = {
    'Severe Risk':   { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
    'Moderate Risk': { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    'Low Risk':      { color: '#14b8a6', bg: 'rgba(20,184,166,0.12)' },
  }

  const resolved = riskColors[results.risk_level] || riskColors['Low Risk']
  const ringColor = resolved.color

  // Fairness score color
  const scoreColor = results.fairness_score < 70
    ? '#f43f5e'
    : results.fairness_score <= 85
      ? '#fbbf24'
      : '#14b8a6'

  // Score ring SVG
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (results.fairness_score / 100) * circumference

  // FPR/FNR color coding
  const rateColor = (val) => {
    if (val > 0.20) return '#f43f5e'
    if (val >= 0.10) return '#fbbf24'
    return '#14b8a6'
  }

  const groups = Object.keys(results.group_metrics || {})

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in" style={{ marginTop: '4rem' }}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Model Fairness Results</h2>
        <p className="text-slate-400 text-sm">
          Comprehensive fairness evaluation of your uploaded model
        </p>
      </div>

      {/* Section 1 — Four metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Card 1: Model Accuracy */}
        <div className="glass-card p-5 animate-fade-in stagger-1">
          <span className="text-xs text-slate-500" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Model Accuracy
          </span>
          <p className="mt-2" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#e2e8f0' }}>
            {results.overall_accuracy}%
          </p>
        </div>

        {/* Card 2: Fairness Score with ring */}
        <div className="glass-card p-5 flex flex-col items-center animate-fade-in stagger-2">
          <span className="text-xs text-slate-500 mb-3" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fairness Score
          </span>
          <div className="relative">
            <svg width="120" height="120" viewBox="0 0 140 140">
              <circle
                cx="70" cy="70" r={radius}
                fill="none"
                stroke="rgba(30,32,69,0.8)"
                strokeWidth="10"
              />
              <circle
                cx="70" cy="70" r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dashoffset 1.5s ease-out', animation: 'score-fill 1.5s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: scoreColor }}>{results.fairness_score}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1 rounded-full mt-2"
            style={{ background: resolved.bg, color: resolved.color }}
          >
            {results.risk_level}
          </span>
          <span className="text-xs text-slate-500 mt-1">Score adjusted for severity</span>
        </div>

        {/* Card 3: Disparate Impact Ratio */}
        <div className="glass-card p-5 animate-fade-in stagger-3">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-slate-500" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Disparate Impact Ratio
            </span>
            <span className={results.pass_fail.disparate_impact === 'pass' ? 'badge-pass' : 'badge-fail'}>
              {results.pass_fail.disparate_impact === 'pass' ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="mt-2" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#e2e8f0' }}>
            {results.disparate_impact_ratio}
          </p>
          <p className="text-xs text-slate-500 mt-2">Legal threshold: 0.80 (80% rule)</p>
        </div>

        {/* Card 4: Equalized Odds Difference */}
        <div className="glass-card p-5 animate-fade-in stagger-4">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-slate-500" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Equalized Odds Diff
            </span>
            <span className={results.pass_fail.equalized_odds === 'pass' ? 'badge-pass' : 'badge-fail'}>
              {results.pass_fail.equalized_odds === 'pass' ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="mt-2" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#e2e8f0' }}>
            {results.equalized_odds_diff}
          </p>
          <p className="text-xs text-slate-500 mt-2">Max acceptable gap: 0.10</p>
        </div>
      </div>

      {/* Section 2 — Info notes */}
      {results.schema_warning && (
        <div
          className="glass-card p-4 animate-fade-in"
          style={{ borderLeft: '4px solid #fbbf24' }}
        >
          <p className="text-sm" style={{ color: '#fbbf24' }}>
            ⚠ {results.schema_warning}
          </p>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs text-slate-500">
          Positive class inferred as: {results.inferred_positive_class}. Ensure this matches your model's training convention.
        </p>
        <p className="text-xs text-slate-500" style={{ fontStyle: 'italic' }}>
          {results.score_method}
        </p>
      </div>

      {/* Section 3 — Per-group metrics table */}
      {groups.length > 0 && (
        <div className="glass-card p-6 animate-fade-in stagger-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Per-Group Performance Breakdown
          </h3>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Count</th>
                  <th>Accuracy %</th>
                  <th>FPR</th>
                  <th>FNR</th>
                  <th>TPR</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const m = results.group_metrics[group]
                  return (
                    <tr key={group}>
                      <td style={{ fontWeight: 600 }}>{group}</td>
                      <td>{m.count}</td>
                      <td>{m.accuracy}%</td>
                      <td style={{ color: rateColor(m.fpr), fontWeight: 600 }}>{m.fpr}</td>
                      <td style={{ color: rateColor(m.fnr), fontWeight: 600 }}>{m.fnr}</td>
                      <td>{m.tpr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4 — SHAP feature importance */}
      {results.top_features && results.top_features.length > 0 && (
        <div className="glass-card p-6 animate-fade-in stagger-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Top Features by SHAP Influence
          </h3>
          <div className="space-y-3">
            {results.top_features.map((feat, idx) => {
              const maxShap = results.top_features[0]?.shap_mean || 1
              const pct = (feat.shap_mean / maxShap) * 100

              return (
                <div key={feat.feature} className={`animate-fade-in stagger-${idx + 1}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 font-medium">{feat.feature}</span>
                    <span className="text-xs text-slate-400">{feat.shap_mean.toFixed(3)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-dark-700)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        transition: 'width 1s ease-out',
                        background: idx === 0
                          ? 'linear-gradient(90deg, #f43f5e, #fb7185)'
                          : idx < 3
                            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                            : 'linear-gradient(90deg, #6366f1, #818cf8)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 5 — Limitation note */}
      <p className="text-xs text-slate-500" style={{ fontStyle: 'italic' }}>
        {results.limitation_note}
      </p>
    </div>
  )
}
