export default function ModelDecision({ decision }) {
  if (!decision) return null

  const { issues, insight, actions } = decision

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in" style={{ marginTop: '4rem' }}>
      {/* Section 1 — Issues */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Identified Fairness Issues
        </h3>
        {issues && issues.length > 0 ? (
          <div className="space-y-3">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className="glass-card p-4"
                style={{
                  borderLeft: '4px solid #f43f5e',
                }}
              >
                <div className="flex items-start gap-3">
                  <span style={{ color: '#f43f5e', fontSize: '18px', lineHeight: '1.4', flexShrink: 0 }}>
                    ⚠️
                  </span>
                  <p className="text-sm" style={{ color: '#fca5a5' }}>
                    {issue}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="glass-card p-4"
            style={{
              borderLeft: '4px solid #14b8a6',
            }}
          >
            <p className="text-sm" style={{ color: '#2dd4bf' }}>
              No fairness violations detected. The model appears to treat all groups equitably.
            </p>
          </div>
        )}
      </div>

      {/* Section 2 — Insight */}
      {insight && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Bias Pattern Analysis
          </h3>
          <div
            className="glass-card p-4"
            style={{
              borderLeft: '4px solid #6366f1',
            }}
          >
            <p className="text-sm text-slate-300" style={{ lineHeight: '1.6' }}>
              {insight}
            </p>
          </div>
        </div>
      )}

      {/* Section 3 — Recommended Actions */}
      {actions && actions.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Recommended Mitigation Strategies
          </h3>
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div
                key={idx}
                className="glass-card p-4"
                style={{
                  borderLeft: '4px solid #14b8a6',
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-bold text-slate-200">
                    {action.strategy}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#fbbf24',
                    }}
                  >
                    Approximate accuracy impact: {action.expected_accuracy_drop}
                  </span>
                </div>
                <p className="text-sm text-slate-400" style={{ lineHeight: '1.5' }}>
                  {action.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
