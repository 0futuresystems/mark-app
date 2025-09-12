export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text)
}

export function buildCsvFromLots(lots: Array<{ id: string, title?: string }>, media: Array<{ lotId: string, url: string }>) {
  // very simple CSV: LotID,Title,URL
  const header = 'LotID,Title,URL'
  const rows = media.map(m => {
    const lot = lots.find(l => l.id === m.lotId)
    const title = (lot?.title || '').replace(/"/g, '""')
    return `"${m.lotId}","${title}","${m.url}"`
  })
  return [header, ...rows].join('\n')
}
