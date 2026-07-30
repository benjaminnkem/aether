"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { OperationStep } from "@aether/shared";
import { Status } from "@aether/ui";

function AetherNode({ data }: NodeProps<Node<{ step: OperationStep }>>) {
  return (
    <div className={`flow-node is-${data.step.status}`}>
      <Handle type="target" position={Position.Left} />
      <strong>{data.step.label}</strong>
      <Status status={data.step.status} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { aether: AetherNode };
export default function OperationGraph({
  steps,
  onSelect,
}: {
  steps: OperationStep[];
  onSelect: (step: OperationStep) => void;
}) {
  const nodes: Node<{ step: OperationStep }>[] = steps.map((step, index) => ({
    id: step.id,
    type: "aether",
    position: { x: index * 215, y: index % 2 ? 120 : 40 },
    data: { step },
  }));
  const edges: Edge[] = steps.slice(1).map((step, index) => ({
    id: `${steps[index]!.id}-${step.id}`,
    source: steps[index]!.id,
    target: step.id,
    animated: ["executing", "verifying"].includes(step.status),
    style: { stroke: step.status === "resolved" ? "#39b86c" : "#383b3f" },
  }));
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.35}
      maxZoom={1.4}
      onNodeClick={(_, node) => onSelect(node.data.step)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
    >
      <Background color="#23252a" gap={24} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
