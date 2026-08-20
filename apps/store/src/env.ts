function createEnv() {
  const url = import.meta.env.VITE_BACKEND_URL
  if (!url) throw new Error('Missing required env var: VITE_BACKEND_URL')
  try {
    new URL(url)
  } catch {
    throw new Error(`VITE_BACKEND_URL is not a valid URL: "${url}"`)
  }
  return { VITE_BACKEND_URL: url as string }
}

export const env = createEnv()
