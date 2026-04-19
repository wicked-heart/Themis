import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import ProgressBar from './ProgressBar'
import CustomDropdown from './CustomDropdown'

const SENSITIVE_COLS = ['sex', 'race', 'age', 'gender', 'ethnicity', 'religion']

export default function UploadPanel({
  csvFile,
  onFileAccepted,
  columns,
  protectedAttr,
  setProtectedAttr,
  targetCol,
  setTargetCol,
  onAnalyze,
  loading,
  error,
  stage,
}) {
  const [fileRowCount, setFileRowCount] = useState(0)
  const parseCSV = useCallback((text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const totalRows = lines.length - 1
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {}
      headers.forEach((h, i) => { row[h] = values[i] || '' })
      return row
    })
    return { headers, rows, totalRows }
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const { headers, rows, totalRows } = parseCSV(e.target.result)
      setFileRowCount(totalRows)
      onFileAccepted(file, rows, headers, totalRows)
    }
    reader.readAsText(file)
  }, [onFileAccepted, parseCSV])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  })

  const isSensitive = useCallback((col) => {
    return SENSITIVE_COLS.some(s => col.toLowerCase().includes(s))
  }, [])

  const previewData = useMemo(() => {
    if (!csvFile) return null
    // csvData is passed from parent
    return columns
  }, [csvFile, columns])

  const sameColumn = protectedAttr && targetCol && protectedAttr === targetCol
  const canAnalyze = csvFile && protectedAttr && targetCol && !loading && !sameColumn

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-fade-in pb-8" style={{ gap: '1.5rem' }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Upload Your Dataset</h2>
        <p className="text-slate-400 text-sm">
          Drop a CSV file to begin bias analysis. We'll detect protected attributes and surface fairness issues.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        id="csv-dropzone"
        className={`dropzone ${isDragActive ? 'active' : ''} ${csvFile ? 'accepted' : ''}`}
      >
        <input {...getInputProps()} />
        {csvFile ? (
          <div className="space-y-2">

            <p className="text-teal-400 font-semibold">{csvFile.name}</p>
            <p className="text-slate-500 text-sm">
              {(csvFile.size / 1024).toFixed(1)} KB • {columns.length} columns
            </p>
            <p className="text-slate-500 text-xs mt-2">Drop a new file to replace</p>
          </div>
        ) : (
          <div className="space-y-3">

            <p className="text-slate-300 font-medium">
              {isDragActive ? 'Drop your CSV here...' : 'Drag & drop a CSV file here'}
            </p>
            <p className="text-slate-500 text-sm">or click to browse</p>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {csvFile && columns.length > 0 && (
        <div className="glass-card p-0 overflow-hidden animate-fade-in mt-6" style={{ marginTop: '1.5rem' }}>
          <div className="px-5 py-3 border-b pb-4" style={{ borderColor: 'rgba(99,102,241,0.12)', paddingBottom: '1rem' }}>
            <h3 className="text-sm font-semibold text-slate-300">Preview — {fileRowCount.toLocaleString()} rows · {columns.length} cols (showing first 5)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col} className={isSensitive(col) ? 'highlight-col' : ''}>
                      {col}
                      {isSensitive(col) && (
                        <span className="ml-2 text-xs text-amber-400">⚠️</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* We show the preview rows from parent */}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration */}
      {csvFile && (
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in stagger-2 mt-6" 
          style={{ gap: '1.5rem', marginTop: '1.5rem', position: 'relative', zIndex: 20 }}
        >
          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2" style={{ marginBottom: '0.5rem' }}>
              Protected Attribute
            </label>
            <p className="text-xs text-slate-500 mb-3" style={{ marginBottom: '0.75rem' }}>
              The demographic feature to evaluate for bias (e.g., sex, race)
            </p>
            <CustomDropdown
              id="select-protected-attr"
              options={columns}
              value={protectedAttr}
              onChange={setProtectedAttr}
              isSensitive={isSensitive}
              placeholder="Select protected column..."
            />
          </div>

          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2" style={{ marginBottom: '0.5rem' }}>
              Target Column
            </label>
            <p className="text-xs text-slate-500 mb-3" style={{ marginBottom: '0.75rem' }}>
              The outcome variable your model predicts (e.g., income, approved)
            </p>
            <CustomDropdown
              id="select-target-col"
              options={columns}
              value={targetCol}
              onChange={setTargetCol}
              placeholder="Select target column..."
            />
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {csvFile && (
        <div 
          className="text-center animate-fade-in stagger-3 pb-8 mb-4 mt-8" 
          style={{ marginTop: '2rem', marginBottom: '2rem', position: 'relative', zIndex: 1 }}
        >
          <button
            id="btn-analyze"
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
                Analyzing...
              </span>
            ) : (
              'Analyze for Bias'
            )}
          </button>
        </div>
      )}

      {/* Progress */}
      {loading && <ProgressBar stage={stage} />}

      {/* Same-column warning */}
      {sameColumn && (
        <div className="glass-card p-4 border-l-4 border-amber-500 animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <p className="text-sm text-amber-400 font-medium">
            Protected attribute and target column cannot be the same.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-l-4 border-red-500 animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      )}
    </div>
  )
}
