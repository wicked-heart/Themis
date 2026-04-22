import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import CustomDropdown from './CustomDropdown'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function ModelUpload({ onResults }) {
  const [modelFile, setModelFile] = useState(null)
  const [csvFile, setCsvFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [protectedAttr, setProtectedAttr] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const parseCSV = useCallback((text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    return headers
  }, [])

  const onModelDrop = useCallback((files) => {
    if (files[0]) setModelFile(files[0])
  }, [])

  const onCsvDrop = useCallback((files) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const headers = parseCSV(e.target.result)
      setColumns(headers)
      setCsvFile(file)
      setProtectedAttr('')
      setTargetCol('')
    }
    reader.readAsText(file)
  }, [parseCSV])

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

  const sameColumn = protectedAttr && targetCol && protectedAttr === targetCol
  const canEvaluate = modelFile && csvFile && protectedAttr && targetCol && !sameColumn && !loading

  const handleEvaluate = async () => {
    if (!canEvaluate) return
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('model_file', modelFile)
      formData.append('csv_file', csvFile)
      formData.append('protected_attr', protectedAttr)
      formData.append('target_col', targetCol)

      const res = await fetch(`${API_URL}/analyze-model`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        if (res.status === 400) {
          const errBody = await res.json().catch(() => null)
          setError(errBody?.detail || 'Validation error')
        } else {
          setError('Server error — check that your model file is a valid .pkl file')
        }
        return
      }

      const data = await res.json()
      onResults(data)
    } catch (err) {
      setError('Server error — check that your model file is a valid .pkl file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Model Evaluation</h2>
        <p className="text-slate-400 text-sm">
          Upload a trained model and test dataset to evaluate fairness across demographic groups
        </p>
      </div>

      {/* Info banner */}
      <div
        className="glass-card p-4"
        style={{ borderLeft: '4px solid #6366f1' }}
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'italic', lineHeight: '1.6' }}>
          Important: The test dataset must match your model's training schema exactly — same column
          names, same order, and same preprocessing pipeline. Categorical columns should already
          be encoded as numbers if the model was trained on numeric data.
        </p>
        <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
          Themis evaluates models assuming consistent preprocessing. Full pipeline compatibility
          is a planned next step.
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
              <p style={{ color: '#2dd4bf', fontWeight: 600 }}>{modelFile.name}</p>
              <p className="text-slate-500 text-sm">
                {(modelFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-300 font-medium">
                {modelDropzone.isDragActive ? 'Drop model here...' : 'Upload Trained Model'}
              </p>
              <p className="text-slate-500 text-sm">Drop your .pkl model file here</p>
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
              <p style={{ color: '#2dd4bf', fontWeight: 600 }}>{csvFile.name}</p>
              <p className="text-slate-500 text-sm">
                {(csvFile.size / 1024).toFixed(1)} KB • {columns.length} columns
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-300 font-medium">
                {csvDropzone.isDragActive ? 'Drop CSV here...' : 'Upload Test Dataset'}
              </p>
              <p className="text-slate-500 text-sm">Drop your test CSV here</p>
            </div>
          )}
        </div>
      </div>

      {/* Column selectors */}
      {csvFile && columns.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in"
          style={{ position: 'relative', zIndex: 20 }}
        >
          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Protected Attribute
            </label>
            <CustomDropdown
              id="model-select-protected"
              options={columns}
              value={protectedAttr}
              onChange={setProtectedAttr}
              placeholder="Select protected column..."
            />
          </div>

          <div className="glass-card p-5">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Target Column
            </label>
            <CustomDropdown
              id="model-select-target"
              options={columns}
              value={targetCol}
              onChange={setTargetCol}
              placeholder="Select target column..."
            />
          </div>
        </div>
      )}

      {/* Same column validation warning */}
      {sameColumn && (
        <div
          className="glass-card p-4 animate-fade-in"
          style={{ borderLeft: '4px solid #f43f5e' }}
        >
          <p className="text-sm" style={{ color: '#fca5a5' }}>
            Protected attribute and target column cannot be the same.
          </p>
        </div>
      )}

      {/* Evaluate button */}
      {modelFile && csvFile && (
        <div className="text-center animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
          <button
            id="btn-evaluate-model"
            className="btn-primary"
            disabled={!canEvaluate}
            onClick={handleEvaluate}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Evaluating fairness...
              </span>
            ) : (
              'Evaluate Model'
            )}
          </button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className="glass-card p-4 animate-fade-in"
          style={{ borderLeft: '4px solid #f43f5e' }}
        >
          <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>Model Evaluation Error</p>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      )}
    </div>
  )
}
