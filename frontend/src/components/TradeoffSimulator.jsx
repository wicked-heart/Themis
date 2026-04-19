import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
  ResponsiveContainer,
  Scatter,
} from 'recharts'

function findKneePoint(points) {
  if (!points || points.length < 3) return 0
  for (let i = 0; i < points.length - 1; i++) {
    const fairGain = points[i + 1].fairness - points[i].fairness
    const accLoss = points[i].accuracy - points[i + 1].accuracy
    if (accLoss > 0 && fairGain / accLoss < 1.0) {
      return i
    }
  }
  return Math.floor(points.length / 2)
}

export default function TradeoffSimulator({ data }) {
  const [sliderValue, setSliderValue] = useState(0)

  const { chartData, kneeIndex, kneeFairness, fairDomain, accDomain } = useMemo(() => {
    if (!data) return { chartData: [], kneeIndex: 0, kneeFairness: 0, fairDomain: [0, 100], accDomain: [0, 100] }

    const reweighting = data.reweighting || []
    const threshold = data.threshold || []

    // Both curves are monotonic (fairness ↑, accuracy ↓) from the backend.
    // Build a unified dataset indexed by intensity step.
    // Each point has: fairness (from reweighting, used as X),
    // rwAccuracy, thAccuracy.
    const maxLen = Math.max(reweighting.length, threshold.length)
    const merged = []
    for (let i = 0; i < maxLen; i++) {
      const rw = reweighting[i]
      const th = threshold[i]
      merged.push({
        fairness: rw?.fairness ?? th?.fairness ?? 0,
        rwAccuracy: rw?.accuracy ?? null,
        thFairness: th?.fairness ?? null,
        thAccuracy: th?.accuracy ?? null,
      })
    }

    const knee = findKneePoint(reweighting)

    // Compute dynamic axis domains from actual data
    const allFairness = [...reweighting.map(r => r.fairness), ...threshold.map(t => t.fairness)]
    const allAccuracy = [...reweighting.map(r => r.accuracy), ...threshold.map(t => t.accuracy)]
    const fMin = Math.floor(Math.min(...allFairness) - 3)
    const fMax = Math.ceil(Math.max(...allFairness) + 3)
    const aMin = Math.floor(Math.min(...allAccuracy) - 2)
    const aMax = Math.ceil(Math.max(...allAccuracy) + 2)

    return {
      chartData: merged,
      kneeIndex: knee,
      kneeFairness: reweighting[knee]?.fairness || 0,
      fairDomain: [fMin, fMax],
      accDomain: [aMin, aMax],
    }
  }, [data])

  const currentPoint = useMemo(() => {
    if (!data) return null
    const rw = data.reweighting || []
    const th = data.threshold || []
    const idx = Math.min(sliderValue, rw.length - 1)
    const baseline = rw[0] || {}

    return {
      fairness: rw[idx]?.fairness ?? 0,
      rwAccuracy: rw[idx]?.accuracy ?? 0,
      thAccuracy: th[idx]?.accuracy ?? 0,
      fairnessGain: ((rw[idx]?.fairness ?? 0) - (baseline.fairness ?? 0)).toFixed(1),
      accuracyLoss: ((baseline.accuracy ?? 0) - (rw[idx]?.accuracy ?? 0)).toFixed(1),
      pastKnee: idx > kneeIndex,
    }
  }, [data, sliderValue, kneeIndex])

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">

          <p className="text-slate-400 font-medium">No simulation data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Run a dataset analysis first to see trade-off simulations.
          </p>
        </div>
      </div>
    )
  }

  // Prepare separate datasets for the two Scatter+Line series
  const rwData = (data.reweighting || []).map(p => ({
    fairness: p.fairness,
    accuracy: p.accuracy,
  }))
  const thData = (data.threshold || []).map(p => ({
    fairness: p.fairness,
    accuracy: p.accuracy,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Fairness–Accuracy Trade-off</h2>
        <p className="text-slate-400 text-sm">
          Explore how different mitigation strategies affect model performance and fairness
        </p>
      </div>

      {/* Chart */}
      <div className="glass-card p-6">
        <ResponsiveContainer width="100%" height={440}>
          <ComposedChart margin={{ top: 15, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,69,0.8)" />
            <XAxis
              type="number"
              dataKey="fairness"
              domain={fairDomain}
              tickCount={8}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Fairness Score', position: 'insideBottom', offset: -10, style: { fill: '#94a3b8', fontSize: '12px', fontFamily: 'Inter' } }}
            />
            <YAxis
              type="number"
              dataKey="accuracy"
              domain={accDomain}
              tickCount={6}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#94a3b8', fontSize: '12px', fontFamily: 'Inter' } }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                // Deduplicate: Scatter emits separate entries for X and Y dataKeys.
                // Group by series color to show one row per curve.
                const seen = new Set()
                const unique = payload.filter(entry => {
                  const key = entry.color
                  if (seen.has(key)) return false
                  seen.add(key)
                  return true
                })
                return (
                  <div style={{
                    background: 'rgba(15, 17, 33, 0.95)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontFamily: 'Inter',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    backdropFilter: 'blur(8px)',
                    animation: 'tooltipFadeIn 0.2s ease-out',
                  }}>
                    <style>{`
                      @keyframes tooltipFadeIn {
                        from { opacity: 0; transform: translateY(4px); }
                        to   { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>
                    {unique.map((entry, i) => {
                      // Map color to proper series name
                      const name = entry.color === '#6366f1' ? 'Reweighting' : 'Threshold Tuning'
                      return (
                        <div key={i} style={{ marginBottom: i < unique.length - 1 ? '8px' : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: entry.color, display: 'inline-block',
                            }} />
                            <span style={{ color: entry.color, fontWeight: 600 }}>{name}</span>
                          </div>
                          <div style={{ color: '#94a3b8', paddingLeft: '14px' }}>
                            Fairness: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{entry.payload.fairness}</span>
                            <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                            Accuracy: <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{entry.payload.accuracy}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }}
              cursor={false}
              isAnimationActive={false}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontFamily: 'Inter', fontSize: '12px', paddingBottom: '10px' }}
            />
            <ReferenceLine
              x={kneeFairness}
              stroke="#fbbf24"
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{
                value: '↓ Best trade-off',
                position: 'insideTopRight',
                style: { fill: '#fbbf24', fontSize: '11px', fontWeight: '600', fontFamily: 'Inter' },
                offset: 10,
              }}
            />
            <Scatter
              name="Reweighting"
              data={rwData}
              fill="#6366f1"
              line={{ stroke: '#6366f1', strokeWidth: 3 }}
              legendType="circle"
              shape={() => null}
              isAnimationActive={false}
            />
            <Scatter
              name="Threshold Tuning"
              data={thData}
              fill="#14b8a6"
              line={{ stroke: '#14b8a6', strokeWidth: 3 }}
              isAnimationActive={false}
              legendType="circle"
              shape={() => null}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Slider */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-300">Mitigation Intensity</span>
          <span className="text-sm font-bold text-indigo-400">
            {sliderValue} / {(data.reweighting?.length || 25) - 1}
          </span>
        </div>
        <input
          id="intensity-slider"
          type="range"
          min="0"
          max={(data.reweighting?.length || 25) - 1}
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="w-full accent-indigo-500 cursor-pointer"
          style={{ height: '6px' }}
        />

        {/* Live annotation */}
        {currentPoint && (
          <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
            {sliderValue === 0 ? (
              <p className="text-sm text-slate-300">
                At baseline: Fairness <span className="text-indigo-400 font-semibold">{data.baseline?.fairness}</span>,
                Accuracy <span className="text-indigo-400 font-semibold">{data.baseline?.accuracy}%</span>.
                Move the slider to explore mitigation trade-offs.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-300">
                  At this setting:{' '}
                  <span className="text-teal-400 font-semibold">+{currentPoint.fairnessGain} fairness</span>,{' '}
                  <span className="text-coral-400 font-semibold">-{currentPoint.accuracyLoss}% accuracy</span>.
                </p>
                {currentPoint.pastKnee && (
                  <p className="text-xs text-amber-400 mt-1 font-medium">
                    ⚠️ Beyond optimal point — cost increasing sharply.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Baseline card */}
      <div className="glass-card p-5">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Baseline Performance
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-slate-500">Accuracy</span>
            <p className="text-lg font-bold text-slate-200">{data.baseline?.accuracy}%</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Fairness</span>
            <p className="text-lg font-bold text-slate-200">{data.baseline?.fairness}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Disparate Impact</span>
            <p className="text-lg font-bold text-slate-200">{data.baseline?.disparate_impact}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">EO Diff</span>
            <p className="text-lg font-bold text-slate-200">{data.baseline?.equalized_odds_diff}</p>
          </div>
        </div>
      </div>

      {/* Simulation Note */}
      <p style={{
        color: '#64748b',
        fontSize: '0.75rem',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: '0.75rem',
      }}>
        Simulation uses precomputed approximations of mitigation effects for real-time interaction. Actual results may vary.
      </p>
    </div>
  )
}
