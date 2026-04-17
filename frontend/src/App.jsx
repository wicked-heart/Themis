import { useState, useCallback } from 'react'
import UploadPanel from './components/UploadPanel'
import ConfigPanel from './components/ConfigPanel'
import MetricsDashboard from './components/MetricsDashboard'
import ProxyGraph from './components/ProxyGraph'
import TradeoffSimulator from './components/TradeoffSimulator'
import StrategyComparator from './components/StrategyComparator'
import ModelUpload from './components/ModelUpload'
import ModelMetrics from './components/ModelMetrics'
import ConfusionMatrix from './components/ConfusionMatrix'
import CalibrationCurve from './components/CalibrationCurve'

const API_URL = import.meta.env.VITE_API_URL || ''

const DATASET_TABS = ['Upload', 'Metrics', 'Graph', 'Simulator', 'Compare']
const MODEL_TABS = ['Upload Model', 'Model Metrics', 'Confusion Matrix', 'Calibration']

export default function App() {
  // Top-level mode
  const [mode, setMode] = useState('dataset')
  // Sub-tabs
  const [datasetTab, setDatasetTab] = useState(0)
  const [modelTab, setModelTab] = useState(0)

  // Dataset analysis state
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState(null)
  const [columns, setColumns] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [protectedAttr, setProtectedAttr] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [proxyResult, setProxyResult] = useState(null)
  const [simulationData, setSimulationData] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [analysisStage, setAnalysisStage] = useState(0)

  // Model evaluation state
  const [modelFile, setModelFile] = useState(null)
  const [modelCsvFile, setModelCsvFile] = useState(null)
  const [modelCsvData, setModelCsvData] = useState(null)
  const [modelColumns, setModelColumns] = useState([])
  const [modelProtectedAttr, setModelProtectedAttr] = useState('')
  const [modelTargetCol, setModelTargetCol] = useState('')
  const [modelResult, setModelResult] = useState(null)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelError, setModelError] = useState(null)

  // Run dataset analysis
  const runAnalysis = useCallback(async () => {
    if (!csvFile || !protectedAttr || !targetCol) return

    setAnalysisLoading(true)
    setAnalysisError(null)
    setAnalysisStage(1)

    try {
      // Build form data
      const formData = new FormData()
      formData.append('csv_file', csvFile)
      formData.append('protected_attr', protectedAttr)
      formData.append('target_col', targetCol)

      const proxyForm = new FormData()
      proxyForm.append('csv_file', csvFile)
      proxyForm.append('protected_attr', protectedAttr)

      setAnalysisStage(2)

      // Call /analyze and /proxy-graph in parallel
      // Simulation data is now generated dynamically inside /analyze
      const [analyzeRes, proxyRes] = await Promise.all([
        fetch(`${API_URL}/analyze`, { method: 'POST', body: formData }),
        fetch(`${API_URL}/proxy-graph`, { method: 'POST', body: proxyForm }),
      ])

      setAnalysisStage(3)

      if (!analyzeRes.ok) throw new Error(`Analysis failed: ${analyzeRes.statusText}`)
      if (!proxyRes.ok) throw new Error(`Proxy graph failed: ${proxyRes.statusText}`)

      const [analyzeData, proxyData] = await Promise.all([
        analyzeRes.json(),
        proxyRes.json(),
      ])

      setAnalysisStage(4)
      setAnalysisResult(analyzeData)
      setProxyResult(proxyData)
      // Extract simulation data from analyze response (computed dynamically)
      setSimulationData(analyzeData.simulation || null)

      // Auto-advance to Metrics tab
      setDatasetTab(1)
    } catch (err) {
      setAnalysisError(err.message)
    } finally {
      setAnalysisLoading(false)
    }
  }, [csvFile, protectedAttr, targetCol])

  // Run model evaluation
  const runModelAnalysis = useCallback(async () => {
    if (!modelFile || !modelCsvFile || !modelProtectedAttr || !modelTargetCol) return

    setModelLoading(true)
    setModelError(null)

    try {
      const formData = new FormData()
      formData.append('model_file', modelFile)
      formData.append('csv_file', modelCsvFile)
      formData.append('protected_attr', modelProtectedAttr)
      formData.append('target_col', modelTargetCol)

      const res = await fetch(`${API_URL}/analyze-model`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error(`Model analysis failed: ${res.statusText}`)

      const data = await res.json()
      setModelResult(data)

      // Auto-advance to Model Metrics tab
      setModelTab(1)
    } catch (err) {
      setModelError(err.message)
    } finally {
      setModelLoading(false)
    }
  }, [modelFile, modelCsvFile, modelProtectedAttr, modelTargetCol])

  // Reset all dataset state
  const resetDataset = useCallback(() => {
    setCsvFile(null)
    setCsvData(null)
    setColumns([])
    setTotalRows(0)
    setProtectedAttr('')
    setTargetCol('')
    setAnalysisResult(null)
    setProxyResult(null)
    setSimulationData(null)
    setAnalysisError(null)
    setAnalysisStage(0)
    setDatasetTab(0)
  }, [])

  const currentSubTabs = mode === 'dataset' ? DATASET_TABS : MODEL_TABS
  const currentSubTab = mode === 'dataset' ? datasetTab : modelTab
  const setCurrentSubTab = mode === 'dataset' ? setDatasetTab : setModelTab

  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto w-full px-4">
      {/* Header */}
      <header className="glass-card-static flex items-center justify-between flex-wrap gap-3 px-5 py-3 mt-4 mb-6"
        style={{ borderRadius: '16px' }}>
        <div className="flex items-center gap-3">
          <img src="/themiss.svg" alt="Themis Logo" className="w-12 h-12" />
          <div>
            <h1 className="text-lg font-bold text-gradient">Themis</h1>
            <p className="text-xs text-slate-500">Where fairness becomes a decision</p>
          </div>
        </div>

        {/* Top-level mode tabs */}
        <div className="flex gap-2">
          <button
            id="tab-dataset"
            className={`tab-button ${mode === 'dataset' ? 'active' : ''}`}
            onClick={() => setMode('dataset')}
          >
            Dataset Analysis
          </button>
          <button
            id="tab-model"
            className={`tab-button ${mode === 'model' ? 'active' : ''}`}
            onClick={() => setMode('model')}
          >
            Model Evaluation
          </button>
        </div>

        {/* Config summary */}
        <div className="flex items-center gap-4">
          {mode === 'dataset' && csvFile && (
            <ConfigPanel
              protectedAttr={protectedAttr}
              targetCol={targetCol}
              rowCount={analysisResult?.total_rows || totalRows || 0}
              colCount={columns.length}
              onReset={resetDataset}
            />
          )}
        </div>
      </header>

      {/* Sub-tab bar */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {currentSubTabs.map((tab, idx) => (
          <button
            key={tab}
            id={`subtab-${tab.toLowerCase().replace(/\s+/g, '-')}`}
            className={`sub-tab-button ${currentSubTab === idx ? 'active' : ''}`}
            onClick={() => setCurrentSubTab(idx)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 pb-8 w-full">
        {mode === 'dataset' && (
          <div className="animate-fade-in">
            {datasetTab === 0 && (
              <UploadPanel
                csvFile={csvFile}
                onFileAccepted={(file, data, cols, rowCount) => {
                  setCsvFile(file)
                  setCsvData(data)
                  setColumns(cols)
                  setTotalRows(rowCount || 0)
                }}
                columns={columns}
                protectedAttr={protectedAttr}
                setProtectedAttr={setProtectedAttr}
                targetCol={targetCol}
                setTargetCol={setTargetCol}
                onAnalyze={runAnalysis}
                loading={analysisLoading}
                error={analysisError}
                stage={analysisStage}
              />
            )}
            {datasetTab === 1 && (
              <MetricsDashboard
                result={analysisResult}
                stage={analysisStage}
                loading={analysisLoading}
              />
            )}
            {datasetTab === 2 && (
              <ProxyGraph data={proxyResult} />
            )}
            {datasetTab === 3 && (
              <TradeoffSimulator data={simulationData} />
            )}
            {datasetTab === 4 && (
              <StrategyComparator
                simulationData={simulationData}
                analysisResult={analysisResult}
                protectedAttr={protectedAttr}
                apiUrl={API_URL}
              />
            )}
          </div>
        )}

        {mode === 'model' && (
          <div className="animate-fade-in">
            {modelTab === 0 && (
              <ModelUpload
                modelFile={modelFile}
                setModelFile={setModelFile}
                csvFile={modelCsvFile}
                onCsvAccepted={(file, data, cols) => {
                  setModelCsvFile(file)
                  setModelCsvData(data)
                  setModelColumns(cols)
                }}
                columns={modelColumns}
                protectedAttr={modelProtectedAttr}
                setProtectedAttr={setModelProtectedAttr}
                targetCol={modelTargetCol}
                setTargetCol={setModelTargetCol}
                onAnalyze={runModelAnalysis}
                loading={modelLoading}
                error={modelError}
              />
            )}
            {modelTab === 1 && (
              <ModelMetrics result={modelResult} />
            )}
            {modelTab === 2 && (
              <ConfusionMatrix result={modelResult} />
            )}
            {modelTab === 3 && (
              <CalibrationCurve result={modelResult} />
            )}
          </div>
        )}
      </main>

    </div>
  )
}
