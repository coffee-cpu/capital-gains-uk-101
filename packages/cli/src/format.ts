import { CalculateReport } from './report'

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export function formatGbp(value: number): string {
  return gbp.format(value)
}

function formatQuantity(value: number): string {
  return value.toLocaleString('en-GB', { maximumFractionDigits: 8 })
}

function table(rows: string[][], alignRight: boolean[] = []): string[] {
  const widths = rows[0].map((_, col) => Math.max(...rows.map(row => row[col].length)))
  return rows.map(row =>
    row.map((cell, col) => (alignRight[col] ? cell.padStart(widths[col]) : cell.padEnd(widths[col]))).join('  ').trimEnd()
  )
}

function indent(lines: string[], spaces = 2): string[] {
  return lines.map(line => ' '.repeat(spaces) + line)
}

/** Human-readable summary for terminals */
export function formatCalculateText(report: CalculateReport): string {
  const lines: string[] = []
  lines.push(`${report.tool.name} ${report.tool.version} — UK capital gains on shares (FX: ${report.options.fxSourceName})`)
  lines.push('')

  lines.push('Inputs')
  lines.push(...indent(table(report.inputs.map(i => [i.file, i.broker, `${i.transactions} transactions`]))))

  for (const year of report.taxYears) {
    lines.push('')
    lines.push(`Tax year ${year.taxYear} (${year.startDate} to ${year.endDate})`)
    const summary: string[][] = [
      ['Disposals', String(year.disposals)],
      ['Disposal proceeds', formatGbp(year.proceedsGbp)],
      ['Allowable costs', formatGbp(year.allowableCostsGbp)],
      ['Gains', formatGbp(year.gainsGbp)],
      ['Losses', formatGbp(year.lossesGbp)],
      ['Net gain/loss', formatGbp(year.netGainOrLossGbp)],
      ['Annual exempt amount', formatGbp(year.annualExemptAmountGbp)],
      ['Taxable gain', formatGbp(year.taxableGainGbp)],
    ]
    if (year.dividends.count > 0) {
      summary.push(['Dividends (gross)', formatGbp(year.dividends.grossGbp)])
    }
    if (year.interest.count > 0) {
      summary.push(['Interest (gross)', formatGbp(year.interest.grossGbp)])
    }
    lines.push(...indent(table(summary, [false, true])))

    if (year.rateChange2024) {
      const rc = year.rateChange2024
      lines.push('')
      lines.push(`  Rate change on ${rc.rateChangeDate}: net ${formatGbp(rc.netBeforeGbp)} before, ${formatGbp(rc.netAfterGbp)} on or after.`)
      if (rc.adjustmentRequired) {
        lines.push('  An SA108 adjustment for the rate change is required; use HMRC\'s calculator to work it out.')
      }
    }

    const yearDisposals = report.disposals.filter(d => d.taxYear === year.taxYear)
    if (yearDisposals.length > 0) {
      lines.push('')
      const rows = [
        ['Date', 'Symbol', 'Quantity', 'Proceeds', 'Cost', 'Gain/loss', 'Rules'],
        ...yearDisposals.map(d => [
          d.date,
          d.symbol,
          formatQuantity(d.quantity),
          formatGbp(d.proceedsGbp),
          formatGbp(d.allowableCostsGbp),
          formatGbp(d.gainOrLossGbp),
          d.rules.join(', ') + (d.incomplete ? ' (incomplete)' : ''),
        ]),
      ]
      lines.push(...indent(table(rows, [false, false, true, true, true, true, false])))
    }
  }

  if (report.section104Pools.length > 0) {
    lines.push('')
    lines.push('Section 104 holdings (after the last imported transaction)')
    const rows = report.section104Pools.map(p => [
      p.symbol,
      formatQuantity(p.quantity),
      formatGbp(p.costGbp),
      `avg ${formatGbp(p.averageCostGbp)}`,
    ])
    lines.push(...indent(table(rows, [false, true, true, false])))
  }

  if (report.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings')
    for (const warning of report.warnings) {
      lines.push(`  ! [${warning.code}] ${warning.message}`)
    }
  }

  lines.push('')
  lines.push(report.disclaimer)
  return lines.join('\n') + '\n'
}

function csvField(value: string | number | boolean): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** One row per disposal, for spreadsheets */
export function formatDisposalsCsv(report: CalculateReport): string {
  const header = ['date', 'tax_year', 'symbol', 'quantity', 'proceeds_gbp', 'allowable_costs_gbp', 'gain_or_loss_gbp', 'rules', 'incomplete', 'transaction_id']
  const rows = report.disposals.map(d => [
    d.date,
    d.taxYear,
    d.symbol,
    d.quantity,
    d.proceedsGbp.toFixed(2),
    d.allowableCostsGbp.toFixed(2),
    d.gainOrLossGbp.toFixed(2),
    d.rules.join(';'),
    d.incomplete,
    d.id,
  ])
  return [header, ...rows].map(row => row.map(csvField).join(',')).join('\n') + '\n'
}
