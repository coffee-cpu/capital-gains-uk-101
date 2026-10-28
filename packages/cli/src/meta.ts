declare const __CLI_VERSION__: string | undefined

export const CLI_NAME = 'cgt-visualiser'

/** Injected by build.mjs from package.json; tests run from source */
export const CLI_VERSION = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0-dev'

export const WEB_APP_URL = 'https://cgtvisualiser.co.uk'

export const DISCLAIMER =
  'Not tax advice. Figures are calculated from HMRC guidance (same-day, 30-day and Section 104 rules) ' +
  'and may be wrong or incomplete. Check them, for example by loading the same files in the web app ' +
  `(${WEB_APP_URL}), and consult HMRC helpsheet HS284 or a qualified adviser before filing.`

export const ExitCode = {
  OK: 0,
  USAGE: 1,
  INPUT: 2,
  WARNINGS: 3,
} as const

export type ExitCodeValue = typeof ExitCode[keyof typeof ExitCode]

/** An error with a message fit for users and a specific exit code */
export class CliError extends Error {
  constructor(message: string, readonly exitCode: ExitCodeValue = ExitCode.USAGE) {
    super(message)
  }
}
