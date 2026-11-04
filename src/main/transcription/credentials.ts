import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface ProtectedStorage {
  isAsyncEncryptionAvailable(): Promise<boolean>
  encryptStringAsync(value: string): Promise<Buffer>
  decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>
}

/** Stores only OS-encrypted ciphertext under Electron's per-user data directory. */
export class DeepgramCredentialStore {
  private readonly path: string

  constructor(
    private readonly userDataDirectory: string,
    private readonly protectedStorage: ProtectedStorage,
  ) {
    this.path = join(userDataDirectory, 'deepgram.key.enc')
  }

  async get(): Promise<string | null> {
    // An ephemeral parent-process variable is useful for development and is never written to disk.
    const environmentKey = process.env.DEEPGRAM_API_KEY?.trim()
    if (environmentKey) return environmentKey
    let encrypted: Buffer
    try {
      encrypted = await readFile(this.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw new Error('Could not read the protected Deepgram credential.')
    }
    if (!(await this.protectedStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Windows protected credential storage is unavailable.')
    }
    try {
      const { result, shouldReEncrypt } = await this.protectedStorage.decryptStringAsync(encrypted)
      if (shouldReEncrypt) await this.set(result)
      return result || null
    } catch {
      throw new Error('Could not decrypt the protected Deepgram credential.')
    }
  }

  async set(value: string): Promise<void> {
    const key = value.trim()
    if (!key || key.length > 512) throw new Error('Enter a valid Deepgram API key.')
    if (!(await this.protectedStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Windows protected credential storage is unavailable.')
    }
    const encrypted = await this.protectedStorage.encryptStringAsync(key)
    await mkdir(this.userDataDirectory, { recursive: true })
    await writeFile(this.path, encrypted, { mode: 0o600 })
  }

  async delete(): Promise<void> {
    try {
      await unlink(this.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error('Could not remove the protected Deepgram credential.')
      }
    }
  }
}
