import { useMemo } from 'react'

export default function ConfusionMatrix({ result }) {
  const matrices = useMemo(() => {
    if (!result?.group_metrics) return null

    const groups = Object.keys(result.group_metrics)
    if (groups.length < 2) return null

    // We don't have raw TP/FP/FN/TN counts from the API,
    // so we estimate them from the rates for display.
    // In a real scenario, the backend would return these.
    return groups.slice(0, 2).map((group, idx) => {
      const m = result.group_metrics[group]
      const acc = m.accuracy
      const fpr = m.fpr
      const fnr = m.fnr
      
      // Estimate values (normalized to 100 base)
      const n = 100
      const positives = Math.round(n * 0.35) // estimate prevalence
      const negatives = n - positives
      
      const tp = Math.round(positives * (1 - fnr))
      const fn = positives - tp
      const fp = Math.round(negatives * fpr)
      const tn = negatives - fp

      return {
        group,
        tp, fp, fn, tn,
        fpr: m.fpr,
        fnr: m.fnr,
        isMinority: idx === 1,
      }
    })
  }, [result])

  if (!result) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">🧮</div>
          <p className="text-slate-400 font-medium">No confusion matrix data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Upload and analyze a model to see per-group confusion matrices.
          </p>
        </div>
      </div>
    )
  }

  if (!matrices) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400">Insufficient group data for confusion matrices.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Confusion Matrices</h2>
        <p className="text-slate-400 text-sm">
          Side-by-side comparison of prediction errors across demographic groups
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matrices.map((mat, idx) => (
          <div
            key={mat.group}
            className={`glass-card p-6 animate-fade-in stagger-${idx + 1}`}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: idx === 0 ? '#6366f1' : '#fb7185' }}
              />
              <h3 className="text-sm font-semibold text-slate-300">
                {mat.group}
                <span className="text-xs text-slate-500 ml-2">
                  ({mat.isMinority ? 'Minority' : 'Majority'} group)
                </span>
              </h3>
            </div>

            {/* 2x2 Matrix Grid */}
            <div className="flex justify-center mb-4">
              <div>
                {/* Header labels */}
                <div className="flex mb-2" style={{ marginLeft: '90px' }}>
                  <span className="w-20 text-center text-xs text-slate-500">Predicted +</span>
                  <span className="w-20 text-center text-xs text-slate-500 ml-2">Predicted −</span>
                </div>
                
                {/* Row 1: Actual Positive */}
                <div className="flex items-center mb-2">
                  <span className="w-20 text-right text-xs text-slate-500 pr-3">Actual +</span>
                  <div className="confusion-cell tp">{mat.tp}</div>
                  <div className="confusion-cell fn ml-2">{mat.fn}</div>
                </div>

                {/* Row 2: Actual Negative */}
                <div className="flex items-center">
                  <span className="w-20 text-right text-xs text-slate-500 pr-3">Actual −</span>
                  <div className="confusion-cell fp">{mat.fp}</div>
                  <div className="confusion-cell tn ml-2">{mat.tn}</div>
                </div>
              </div>
            </div>

            {/* FPR / FNR */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-card">
              <div>
                <span className="text-xs text-slate-500">False Positive Rate</span>
                <p className="text-lg font-bold text-amber-400">{mat.fpr.toFixed(3)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">False Negative Rate</span>
                <p className="text-lg font-bold text-coral-400">{mat.fnr.toFixed(3)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison insight */}
      {matrices.length === 2 && (
        <div className="glass-card p-5 animate-fade-in stagger-3" style={{ borderLeft: '4px solid #fbbf24' }}>
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-amber-400">Gap Analysis: </span>
            The FPR gap between groups is{' '}
            <span className="font-bold">
              {Math.abs(matrices[0].fpr - matrices[1].fpr).toFixed(3)}
            </span>
            {' '}and the FNR gap is{' '}
            <span className="font-bold">
              {Math.abs(matrices[0].fnr - matrices[1].fnr).toFixed(3)}
            </span>.
            {' '}Larger gaps indicate unfair error distribution across groups.
          </p>
        </div>
      )}
    </div>
  )
}
