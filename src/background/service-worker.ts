import { autoOrganizeWindowTabsByThreshold } from '../lib/organizeTabs'
import {
  loadAutoOrganizeEnabled,
  loadAutoOrganizeThreshold,
} from '../lib/settings'

chrome.runtime.onInstalled.addListener(() => {
  console.info('TabFlow extension installed.')
})

const pendingWindowTimers = new Map<number, number>()
const organizingWindowIds = new Set<number>()
const debounceDelayMs = 750
const logPrefix = '[TabFlow auto-organize]'

chrome.tabs.onCreated.addListener((tab) => {
  scheduleAutoOrganize('tabs.onCreated', tab.windowId)
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  const shouldInspectWindow =
    changeInfo.url !== undefined ||
    changeInfo.title !== undefined ||
    changeInfo.status === 'complete'

  if (!shouldInspectWindow) {
    return
  }

  scheduleAutoOrganize('tabs.onUpdated', tab.windowId)
})

chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  if (removeInfo.windowId < 0) {
    console.info(logPrefix, 'skip: removed tab has no active window')
    return
  }

  scheduleAutoOrganize('tabs.onRemoved', removeInfo.windowId)
})

function scheduleAutoOrganize(eventType: string, windowId: number) {
  if (windowId < 0) {
    console.info(logPrefix, 'event:', eventType, 'skip: invalid window id', windowId)
    return
  }

  if (organizingWindowIds.has(windowId)) {
    console.info(
      logPrefix,
      'event:',
      eventType,
      'window:',
      windowId,
      'skip: currently organizing',
    )
    return
  }

  console.info(logPrefix, 'event:', eventType, 'schedule window:', windowId)

  const existingTimer = pendingWindowTimers.get(windowId)

  if (existingTimer !== undefined) {
    clearTimeout(existingTimer)
  }

  const timer = setTimeout(() => {
    pendingWindowTimers.delete(windowId)
    void organizeWindowIfReady(windowId)
  }, debounceDelayMs)

  pendingWindowTimers.set(windowId, timer)
}

async function organizeWindowIfReady(windowId: number) {
  if (organizingWindowIds.has(windowId)) {
    console.info(logPrefix, 'window:', windowId, 'skip: already organizing')
    return
  }

  const isAutoOrganizeEnabled = await loadAutoOrganizeEnabled()

  console.info(logPrefix, 'enabled:', isAutoOrganizeEnabled, 'window:', windowId)

  if (!isAutoOrganizeEnabled) {
    console.info(logPrefix, 'skip: disabled')
    return
  }

  try {
    const threshold = await loadAutoOrganizeThreshold()
    organizingWindowIds.add(windowId)
    const result = await autoOrganizeWindowTabsByThreshold(windowId, threshold)

    console.info(
      logPrefix,
      'threshold:',
      threshold,
      'nonPinnedTabs:',
      result.inspectedTabCount ?? 0,
      'inspected:',
      result.inspectedTabs ?? [],
      'categoryCounts:',
      result.categoryCounts ?? {},
      'selected:',
      result.selectedCategoryNames ?? [],
    )

    if ((result.selectedCategoryNames ?? []).length === 0) {
      console.info(logPrefix, 'skip:', result.message)
    }
  } catch (error) {
    console.error('TabFlow auto-organize failed.', error)
  } finally {
    organizingWindowIds.delete(windowId)
  }
}
