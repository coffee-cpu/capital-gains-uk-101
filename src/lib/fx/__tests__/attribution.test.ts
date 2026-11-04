import { describe, it, expect } from 'vitest'
import { combineFxAttributions } from '../attribution'

describe('combineFxAttributions', () => {
  it('lists one source once, combining the hosts it came from', () => {
    expect(combineFxAttributions([
      'HMRC Monthly Exchange Rates (gov.uk)',
      'HMRC Monthly Exchange Rates (2015-2020 archive)',
      'HMRC Monthly Exchange Rates (gov.uk)',
    ])).toEqual(['HMRC Monthly Exchange Rates (2015-2020 archive and gov.uk)'])
  })

  it('folds a plain label cached by an earlier version into the same source', () => {
    expect(combineFxAttributions([
      'HMRC Monthly Exchange Rates',
      'HMRC Monthly Exchange Rates (gov.uk)',
    ])).toEqual(['HMRC Monthly Exchange Rates (gov.uk)'])
    expect(combineFxAttributions(['HMRC Monthly Exchange Rates'])).toEqual(['HMRC Monthly Exchange Rates'])
  })

  it('keeps different sources apart and leaves single labels unchanged', () => {
    expect(combineFxAttributions([
      'HMRC Monthly Exchange Rates (gov.uk)',
      'European Central Bank (via Frankfurter)',
    ])).toEqual([
      'European Central Bank (via Frankfurter)',
      'HMRC Monthly Exchange Rates (gov.uk)',
    ])
    expect(combineFxAttributions([])).toEqual([])
  })
})
