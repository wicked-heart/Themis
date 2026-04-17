export default function ProgressBar({ stage }) {
  const stages = [
    { label: 'Preprocessing' },
    { label: 'Bias Metrics' },
    { label: 'SHAP Analysis' },
    { label: 'Scoring' },
  ]

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between">
        {stages.map((s, idx) => {
          const stepNum = idx + 1
          const isActive = stage === stepNum
          const isComplete = stage > stepNum

          return (
            <div key={s.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500
                    ${isComplete
                      ? 'bg-teal-500/20 text-teal-400 border-2 border-teal-500/40'
                      : isActive
                        ? 'bg-indigo-500/20 text-indigo-400 border-2 border-indigo-500/40 animate-pulse-ring'
                        : 'bg-dark-800 text-slate-500 border-2 border-dark-600'
                    }`}
                >
                  {isComplete ? '✓' : (idx + 1)}
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${
                  isComplete ? 'text-teal-400' : isActive ? 'text-indigo-400' : 'text-slate-500'
                }`}>
                  {s.label}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex-1 mx-3 h-0.5 rounded-full overflow-hidden bg-dark-700">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: isComplete ? '100%' : isActive ? '50%' : '0%',
                      background: isComplete
                        ? 'linear-gradient(90deg, #14b8a6, #2dd4bf)'
                        : 'linear-gradient(90deg, #6366f1, #818cf8)',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
