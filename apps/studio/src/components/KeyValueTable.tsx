interface KeyValueRow {
  key: string;
  value: string;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  emptyHint?: string;
}

export function KeyValueTable({ rows, emptyHint = "（なし）" }: KeyValueTableProps) {
  if (rows.length === 0) {
    return <p className="hint">{emptyHint}</p>;
  }

  return (
    <div className="motion-table-wrap kv-table-wrap">
      <table className="motion-table kv-table">
        <thead>
          <tr>
            <th scope="col">Key</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.key}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
