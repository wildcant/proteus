const UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB']

export function formatFileSize(bytes: number, decimalPlaces = 2): string {
  if (!Number.isFinite(bytes)) {
    return 'unlimited'
  }

  if (bytes === 0) {
    return '0 Bytes'
  }

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = Number.parseFloat((bytes / 1024 ** exponent).toFixed(decimalPlaces))

  return `${value} ${UNITS[exponent]}`
}
