import type { StatefulEntrySnapshot } from "@puppetflow/runtime";

function formatValue(value: number | boolean): string {
  return typeof value === "boolean" ? (value ? "true" : "false") : value.toFixed(4);
}

interface StatefulDebugPanelProps {
  entries: StatefulEntrySnapshot[];
}

export function StatefulDebugPanel({ entries }: StatefulDebugPanelProps) {
  if (entries.length === 0) {
    return <p className="hint">（stateful インスタンスなし — PFScript / Graph / Pack を実行すると表示されます）</p>;
  }

  return (
    <div className="stateful-debug-wrap kv-table-wrap">
      <table className="kv-table stateful-debug-table">
        <thead>
          <tr>
            <th>関数</th>
            <th>id</th>
            <th>現在値</th>
            <th>内部 state</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.functionName}:${entry.instanceId}`}>
              <td>{entry.functionName}</td>
              <td>
                <code>{entry.instanceId}</code>
              </td>
              <td>{formatValue(entry.lastValue)}</td>
              <td>
                <details className="stateful-state-details">
                  <summary>JSON</summary>
                  <pre className="stateful-state-json">
                    {JSON.stringify(entry.state, null, 2)}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
