import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Node,
  type Edge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { graphToPresetJson } from "./graph-to-preset";

const initialNodes: Node[] = [
  {
    id: "interest",
    type: "input",
    position: { x: 0, y: 80 },
    data: { label: "Interest", key: "interest" },
  },
  {
    id: "multiply",
    type: "multiply",
    position: { x: 220, y: 80 },
    data: { label: "Multiply", gain: 0.5 },
  },
  {
    id: "mouthX",
    type: "output",
    position: { x: 460, y: 80 },
    data: { label: "mouthX", key: "mouthX" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "interest", target: "multiply" },
  { id: "e2", source: "multiply", target: "mouthX" },
];

function InputNode({ data }: { data: { label: string; key: string } }) {
  return (
    <div className="node">
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function MultiplyNode({ data }: { data: { label: string; gain: number } }) {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong>
      <div>gain: {data.gain}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function OutputNode({ data }: { data: { label: string; key: string } }) {
  return (
    <div className="node">
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong>
    </div>
  );
}

export function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [exportJson, setExportJson] = useState("");

  const nodeTypes = useMemo(
    () => ({
      input: InputNode,
      multiply: MultiplyNode,
      output: OutputNode,
    }),
    [],
  );

  return (
    <main className="editor">
      <header>
        <h1>PuppetFlow Editor</h1>
        <p>Interest → Multiply → Smile（スタンドアロン版）</p>
        <p className="hint">
          プリセット管理・ソース接続・OSC 設定は PuppetFlow Studio（pnpm
          dev:studio）を推奨します。
        </p>
        <button
          type="button"
          onClick={() => {
            setExportJson(graphToPresetJson({ nodes, edges }));
          }}
        >
          Export .pfpreset JSON
        </button>
      </header>

      <div className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {exportJson ? (
        <section>
          <h2>Export</h2>
          <pre>{exportJson}</pre>
        </section>
      ) : null}
    </main>
  );
}
