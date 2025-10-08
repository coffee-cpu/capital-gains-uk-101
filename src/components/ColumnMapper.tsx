import { useState } from 'react'
import { ColumnMapping, MAPPABLE_FIELDS } from '../types/columnMapping'
import { RawCSVRow } from '../types/broker'

interface ColumnMapperProps {
  csvHeaders: string[]
  previewRows: RawCSVRow[]
  onMappingComplete: (mapping: ColumnMapping) => void
  onCancel: () => void
}

export function ColumnMapper({ csvHeaders, previewRows, onMappingComplete, onCancel }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({})

  const handleFieldChange = (fieldKey: string, csvColumn: string) => {
    setMapping(prev => ({
      ...prev,
      [fieldKey]: csvColumn || undefined,
    }))
  }

  const handleSubmit = () => {
    // Validate required fields
    if (!mapping.date || !mapping.type) {
      alert('Please map at least Date and Transaction Type fields')
      return
    }

    onMappingComplete(mapping as ColumnMapping)
  }

  const isMappingValid = mapping.date && mapping.type

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Map CSV Columns</h2>
        <p className="text-sm text-gray-600">
          Match your CSV columns to the required fields. At minimum, you must map Date and Transaction Type.
        </p>
      </div>

      {/* CSV Preview */}
      <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">CSV Preview (first 3 rows)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {csvHeaders.map((header, idx) => (
                  <th key={idx} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewRows.slice(0, 3).map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {csvHeaders.map((header, colIdx) => (
                    <td key={colIdx} className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {row[header] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column Mapping Form */}
      <div className="space-y-4 mb-6">
        {MAPPABLE_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-4">
            <label className="w-48 text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={mapping[field.key as keyof ColumnMapping] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">-- Not mapped --</option>
              {csvHeaders.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isMappingValid}
          className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import with this mapping
        </button>
      </div>
    </div>
  )
}
