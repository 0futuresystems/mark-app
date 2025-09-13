export async function uploadZipToR2(objectKey: string, zipBlob: Blob, auctionId: string) {
  // presign PUT
  const putRes = await fetch('/api/sign-put', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auctionId, objectKey, contentType: 'application/zip' })
  })
  if (!putRes.ok) throw new Error('Failed to sign PUT for ZIP')
  const { url, method = 'PUT', headers = {} } = await putRes.json()
  const up = await fetch(url, { method, headers, body: zipBlob })
  if (!up.ok) throw new Error('ZIP upload failed')
}

export async function presignZipGet(objectKey: string, expiresSeconds = 7 * 24 * 3600) {
  const getRes = await fetch('/api/sign-get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectKey, expiresSeconds })
  })
  if (!getRes.ok) throw new Error('Failed to sign GET for ZIP')
  const { url } = await getRes.json()
  return url as string
}
