export const CommissionTable = ({ data, users, onEdit, onDelete, showActions = true }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm mt-4">
      <div className="md:hidden p-3 space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No commission rules found.</p>
        ) : (
          data.map((row, index) => (
            <div
              key={row.id ?? `${row.method || "method"}-${row.network || "network"}-${row.cardType || "card"}-${row.user_id || ""}-${index}`}
              className="rounded-xl border border-gray-100 p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Commission Rule</p>
                <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
                  {row.commissionRate ?? row.percent_fee ?? "-"}%
                </span>
              </div>
              <p className="text-sm text-gray-700"><span className="font-medium">Method:</span> {row.method || "-"}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Network:</span> {row.network || "-"}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Card Type:</span> {row.cardType || "-"}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Min Range:</span> {row.min_amount ?? row.minAmount ?? "-"}</p>
              <p className="text-sm text-gray-700"><span className="font-medium">Max Range:</span> {row.max_amount ?? row.maxAmount ?? "-"}</p>

              {showActions && (
                <div className="flex items-center gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => onEdit?.(row)}
                    className="rounded border border-[#14b8a6] px-3 py-1 text-sm font-medium text-[#0f766e] transition-colors hover:bg-[#ccfbf1]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(row)}
                    className="rounded border border-red-500 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Method</th>
              <th className="px-4 py-2 text-left">Network</th>
              <th className="px-4 py-2 text-left">Card Type</th>
              <th className="px-4 py-2 text-left">Min Range</th>
              <th className="px-4 py-2 text-left">Max Range</th>
              <th className="px-4 py-2 text-left">Percent Fee (%)</th>
              {/* NOTE: Flat-fee column is intentionally hidden in percentage-only mode.
              <th className="px-4 py-2 text-left">Flat Fee</th>
              */}
              {showActions && (
                <th className="px-4 py-2 text-left">
                  <span className="inline-flex min-w-[130px] justify-center">Action</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={row.id ?? `${row.method || "method"}-${row.network || "network"}-${row.cardType || "card"}-${row.user_id || ""}-${index}`} className="border-t">
                <td className="px-4 py-2">{row.method}</td>
                <td className="px-4 py-2">{row.network}</td>
                <td className="px-4 py-2">{row.cardType}</td>
                <td className="px-4 py-2">{row.min_amount ?? row.minAmount ?? "-"}</td>
                <td className="px-4 py-2">{row.max_amount ?? row.maxAmount ?? "-"}</td>
                <td className="px-4 py-2">{row.commissionRate ?? row.percent_fee ?? "-"}</td>
                {/* NOTE: Flat-fee cell is intentionally hidden in percentage-only mode.
                <td className="px-4 py-2">{row.feeType === "flat" ? (row.flatFee ?? row.flat_fee ?? "-") : "-"}</td>
                */}
                {showActions && (
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(row)}
                        className="rounded border border-[#14b8a6] px-3 py-1 text-sm font-medium text-[#0f766e] transition-colors hover:bg-[#ccfbf1]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(row)}
                        className="rounded border border-red-500 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
