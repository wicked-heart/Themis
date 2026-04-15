import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

const SENSITIVE_COLS = ['sex', 'race', 'age', 'gender', 'ethnicity', 'religion']

export default function ModelUpload({
  modelFile,
  setModelFile,
  csvFile,
  onCsvAccepted,
  columns,
  protectedAttr,
  setProtectedAttr,
  targetCol,
  setTargetCol,
  onAnalyze,
  loading,
  error,
}) {
  const onModelDrop = useCallback((files) => {
    if (files[0]) setModelFile(files[0])
  }, [setModelFile])

  const parseCSV = useCallback((text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    })
    return { headers, rows }
  }, [])

  const onCsvDrop = useCallback((files) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result)
      onCsvAccepted(file, rows, headers)
    }
    reader.readAsText(file)
  }, [onCsvAccepted, parseCSV])

  const modelDropzone = useDropzone({
    onDrop: onModelDrop,
    accept: { 'application/octet-stream': ['.pkl'] },
    multiple: false,
  })

  const csvDropzone = useDropzone({
    onDrop: onCsvDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const isSensitive = (col) => SENSITIVE_COLS.some(s => col.toLowerCase().includes(s))
  const canAnalyze = modelFile && csvFile && protectedAttr && targetCol && !loading

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Upload Your Model</h2>
        <p className="text-slate-400 text-sm">
          Upload a trained .pkl model and test CSV to evaluate fairness across demographic groups
        </p>
      </div>

      {/* Two dropzones side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model dropzone */}
        <div
          {...modelDropzone.getRootProps()}
          id="model-dropzone"
          className={`dropzone ${modelDropzone.isDragActive ? 'active' : ''} ${modelFile ? 'accepted' : ''}`}
        >
          <input {...modelDropzone.getInputProps()} />
          {modelFile ? (
            <div className="space-y-2">
              <div className="text-3xl">🤖</div>
              <p className="text-teal-400 font-semibold">{modelFile.name}</p>
              <p className="text-slate-500 text-sm">
                {(modelFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl opacity-40">🤖</div>
              <p className="text-slate-300 font-medium">
                {modelDropzone.isDragActive ? 'Drop model here...' : 'Upload .pkl model file'}
              </p>
              <p className="text-slate-500 text-sm">Scikit-learn or XGBoost pickle</p>
            </div>
          )}
        </div>

        {/* CSV dropzone */}
        <div
          {...csvDropzone.getRootProps()}
          id="model-csv-dropzone"
          className={`dropzone ${csvDropzone.isDragActive ? 'active' : ''} ${csvFile ? 'accepted' : ''}`}
        >
          <input {...csvDropzone.getInputProps()} />
          {csvFile ? (
            <div className="space-y-2">
              <div className="text-3xl">📁</div>
              <p className="text-teal-400 font-semibold">{csvFile.name}</p>
              <p className="text-slate-500 text-sm">
                {(csvFile.size / 1024).toFixed(1)} KB • {columns.length} columns
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl opacity-40">📁</div>
              <p className="text-slate-300 font-medium">
                {csvDropzone.isDragActive ? 'Drop CSV here...' : 'Upload test CSV'}
              </p>
              <p className="text-slate-500 text-sm">Same format as training data</p>
            </div>
          )}
        </div>
      </div>

      {/* Column selectors */}
      {csvFile && columns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Protected Attribute
            </label>
            <select
              id="model-select-protected"
              className="select-input"
              value={protectedAttr}
              onChange={(e) => setProtectedAttr(e.target.value)}
            >
              <option value="">Select column...</option>
              {columns.map(col => (
                <option key={col} value={col}>
                  {col} {isSensitive(col) ? '⚠️' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Target Column
            </label>
            <select
              id="model-select-target"
              className="select-input"
              value={targetCol}
              onChange={(e) => setTargetCol(e.target.value)}
            >
              <option value="">Select column...</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {modelFile && csvFile && (
        <div className="text-center animate-fade-in">
          <button
            id="btn-analyze-model"
            className="btn-primary"
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Evaluating Model...
              </span>
            ) : (
              '🔍 Analyze Model Fairness'
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-l-4 border-red-500 animate-fade-in">
          <p className="text-sm text-red-400 font-medium">Model Analysis Error</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}
