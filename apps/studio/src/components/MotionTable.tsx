import {
  MOTION_STATE_KEYS,
  type MotionState,
  type MotionStateKey,
} from "@puppetflow/core";

export interface MotionTableColumn {
  id: string;
  label: string;
  values: Partial<MotionState>;
}

interface MotionTableProps {
  columns: MotionTableColumn[];
  emptyHint?: string;
  onlyDefined?: boolean;
}

function formatCell(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(3);
}

function collectKeys(
  columns: MotionTableColumn[],
  onlyDefined: boolean,
): MotionStateKey[] {
  if (!onlyDefined) {
    return [...MOTION_STATE_KEYS];
  }

  return MOTION_STATE_KEYS.filter((key) =>
    columns.some((column) => column.values[key] !== undefined),
  );
}

export function MotionTable({
  columns,
  emptyHint,
  onlyDefined = false,
}: MotionTableProps) {
  if (columns.length === 0) {
    return <p className="hint">{emptyHint ?? "No data."}</p>;
  }

  const keys = collectKeys(columns, onlyDefined);
  if (keys.length === 0) {
    return <p className="hint">{emptyHint ?? "(no motion output this frame)"}</p>;
  }

  return (
    <div className="motion-table-wrap">
      <table className="motion-table">
        <thead>
          <tr>
            <th scope="col">Key</th>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <th scope="row">{key}</th>
              {columns.map((column) => (
                <td key={`${column.id}-${key}`}>{formatCell(column.values[key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
