export default function ConfusionMatrix({ confusionMatrices, groupMetrics }) {
  if (!confusionMatrices || Object.keys(confusionMatrices).length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400 font-medium">No confusion matrix data available</p>
          <p className="text-slate-500 text-sm mt-2">
            Upload and evaluate a model to see per-group confusion matrices.
          </p>
        </div>
      </div>
    )
  }

  const groups = Object.keys(confusionMatrices)

  // Color coding helper
  const rateColor = (val) => {
    if (val > 0.20) return '#f43f5e'
    if (val >= 0.10) return '#fbbf24'
    return '#14b8a6'
  }

  // Compute FPR and FNR from confusion matrix values
  const computeRates = (cm) => {
    const fpr = (cm.fp + cm.tn) > 0 ? cm.fp / (cm.fp + cm.tn) : 0
    const fnr = (cm.fn + cm.tp) > 0 ? cm.fn / (cm.fn + cm.tp) : 0
    return { fpr, fnr }
  }

  // Check FPR disparity for exactly two groups
  const groupRates = groups.map(g => ({
    group: g,
    ...computeRates(confusionMatrices[g])
  }))

  const hasFprDisparity = groups.length === 2 &&
    Math.abs(groupRates[0].fpr - groupRates[1].fpr) > 0.10

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in" style={{ marginTop: '4rem' }}>
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Confusion Matrix by Group</h2>
        <p className="text-slate-400 text-sm">
          Comparing prediction errors across demographic groups
        </p>
      </div>

      <div className="flex flex-wrap gap-6" style={{ justifyContent: 'center' }}>
        {groups.map((group, idx) => {
          const cm = confusionMatrices[group]
          const rates = computeRates(cm)

          return (
            <div
              key={group}
              className={`glass-card p-6 animate-fade-in stagger-${idx + 1}`}
              style={{ flex: '1 1 340px', maxWidth: '420px' }}
            >
              <h3 className="text-sm font-semibold text-slate-300 mb-4" style={{ fontWeight: 700 }}>
                {group}
              </h3>

              {/* 2x2 Matrix Grid */}
              <div className="flex justify-center mb-4">
                <div>
                  {/* Header labels */}
                  <div className="flex mb-2" style={{ marginLeft: '90px' }}>
                    <span className="w-20 text-center text-xs text-slate-500">Predicted −</span>
                    <span className="w-20 text-center text-xs text-slate-500 ml-2">Predicted +</span>
                  </div>

                  {/* Row 1: Actual Negative */}
                  <div className="flex items-center mb-2">
                    <span className="w-20 text-right text-xs text-slate-500" style={{ paddingRight: '12px' }}>Actual −</span>
                    <div className="confusion-cell tn">
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>TN</div>
                        <div style={{ fontWeight: 700 }}>{cm.tn}</div>
                      </div>
                    </div>
                    <div className="confusion-cell fp ml-2">
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>FP</div>
                        <div style={{ fontWeight: 700 }}>{cm.fp}</div>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Actual Positive */}
                  <div className="flex items-center">
                    <span className="w-20 text-right text-xs text-slate-500" style={{ paddingRight: '12px' }}>Actual +</span>
                    <div className="confusion-cell fn">
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>FN</div>
                        <div style={{ fontWeight: 700 }}>{cm.fn}</div>
                      </div>
                    </div>
                    <div className="confusion-cell tp ml-2">
                      <div className="text-center">
                        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>TP</div>
                        <div style={{ fontWeight: 700 }}>{cm.tp}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FPR / FNR below grid */}
              <div className="grid grid-cols-2 gap-4 mt-4" style={{ paddingTop: '1rem', borderTop: '1px solid rgba(99,102,241,0.12)' }}>
                <div>
                  <span className="text-xs text-slate-500">FPR</span>
                  <p className="text-lg font-bold" style={{ color: rateColor(rates.fpr) }}>
                    {rates.fpr.toFixed(4)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">FNR</span>
                  <p className="text-lg font-bold" style={{ color: rateColor(rates.fnr) }}>
                    {rates.fnr.toFixed(4)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* FPR disparity warning */}
      {hasFprDisparity && (
        <div
          className="glass-card p-5 animate-fade-in stagger-3"
          style={{ borderLeft: '4px solid #f43f5e' }}
        >
          <p className="text-sm" style={{ color: '#fca5a5', lineHeight: '1.6' }}>
            Significant false positive rate disparity detected between groups
            ({groupRates[0].group}: {groupRates[0].fpr.toFixed(4)} vs {groupRates[1].group}: {groupRates[1].fpr.toFixed(4)}).
            One group is more likely to receive incorrect favorable predictions.
          </p>
        </div>
      )}
    </div>
  )
}
