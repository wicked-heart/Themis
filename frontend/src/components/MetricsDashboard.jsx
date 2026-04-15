import { useMemo } from 'react'
import ProgressBar from './ProgressBar'

function ScoreRing({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score < 70 ? '#f43f5e' : score < 85 ? '#fbbf24' : '#14b8a6'
  const bgColor = score < 70
    ? 'rgba(244,63,94,0.1)'
    : score < 85
      ? 'rgba(251,191,36,0.1)'
      : 'rgba(20,184,166,0.1)'
  const label = score < 70 ? 'High Risk' : score < 85 ? 'Moderate' : 'Fair'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke="rgba(30,32,69,0.8)"
            strokeWidth="10"
          />
          <circle
            cx="70" cy="70" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 1.5s ease-out', animation: 'score-fill 1.5s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{Number(score.toFixed(1))}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <span
          className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: bgColor, color }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

function MetricCard({ title, value, badge, badgeType, description, delay }) {
  return (
    <div className={`glass-card p-5 animate-fade-in stagger-${delay}`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-300">{title}</h4>
        <span className={`badge-${badgeType}`}>{badge}</span>
      </div>
      <p className="text-2xl font-bold text-slate-100 mb-2">{value}</p>
      <p className="text-xs text-slate-500">{description}</p>
    </div>
  )
}

export default function MetricsDashboard({ result, stage, loading }) {
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-slate-400">Analyzing your dataset for bias patterns...</p>
        </div>
        <ProgressBar stage={stage} />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">📊</div>
          <p className="text-slate-400 font-medium">No analysis results yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Upload a dataset and run analysis from the Upload tab to see fairness metrics.
          </p>
        </div>
      </div>
    )
  }

  const topProxy = result.top_features?.[0]

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Fairness Analysis Results</h2>
        <p className="text-slate-400 text-sm">
          Comprehensive bias assessment across multiple fairness criteria
        </p>
      </div>

      {/* Score + Metrics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Score Ring */}
        <div className="glass-card p-6 flex flex-col items-center justify-center">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Fairness Score
          </h3>
          <ScoreRing score={result.fairness_score} />
        </div>

        {/* Three metric cards */}
        <MetricCard
          title="Disparate Impact Ratio"
          value={Number(result.disparate_impact_ratio.toFixed(4))}
          badge={result.pass_fail.disparate_impact === 'pass' ? 'PASS' : 'FAIL'}
          badgeType={result.pass_fail.disparate_impact === 'pass' ? 'pass' : 'fail'}
          description='Legal threshold: 0.80 (80% rule)'
          delay={2}
        />

        <MetricCard
          title="Equalized Odds Difference"
          value={Number(result.equalized_odds_diff.toFixed(4))}
          badge={result.pass_fail.equalized_odds === 'pass' ? 'PASS' : 'FAIL'}
          badgeType={result.pass_fail.equalized_odds === 'pass' ? 'pass' : 'fail'}
          description='Max acceptable gap: 0.10'
          delay={3}
        />

        <MetricCard
          title="Top SHAP Proxy"
          value={topProxy?.feature || '—'}
          badge={result.pass_fail.shap_influence === 'pass' ? 'PASS' : result.pass_fail.shap_influence === 'warn' ? 'WARN' : 'FAIL'}
          badgeType={result.pass_fail.shap_influence === 'pass' ? 'pass' : result.pass_fail.shap_influence === 'warn' ? 'warn' : 'fail'}
          description={topProxy ? `Mean SHAP: ${topProxy.shap_mean.toFixed(3)}` : 'No proxy detected'}
          delay={4}
        />
      </div>

      {/* Top Features */}
      <div className="glass-card p-6 animate-fade-in stagger-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Top Features by SHAP Influence
        </h3>
        <div className="space-y-3">
          {result.top_features.map((feat, idx) => {
            const maxShap = result.top_features[0]?.shap_mean || 1
            const pct = (feat.shap_mean / maxShap) * 100

            return (
              <div key={feat.feature} className={`animate-fade-in stagger-${idx + 1}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300 font-medium">{feat.feature}</span>
                  <span className="text-xs text-slate-400">{feat.shap_mean.toFixed(3)}</span>
                </div>
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${pct}%`,
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

      {/* Analysis Complete Progress */}
      <ProgressBar stage={4} />
    </div>
  )
}
