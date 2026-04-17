import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const GROUP_COLORS = {
  0: '#6366f1', // blue for first group
  1: '#fb7185', // coral for second group
}

export default function ModelMetrics({ result }) {
  if (!result) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">

          <p className="text-slate-400 font-medium">No model metrics yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Upload and analyze a model from the Upload Model tab.
          </p>
        </div>
      </div>
    )
  }

  const groups = Object.keys(result.group_metrics || {})
  const eodPass = result.equalized_odds_diff <= 0.10

  // Build bar chart data
  const chartData = groups.map((group, idx) => ({
    group,
    Accuracy: result.group_metrics[group].accuracy,
    FPR: result.group_metrics[group].fpr,
    FNR: result.group_metrics[group].fnr,
    colorIdx: idx,
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Model Fairness Metrics</h2>
        <p className="text-slate-400 text-sm">
          Per-group performance analysis for your uploaded model
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Overall Accuracy</span>
          <p className="text-4xl font-black text-slate-100 mt-2">
            {(result.overall_accuracy * 100).toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Equalized Odds Diff</span>
            <span className={eodPass ? 'badge-pass' : 'badge-fail'}>
              {eodPass ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="text-4xl font-black text-slate-100 mt-2">
            {result.equalized_odds_diff.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 mt-2">Max acceptable gap: 0.10</p>
        </div>
      </div>

      {/* Per-group bar chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Per-Group Performance</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,32,69,0.8)" />
            <XAxis dataKey="group" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis domain={[0, 1]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 17, 33, 0.95)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
              formatter={(value) => value.toFixed(3)}
            />
            <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: '12px' }} />
            <Bar dataKey="Accuracy" fill="#6366f1" radius={[6, 6, 0, 0]} />
            <Bar dataKey="FPR" fill="#fbbf24" radius={[6, 6, 0, 0]} />
            <Bar dataKey="FNR" fill="#fb7185" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-group cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group, idx) => (
          <div
            key={group}
            className={`glass-card p-5 animate-fade-in stagger-${idx + 1}`}
            style={{ borderLeft: `4px solid ${idx === 0 ? '#6366f1' : '#fb7185'}` }}
          >
            <h4 className="text-sm font-semibold text-slate-300 mb-3">{group}</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs text-slate-500">Accuracy</span>
                <p className="text-lg font-bold text-slate-200">
                  {(result.group_metrics[group].accuracy * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">FPR</span>
                <p className="text-lg font-bold text-amber-400">
                  {result.group_metrics[group].fpr.toFixed(3)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">FNR</span>
                <p className="text-lg font-bold text-coral-400">
                  {result.group_metrics[group].fnr.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
