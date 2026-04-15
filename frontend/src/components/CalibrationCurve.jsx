import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

const LINE_COLORS = ['#6366f1', '#fb7185', '#14b8a6', '#fbbf24']

export default function CalibrationCurve({ result }) {
  const { chartData, groups } = useMemo(() => {
    if (!result?.calibration) return { chartData: [], groups: [] }

    const grps = Object.keys(result.calibration)
    if (grps.length === 0) return { chartData: [], groups: [] }

    // Merge calibration data for all groups
    // Create points from 0 to 1 at 0.1 intervals for the reference line,
    // plus the actual data points
    const allPoints = new Map()

    // Add reference diagonal points
    for (let i = 0; i <= 10; i++) {
      const x = i / 10
      allPoints.set(x, { x, perfect: x })
    }

    // Add actual calibration data
    grps.forEach(group => {
      const cal = result.calibration[group]
      if (!cal.mean_predicted?.length) return
      
      cal.mean_predicted.forEach((pred, idx) => {
        const key = Math.round(pred * 100) / 100
        if (!allPoints.has(key)) {
          allPoints.set(key, { x: key, perfect: key })
        }
        allPoints.get(key)[group] = cal.fraction_positive[idx]
      })
    })

    // Sort by x
    const data = Array.from(allPoints.values()).sort((a, b) => a.x - b.x)

    return { chartData: data, groups: grps }
  }, [result])

  if (!result) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">📉</div>
          <p className="text-slate-400 font-medium">No calibration data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Upload and analyze a model to see calibration curves.
          </p>
        </div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400">
            No calibration data available. The model may not support probability predictions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Calibration Curves</h2>
        <p className="text-slate-400 text-sm">
          How well-calibrated model predictions are across groups. Lines closer to the diagonal indicate better calibration.
        </p>
      </div>

      <div className="glass-card p-6">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,69,0.8)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 1]}
              label={{
                value: 'Mean Predicted Probability',
                position: 'insideBottom',
                offset: -5,
                style: { fill: '#94a3b8', fontSize: '12px', fontFamily: 'Inter' },
              }}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              label={{
                value: 'Fraction of Positives',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { fill: '#94a3b8', fontSize: '12px', fontFamily: 'Inter' },
              }}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 17, 33, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
              formatter={(value) => value?.toFixed(3) ?? '—'}
            />
            <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: '12px' }} />

            {/* Perfect calibration diagonal */}
            <Line
              type="monotone"
              dataKey="perfect"
              name="Perfect Calibration"
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
            />

            {/* Group lines */}
            {groups.map((group, idx) => (
              <Line
                key={group}
                type="monotone"
                dataKey={group}
                name={group}
                stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                strokeWidth={3}
                dot={{ r: 4, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interpretation help */}
      <div className="glass-card p-5">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          How to Read This Chart
        </h4>
        <div className="space-y-2 text-sm text-slate-400">
          <p>
            <span className="text-slate-300 font-medium">Perfect calibration</span> means when
            the model predicts a 70% probability, about 70% of those cases are actually positive.
          </p>
          <p>
            <span className="text-slate-300 font-medium">Groups above the diagonal</span> are
            under-predicted — the model assigns lower probabilities than the true positive rate.
          </p>
          <p>
            <span className="text-slate-300 font-medium">Groups below the diagonal</span> are
            over-predicted — the model assigns higher probabilities than the true positive rate.
          </p>
          <p>
            <span className="text-amber-400 font-medium">Divergence between groups</span> indicates
            the model is less reliable for certain demographics.
          </p>
        </div>
      </div>
    </div>
  )
}
