import { useState } from 'react'
import { extensionDescription, extensionName } from '../lib/extension'
import { organizeCurrentWindowTabs } from '../lib/organizeTabs'

type PopupStatus = {
  tone: 'idle' | 'success' | 'error'
  message: string
  groupedTabCount?: number
  groupCount?: number
}

export function Popup() {
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [status, setStatus] = useState<PopupStatus>({
    tone: 'idle',
    message: 'Ready to organize unpinned tabs in this window.',
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
        groupedTabCount: response.groupedTabCount,
        groupCount: response.groupCount,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? `Organizing failed: ${error.message}`
            : 'Organizing failed. Check the extension permissions and try again.',
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

  function handleOpenOptions() {
    chrome.runtime.openOptionsPage()
  }

  return (
    <main className="w-88 space-y-4 bg-slate-50 p-4">
      <header className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Tab organizer
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              {extensionName}
            </h1>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Manual
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          {extensionDescription}
        </p>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Auto-organize
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            Off. Use Organize now when you want to group this window.
          </p>
        </div>
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={handleOrganizeTabs}
          disabled={isOrganizing}
          className="w-full rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isOrganizing ? 'Organizing...' : 'Organize now'}
        </button>

        {status.tone === 'success' && status.groupedTabCount !== undefined ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tabs grouped
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {status.groupedTabCount}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Groups
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">
                {status.groupCount ?? 0}
              </p>
            </div>
          </div>
        ) : null}

        <p className={`rounded-md border px-3 py-2 text-sm ${statusClassName}`}>
          {status.message}
        </p>

        <button
          type="button"
          onClick={handleOpenOptions}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Edit categories
        </button>
      </section>
    </main>
  )
}
