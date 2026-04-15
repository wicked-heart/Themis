export default function GeminiExplanation({ loading, explanation, error }) {
  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-in" style={{ borderLeft: '4px solid #fbbf24' }}>
        <div className="flex items-center gap-3">
          <div className="shimmer-bg w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
            ✨
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400 mb-1">
              Gemini 1.5 Flash — Bias Explanation
            </p>
            <p className="text-sm text-slate-400 animate-pulse">
              Gemini is analyzing your bias pattern...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-card p-6 animate-fade-in" style={{ borderLeft: '4px solid #f43f5e' }}>
        <p className="text-sm font-semibold text-red-400 mb-1">
          Gemini 1.5 Flash — Bias Explanation
        </p>
        <p className="text-sm text-slate-400">
          Explanation unavailable — check API key
        </p>
        <p className="text-xs text-slate-500 mt-2">{error}</p>
      </div>
    )
  }

  if (!explanation) return null

  return (
    <div
      className="glass-card p-6 animate-fade-in"
      style={{
        borderLeft: '4px solid #fbbf24',
        background: 'rgba(245, 158, 11, 0.04)',
      }}
    >
      <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
        ✨ Gemini 1.5 Flash — Bias Explanation
      </p>
      <p className="text-sm text-slate-300 leading-relaxed">
        {explanation}
      </p>
    </div>
  )
}
