import { useEffect, useState } from 'react'
import { extensionDescription, extensionName } from '../lib/extension'
import { organizeCurrentWindowTabs } from '../lib/organizeTabs'
import {
  defaultAutoOrganizeThreshold,
  loadAutoOrganizeEnabled,
  loadAutoOrganizeThreshold,
  saveAutoOrganizeEnabled,
  saveAutoOrganizeThreshold,
} from '../lib/settings'

type PopupStatus = {
  tone: 'idle' | 'success' | 'error'
  message: string
  groupedTabCount?: number
  groupCount?: number
}

export function Popup() {
  const [isOrganizing, setIsOrganizing] = useState(false)
  const [isAutoOrganizeEnabled, setIsAutoOrganizeEnabled] = useState(false)
  const [autoOrganizeThreshold, setAutoOrganizeThreshold] = useState(
    defaultAutoOrganizeThreshold,
  )
  const [isLoadingAutoOrganize, setIsLoadingAutoOrganize] = useState(true)
  const [status, setStatus] = useState<PopupStatus>({
    tone: 'idle',
    message: 'Ready to organize unpinned tabs in this window.',
  })

  useEffect(() => {
    Promise.all([loadAutoOrganizeEnabled(), loadAutoOrganizeThreshold()])
      .then(([isEnabled, threshold]) => {
        setIsAutoOrganizeEnabled(isEnabled)
        setAutoOrganizeThreshold(threshold)
      })
      .catch((error: unknown) => {
        setStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? `Unable to load auto-organize setting: ${error.message}`
              : 'Unable to load auto-organize setting.',
        })
      })
      .finally(() => {
        setIsLoadingAutoOrganize(false)
      })
  }, [])

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

  async function handleThresholdChange(thresholdValue: string) {
    const nextThreshold = Math.max(1, Math.round(Number(thresholdValue) || 1))
    setAutoOrganizeThreshold(nextThreshold)

    try {
      await saveAutoOrganizeThreshold(nextThreshold)
      setStatus({
        tone: 'success',
        message: `Auto-organize threshold set to ${nextThreshold} tabs.`,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? `Unable to save threshold: ${error.message}`
            : 'Unable to save threshold.',
      })
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

  async function handleToggleAutoOrganize() {
    const nextValue = !isAutoOrganizeEnabled
    setIsLoadingAutoOrganize(true)

    try {
      await saveAutoOrganizeEnabled(nextValue)
      setIsAutoOrganizeEnabled(nextValue)
      setStatus({
        tone: 'success',
        message: nextValue
          ? 'Auto-organize enabled for new and updated tabs.'
          : 'Auto-organize disabled. Manual organizing still works.',
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? `Unable to save auto-organize setting: ${error.message}`
            : 'Unable to save auto-organize setting.',
      })
    } finally {
      setIsLoadingAutoOrganize(false)
    }
  }

  const autoOrganizeLabel = isAutoOrganizeEnabled ? 'On' : 'Off'
  const autoOrganizeBadgeClassName = isAutoOrganizeEnabled
    ? 'border-green-200 bg-green-50 text-green-800'
    : 'border-amber-200 bg-amber-50 text-amber-800'

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
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${autoOrganizeBadgeClassName}`}
          >
            Auto {autoOrganizeLabel}
          </span>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          {extensionDescription}
        </p>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Auto-organize
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {isAutoOrganizeEnabled
                  ? `Groups categories at ${autoOrganizeThreshold}+ matching tabs.`
                  : `Off. Threshold is ${autoOrganizeThreshold} matching tabs.`}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isAutoOrganizeEnabled}
              onClick={handleToggleAutoOrganize}
              disabled={isLoadingAutoOrganize}
              className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isAutoOrganizeEnabled ? 'bg-sky-700' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                  isAutoOrganizeEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
          <label className="mt-3 grid gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Threshold
            <input
              type="number"
              min="1"
              value={autoOrganizeThreshold}
              onChange={(event) => handleThresholdChange(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-sky-600"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Manual Organize now organizes all tabs immediately. Auto organize
            groups matching tabs when the same group reaches the threshold.
            Example: threshold 3 groups three YouTube tabs into SNS.
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
