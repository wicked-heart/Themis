import { useState, useMemo } from 'react'
import GeminiExplanation from './GeminiExplanation'

export default function StrategyComparator({ simulationData, analysisResult, protectedAttr, apiUrl }) {
  const [selectedStrategy, setSelectedStrategy] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState(null)

  const strategies = useMemo(() => {
    if (!simulationData) return []

    const rw = simulationData.reweighting || []
    const th = simulationData.threshold || []
    
    // Find best points (last point)
    const rwBest = rw[rw.length - 1] || {}
    const thBest = th[th.length - 1] || {}
    
    // Use the actual curve start as baseline for gain/loss consistency
    const rwBase = rw[0] || {}
    const thBase = th[0] || {}

    const rwFairnessGain = (rwBest.fairness || 0) - (rwBase.fairness || 0)
    // Positive value means loss, negative means gain
    const rwAccLoss = (rwBase.accuracy || 0) - (rwBest.accuracy || 0)

    const thFairnessGain = (thBest.fairness || 0) - (thBase.fairness || 0)
    const thAccLoss = (thBase.accuracy || 0) - (thBest.accuracy || 0)

    // Combined strategy estimated by taking the better of two or a weight
    const cmbFairnessGain = Math.max(rwFairnessGain, thFairnessGain) * 1.05
    const cmbAccLoss = (rwAccLoss + thAccLoss) / 2

    const maxGain = Math.max(rwFairnessGain, thFairnessGain, cmbFairnessGain, 1)
    const maxLoss = Math.max(rwAccLoss, thAccLoss, cmbAccLoss, 1)

    const score = (gain, loss) => (gain / maxGain) - 0.5 * (loss / maxLoss)

    const rows = [
      {
        name: 'Reweighting',
        fairnessGain: rwFairnessGain.toFixed(1),
        accuracyLoss: rwAccLoss.toFixed(1),
        regStability: 'High',
        datasetSensitivity: 'Low',
        score: score(rwFairnessGain, rwAccLoss),
      },
      {
        name: 'Threshold Tuning',
        fairnessGain: thFairnessGain.toFixed(1),
        accuracyLoss: thAccLoss.toFixed(1),
        regStability: 'Medium',
        datasetSensitivity: 'Medium',
        score: score(thFairnessGain, thAccLoss),
      },
      {
        name: 'Combined',
        fairnessGain: cmbFairnessGain.toFixed(1),
        accuracyLoss: cmbAccLoss.toFixed(1),
        regStability: 'Medium',
        datasetSensitivity: 'Medium',
        score: score(cmbFairnessGain, cmbAccLoss),
      },
    ]

    // Mark highest scoring as recommended
    const maxScore = Math.max(...rows.map(r => r.score))
    rows.forEach(r => { r.recommended = Math.abs(r.score - maxScore) < 0.001 })

    return rows
  }, [simulationData])

  const handleRowClick = async (strategy) => {
    setSelectedStrategy(strategy.name)
    setExplainLoading(true)
    setExplainError(null)
    setExplanation(null)

    const topProxy = analysisResult?.top_features?.[0]?.feature || 'unknown'

    try {
      const res = await fetch(`${apiUrl}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fairness_score: analysisResult?.fairness_score || 0,
          disparate_impact_ratio: analysisResult?.disparate_impact_ratio || 0,
          equalized_odds_diff: analysisResult?.equalized_odds_diff || 0,
          top_proxy_feature: topProxy,
          protected_attr: protectedAttr || 'unknown',
          chosen_strategy: strategy.name,
        }),
      })

      if (!res.ok) throw new Error(`Explain failed: ${res.statusText}`)

      const data = await res.json()
      setExplanation(data.explanation)
    } catch (err) {
      setExplainError(err.message)
    } finally {
      setExplainLoading(false)
    }
  }

  if (!simulationData) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">

          <p className="text-slate-400 font-medium">No comparison data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Run a dataset analysis first to compare mitigation strategies.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Strategy Comparison</h2>
        <p className="text-slate-400 text-sm">
          Compare mitigation approaches — click any row for an AI-generated explanation
        </p>
      </div>

      {/* Comparison Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Strategy</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fairness Gain</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Accuracy Loss</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reg. Stability</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dataset Sensitivity</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {strategies.map((s) => (
              <tr
                key={s.name}
                id={`strategy-${s.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={`border-b border-dark cursor-pointer transition-colors duration-200
                  ${s.recommended ? 'bg-amber-highlight' : 'hover:bg-indigo-light'}
                  ${selectedStrategy === s.name ? 'bg-indigo-highlight' : ''}`}
                onClick={() => handleRowClick(s)}
              >
                <td className="px-5 py-4">
                  <span className="text-sm font-semibold text-slate-200">{s.name}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-teal-400 font-semibold">
                    {Number(s.fairnessGain) >= 0 ? '+' : ''}{s.fairnessGain}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-coral-400 font-semibold">
                    {Number(s.accuracyLoss) > 0 ? '-' : (Number(s.accuracyLoss) < 0 ? '+' : '')}
                    {Math.abs(Number(s.accuracyLoss)).toFixed(1)}%
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-slate-300">{s.regStability}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-slate-300">{s.datasetSensitivity}</span>
                </td>
                <td className="px-5 py-4">
                  {s.recommended && (
                    <span className="badge-recommended">✦ Recommended</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gemini Explanation */}
      {(selectedStrategy) && (
        <GeminiExplanation
          loading={explainLoading}
          explanation={explanation}
          error={explainError}
        />
      )}
    </div>
  )
}
