import React from "react";

const ACTION_HEADER_ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const ACTION_CONTENT_ALIGN_CLASS = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const Table = ({
  columns,
  data,
  onRowClick,
  actions,
  currentUser,
  actionsHeader = "Actions",
  actionsAlign = "left",
  containerClassName = "overflow-x-auto bg-white shadow-md rounded-lg",
  headerClassName = "sticky top-0 z-10",
  tableClassName = "min-w-full divide-y divide-gray-200",
  headerCellClassName = "px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap",
  bodyCellClassName = "px-6 py-4 whitespace-nowrap text-sm text-gray-900",
}) => {
  const headerAlignClass = ACTION_HEADER_ALIGN_CLASS[actionsAlign] || ACTION_HEADER_ALIGN_CLASS.left;
  const contentAlignClass =
    ACTION_CONTENT_ALIGN_CLASS[actionsAlign] || ACTION_CONTENT_ALIGN_CLASS.left;

  return (
    <div className={containerClassName}>
      <table className={tableClassName}>
        <thead className={`bg-gray-100 ${headerClassName}`.trim()}>
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`${headerCellClassName} ${column.headerClassName || ""}`.trim()}
              >
                {column.header !== undefined ? column.header : column.Header}
              </th>
            ))}
            {actions && (
              <th className={`${headerCellClassName} ${headerAlignClass}`.trim()}>
                {actionsHeader}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column, colIndex) => {
                const columnKey = column.key !== undefined ? column.key : column.accessor;
                const cellValue = columnKey ? row[columnKey] : undefined;

                let renderedContent = null;
                if (column.render) {
                  renderedContent = column.render(cellValue, row, rowIndex);
                } else if (column.Cell) {
                  renderedContent =
                    typeof column.Cell === "function"
                      ? column.Cell({
                        value: cellValue,
                        row: { original: row, index: rowIndex },
                        data,
                      })
                      : column.Cell;
                } else {
                  renderedContent = cellValue;
                }

                return (
                  <td
                    key={colIndex}
                    className={`${bodyCellClassName} ${column.cellClassName || ""}`.trim()}
                  >
                    {renderedContent}
                  </td>
                );
              })}
              {row.id !== currentUser.id && actions && (
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className={`flex items-center gap-2 ${contentAlignClass}`}>
                    {actions.map((action, actionIndex) => {
                      if (action.show && !action.show(row)) {
                        return null;
                      }

                      return (
                        <button
                          key={actionIndex}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {typeof action.label === "function"
                            ? action.label(row)
                            : action.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
