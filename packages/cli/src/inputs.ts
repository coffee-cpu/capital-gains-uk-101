import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { createFileId } from '../../../src/lib/import'
import { CliError, ExitCode } from './meta'

export interface InputFile {
  /** Path as given on the command line */
  path: string
  /** File name, used for transaction IDs (matches the web app) */
  name: string
  text: string
  /** Transaction ID prefix, identical to the web app's for the same file */
  fileId: string
}

export async function readInputFiles(paths: string[]): Promise<InputFile[]> {
  if (paths.length === 0) {
    throw new CliError('No input files given.')
  }

  return Promise.all(paths.map(async path => {
    let buffer: Buffer
    try {
      buffer = await readFile(path)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new CliError(`Cannot read "${path}": ${reason}`, ExitCode.INPUT)
    }
    const name = basename(path)
    return {
      path,
      name,
      text: buffer.toString('utf-8'),
      fileId: createFileId(name, buffer.byteLength),
    }
  }))
}
