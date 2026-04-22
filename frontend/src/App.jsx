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
import ModelDecision from './components/ModelDecision'

const API_URL = import.meta.env.VITE_API_URL || ''

const DATASET_TABS = ['Upload', 'Metrics', 'Graph', 'Simulator', 'Compare']

export default function App() {
  // Top-level mode
  const [mode, setMode] = useState('dataset')
  // Sub-tabs
  const [datasetTab, setDatasetTab] = useState(0)

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
  const [modelResults, setModelResults] = useState(null)

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

      if (!analyzeRes.ok) {
        const errBody = await analyzeRes.json().catch(() => null)
        throw new Error(errBody?.detail || `Analysis failed: ${analyzeRes.statusText}`)
      }
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

  const currentSubTabs = mode === 'dataset' ? DATASET_TABS : []
  const currentSubTab = mode === 'dataset' ? datasetTab : 0
  const setCurrentSubTab = mode === 'dataset' ? setDatasetTab : () => {}

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

      {/* Sub-tab bar — only for dataset mode */}
      {mode === 'dataset' && (
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
      )}

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
            <ModelUpload onResults={setModelResults} />

            {modelResults && (
              <>
                <ModelMetrics results={modelResults} />
                <ConfusionMatrix
                  confusionMatrices={modelResults.confusion_matrices}
                  groupMetrics={modelResults.group_metrics}
                />
                <ModelDecision
                  decision={modelResults.decision}
                />
              </>
            )}
          </div>
        )}
      </main>

    </div>
  )
}
