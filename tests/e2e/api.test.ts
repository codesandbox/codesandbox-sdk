import { describe, expect, it } from 'vitest'
import { CodeSandbox } from '../../src/index'

process.env.CSB_BASE_URL = process.env.CSB_BASE_URL ?? 'https://api.codesandbox.dev'
process.env.CSB_API_KEY = process.env.CSB_API_KEY ?? 'csb_v1_devbox'

// Stream
//      Pitcher: 7ngcrf
//      Pint + Bartender: 8rf5py
// process.env.CSB_TEMPLATE_ID = process.env.CSB_TEMPLATE_ID ?? '7ngcrf'
process.env.CSB_TEMPLATE_ID = process.env.CSB_TEMPLATE_ID ?? '8rf5py'


describe('Sandbox Creation', () => {
    it('should successfully create and start a sandbox', async () => {
        const sdk = new CodeSandbox()
        let sandbox: any = null
        
        try {
            console.log('Creating sandbox...')
            sandbox = await sdk.sandboxes.create({
                id: process.env.CSB_TEMPLATE_ID,
            })
            console.log('Created sandbox with ID:', sandbox.id)

            
            const client = await sandbox.connect()
            console.log('Connected to sandbox, fetching root files...')

            const files = await client.fs.readdir('/')
            expect(sandbox).not.toBeNull()
            expect(Array.isArray(files)).toBe(true)
            expect(files.length).toBeGreaterThan(0)
            expect(files.some((file: any) => file.name === 'etc' && file.type === 'directory' && !file.isSymlink)).toBe(true)
            
        } finally {
            if (sandbox) {
                console.log('Shutting down sandbox...')
                await sdk.sandboxes.shutdown(sandbox.id)
            }
        }
    }, 30000)
})
