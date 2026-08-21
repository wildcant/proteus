import { test } from '@tests/setup/test-extend.js'
import { extractFiles } from '../multipart.js'

const multipartRequest = (formData: FormData) =>
  new Request('http://localhost/admin/uploads', { method: 'POST', body: formData })

test.describe('extractFiles', () => {
  test('collects files sent under the files field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
    formData.append('files', new File(['b'], 'b.txt', { type: 'text/plain' }))

    const files = await extractFiles(multipartRequest(formData))

    expect(files.map((file) => file.name)).toEqual(['a.txt', 'b.txt'])
  })

  test('ignores files sent under any other field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
    formData.append('attachments', new File(['b'], 'b.txt', { type: 'text/plain' }))

    const files = await extractFiles(multipartRequest(formData))

    expect(files.map((file) => file.name)).toEqual(['a.txt'])
  })

  test('ignores non-file values sent under the files field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', 'not-a-file')

    const files = await extractFiles(multipartRequest(formData))

    expect(files).toEqual([])
  })
})
