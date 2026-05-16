import { useState } from 'react'
import { extensionDescription, extensionName } from '../lib/extension'
import { organizeCurrentWindowTabs } from '../lib/organizeTabs'

type PopupStatus = {
  tone: 'idle' | 'success' | 'error'
  message: string
}

export function Popup() {
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [status, setStatus] = useState<PopupStatus>({
    tone: 'idle',
    message: 'Ready to organize the unpinned tabs in this window.',
  })

  async function handleOrganizeTabs() {
    setIsOrganizing(true)
    setStatus({
      tone: 'idle',
      message: 'Organizing tabs...',
    })

    try {
      const response = await organizeCurrentWindowTabs()

      setStatus({
        tone: response.ok ? 'success' : 'error',
        message: response.message,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to organize tabs.',
      })
    } finally {
      setIsOrganizing(false)
    }
  }

  const statusClassName =
    status.tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : status.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-slate-200 bg-slate-50 text-slate-600'

  return (
    <main className="w-80 space-y-4 p-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Chrome Extension
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          {extensionName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {extensionDescription}
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={handleOrganizeTabs}
          disabled={isOrganizing}
          className="w-full rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isOrganizing ? 'Organizing...' : 'Organize now'}
        </button>

        <p className={`rounded-md border px-3 py-2 text-sm ${statusClassName}`}>
          {status.message}
        </p>
      </section>
    </main>
  )
}
