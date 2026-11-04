import { mkdtemp, readFile, readdir, rmdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeepgramCredentialStore, type ProtectedStorage } from './credentials'

let directory: string
const crypto: ProtectedStorage = {
  isAsyncEncryptionAvailable: vi.fn(async () => true),
  encryptStringAsync: vi.fn(async (value) => Buffer.from(`encrypted:${value}`).reverse()),
  decryptStringAsync: vi.fn(async (value) => ({ result: value.reverse().toString().slice('encrypted:'.length), shouldReEncrypt: false })),
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'orivox-key-test-'))
  vi.stubEnv('DEEPGRAM_API_KEY', '')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  for (const name of await readdir(directory)) await unlink(join(directory, name))
  await rmdir(directory)
})

describe('DeepgramCredentialStore', () => {
  it('writes only protected ciphertext and reads it back', async () => {
    const store = new DeepgramCredentialStore(directory, crypto)
    await store.set('synthetic-test-key')
    const bytes = await readFile(join(directory, 'deepgram.key.enc'))
    expect(bytes.toString()).not.toContain('synthetic-test-key')
    expect(await store.get()).toBe('synthetic-test-key')
    await store.delete()
    expect(await store.get()).toBeNull()
  })

  it('uses an ephemeral environment key without writing a file', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', 'ephemeral-test-key')
    const store = new DeepgramCredentialStore(directory, crypto)
    expect(await store.get()).toBe('ephemeral-test-key')
    expect(await readdir(directory)).toEqual([])
  })

  it('refuses to persist a key when OS encryption is unavailable', async () => {
    const unavailable: ProtectedStorage = { ...crypto, isAsyncEncryptionAvailable: async () => false }
    const store = new DeepgramCredentialStore(directory, unavailable)
    await expect(store.set('synthetic-test-key')).rejects.toThrow('protected credential storage is unavailable')
    expect(await readdir(directory)).toEqual([])
  })
})
