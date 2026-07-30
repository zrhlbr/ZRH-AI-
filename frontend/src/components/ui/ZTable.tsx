import { ReactNode } from 'react';

export interface ZTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  className?: string;
}

export interface ZTableProps<T> {
  columns: ZTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  emptyText?: ReactNode;
}

/** ZRH Table — 统一数据表（移动端横向滚动容器） */
export function ZTable<T>({ columns, data, rowKey, emptyText }: ZTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zrh-border">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-zrh-border bg-zrh-surface-raised">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-zrh-text-dim ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3.5 py-6 text-center text-zrh-text-dim">
                {emptyText}
              </td>
            </tr>
          )}
          {data.map((row, i) => (
            <tr
              key={rowKey(row)}
              className="border-b border-zrh-border/50 last:border-0 hover:bg-zrh-surface-raised/60"
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3.5 py-2.5 text-zrh-text ${col.className ?? ''}`}>
                  {col.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
