'use client'
import { useEffect } from 'react'

export default function StoragePersistence() {
  useEffect(() => {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist?.()
    }
  }, [])
  return null
}
