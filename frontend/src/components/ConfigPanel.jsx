export default function ConfigPanel({ protectedAttr, targetCol, rowCount, colCount, onReset }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      {protectedAttr && (
        <span className="text-slate-500">
          Protected: <span className="badge-warn" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{protectedAttr}</span>
        </span>
      )}
      {targetCol && (
        <span className="text-slate-500">
          Target: <span className="text-indigo-400 font-medium">{targetCol}</span>
        </span>
      )}
      {rowCount > 0 && (
        <span className="text-slate-500" style={{ whiteSpace: 'nowrap' }}>
          {rowCount.toLocaleString()}r · {colCount}c
        </span>
      )}
      <button
        id="btn-reset"
        className="btn-secondary text-xs"
        onClick={onReset}
        style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}
      >
        ✕ Reset
      </button>
    </div>
  )
}
