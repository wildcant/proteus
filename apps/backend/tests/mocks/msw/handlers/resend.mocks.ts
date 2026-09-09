import { HttpResponse, http } from 'msw'

export const resendHandlers = [
  http.post('https://api.resend.com/emails', () => {
    return HttpResponse.json({ id: 'mock_email_00000000-0000-0000-0000-000000000000' })
  }),
]
