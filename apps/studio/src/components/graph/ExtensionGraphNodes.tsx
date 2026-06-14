import { Handle, Position } from "@xyflow/react";
import type { PackConfigField } from "@puppetflow/extension-core";

interface ConfigFieldProps {
  fields: PackConfigField[];
  data: Record<string, unknown>;
  onChange: (key: string, value: number) => void;
}

function ConfigFields({ fields, data, onChange }: ConfigFieldProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <>
      {fields.map((field) => (
        <label key={field.key} className="node-field">
          <span>{field.label}</span>
          <input
            className="node-input"
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 1}
            step={0.05}
            value={Number(data[field.key] ?? field.default)}
            onChange={(event) => onChange(field.key, Number(event.target.value))}
          />
          <span className="node-field-value">
            {Number(data[field.key] ?? field.default).toFixed(2)}
          </span>
        </label>
      ))}
    </>
  );
}

export function MotionPackNode({
  data,
  onChange,
  configFields,
}: {
  data: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  configFields: PackConfigField[];
}) {
  return (
    <div className="node node-extension">
      <strong>Motion Pack</strong>
      <p className="node-extension-title">
        {String(data.label ?? data.packId ?? "pack")}
      </p>
      <ConfigFields
        fields={configFields}
        data={data}
        onChange={(key, value) => onChange({ [key]: value })}
      />
    </div>
  );
}

export function MotionGeneratorNode({
  data,
  onChange,
  configFields,
}: {
  data: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  configFields: PackConfigField[];
}) {
  return (
    <div className="node node-extension">
      <strong>Motion Generator</strong>
      <p className="node-extension-title">
        {String(data.label ?? data.generatorId ?? "generator")}
      </p>
      <ConfigFields
        fields={configFields}
        data={data}
        onChange={(key, value) => onChange({ [key]: value })}
      />
    </div>
  );
}

export function MotionFunctionNode({
  data,
  onChange,
  configFields,
}: {
  data: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  configFields: PackConfigField[];
}) {
  return (
    <div className="node node-extension">
      <Handle type="target" position={Position.Left} />
      <strong>Extension Function</strong>
      <p className="node-extension-title">
        {String(data.label ?? data.functionName ?? "function")}
      </p>
      <ConfigFields
        fields={configFields}
        data={data}
        onChange={(key, value) => onChange({ [key]: value })}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function ExtensionCustomNode({
  data,
  label,
  onChange,
  configFields,
}: {
  data: Record<string, unknown>;
  label: string;
  onChange: (patch: Record<string, unknown>) => void;
  configFields: PackConfigField[];
}) {
  return (
    <div className="node node-extension">
      <strong>Extension Node</strong>
      <p className="node-extension-title">{label}</p>
      <ConfigFields
        fields={configFields}
        data={data}
        onChange={(key, value) => onChange({ [key]: value })}
      />
    </div>
  );
}
