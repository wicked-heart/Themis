import { useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const COLORS = {
  red: '#f43f5e',
  amber: '#fbbf24',
  gray: '#64748b',
}

export default function ProxyGraph({ data }) {
  const [selectedNode, setSelectedNode] = useState(null)

  const { initialNodes, initialEdges, ranking } = useMemo(() => {
    if (!data) return { initialNodes: [], initialEdges: [], ranking: {} }

    const nodes = []
    const edges = []
    const rank = {}

    // Protected attribute node in center
    const protectedNode = data.nodes.find(n => n.type === 'protected')
    if (protectedNode) {
      nodes.push({
        id: protectedNode.id,
        position: { x: 350, y: 200 },
        data: { label: protectedNode.id },
        style: {
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: '#fff',
          border: '2px solid rgba(168, 85, 247, 0.5)',
          borderRadius: '14px',
          padding: '12px 20px',
          fontSize: '14px',
          fontWeight: '700',
          fontFamily: 'Inter, sans-serif',
          width: 120,
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(168, 85, 247, 0.25)',
        },
      })
    }

    // Feature nodes positioned in a circle around the protected node
    const featureNodes = data.nodes.filter(n => n.type === 'feature')
    const angleStep = (2 * Math.PI) / Math.max(featureNodes.length, 1)
    const radiusX = 250
    const radiusY = 170

    featureNodes.forEach((node, idx) => {
      const angle = angleStep * idx - Math.PI / 2
      const x = 350 + radiusX * Math.cos(angle) - 60
      const y = 200 + radiusY * Math.sin(angle) - 20

      rank[node.id] = idx + 1

      const borderColor = node.mi_score > 0.6
        ? COLORS.red
        : node.mi_score > 0.4
          ? COLORS.amber
          : COLORS.gray

      nodes.push({
        id: node.id,
        position: { x, y },
        data: {
          label: node.id,
          mi_score: node.mi_score,
        },
        style: {
          background: 'rgba(22, 24, 50, 0.9)',
          color: '#e2e8f0',
          border: `2px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '10px 16px',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          backdropFilter: 'blur(10px)',
        },
      })
    })

    // Edges
    data.edges.forEach((edge, idx) => {
      edges.push({
        id: `e-${idx}`,
        source: edge.source,
        target: edge.target,
        label: edge.callout ? edge.label : undefined,
        animated: edge.callout,
        style: {
          stroke: COLORS[edge.color] || COLORS.gray,
          strokeWidth: Math.max(2, edge.mi_score * 8),
        },
        labelStyle: {
          fill: COLORS[edge.color] || COLORS.gray,
          fontSize: '11px',
          fontWeight: '600',
          fontFamily: 'Inter, sans-serif',
        },
        labelBgStyle: {
          fill: 'rgba(10, 11, 20, 0.9)',
          rx: 6,
        },
        labelBgPadding: [6, 4],
      })
    })

    return { initialNodes: nodes, initialEdges: edges, ranking: rank }
  }, [data])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((event, node) => {
    const nodeData = data?.nodes.find(n => n.id === node.id)
    setSelectedNode(nodeData)
  }, [data])

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="glass-card p-12 text-center">

          <p className="text-slate-400 font-medium">No proxy graph data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Run a dataset analysis first to see feature associations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">Proxy Influence Graph</h2>
        <p className="text-slate-400 text-sm">
          Statistical associations between features and the protected attribute via mutual information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Graph */}
        <div className="lg:col-span-3 glass-card overflow-hidden" style={{ height: '500px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(99,102,241,0.06)" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Legend */}
          <div className="glass-card p-5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Legend
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full" style={{ background: COLORS.red }} />
                <span className="text-xs text-slate-300">Strong proxy (MI &gt; 0.6)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full" style={{ background: COLORS.amber }} />
                <span className="text-xs text-slate-300">Moderate (MI 0.4 – 0.6)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 rounded-full" style={{ background: COLORS.gray }} />
                <span className="text-xs text-slate-300">Weak (MI &lt; 0.4)</span>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dark-600">
                <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }} />
                <span className="text-xs text-slate-300">Protected attribute</span>
              </div>
            </div>
          </div>

          {/* Node detail */}
          {selectedNode && (
            <div className="glass-card p-5 animate-slide-right">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Node Detail
              </h4>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-slate-500">Feature</span>
                  <p className="text-lg font-bold text-slate-200">{selectedNode.id}</p>
                </div>
                {selectedNode.type === 'protected' ? (
                  <div>
                    <span className="badge-warn">Protected Attribute</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-xs text-slate-500">MI Score</span>
                      <p className="text-xl font-bold text-indigo-400">
                        {selectedNode.mi_score?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Association Rank</span>
                      <p className="text-sm text-slate-300">
                        #{ranking[selectedNode.id]} of {Object.keys(ranking).length}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
