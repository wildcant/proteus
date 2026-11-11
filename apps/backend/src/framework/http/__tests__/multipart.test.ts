import { test } from '@tests/setup/test-extend.js'
import { extractMultipart } from '../multipart.js'

const multipartRequest = (formData: FormData) =>
  new Request('http://localhost/admin/uploads', { method: 'POST', body: formData })

test.describe('extractMultipart', () => {
  test('collects files sent under the files field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
    formData.append('files', new File(['b'], 'b.txt', { type: 'text/plain' }))

    const { files } = await extractMultipart(multipartRequest(formData))

    expect(files.map((file) => file.name)).toEqual(['a.txt', 'b.txt'])
  })

  test('ignores files sent under any other field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', new File(['a'], 'a.txt', { type: 'text/plain' }))
    formData.append('attachments', new File(['b'], 'b.txt', { type: 'text/plain' }))

    const { files } = await extractMultipart(multipartRequest(formData))

    expect(files.map((file) => file.name)).toEqual(['a.txt'])
  })

  test('ignores non-file values sent under the files field', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', 'not-a-file')

    const { files } = await extractMultipart(multipartRequest(formData))

    expect(files).toEqual([])
  })

  test('hands every other text field on as the body', async ({ expect }) => {
    const formData = new FormData()
    formData.append('files', new File(['a'], 'a.csv', { type: 'text/csv' }))
    formData.append('access', 'private')

    const { fields } = await extractMultipart(multipartRequest(formData))

    expect(fields).toEqual({ access: 'private' })
  })
})
