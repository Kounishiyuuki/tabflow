import { autoOrganizeWindowTabsByThreshold } from '../lib/organizeTabs'
import {
  loadTabFlowSettings,
  tabFlowSettingsStorageKeys,
  type TabFlowSettings,
} from '../lib/settings'

chrome.runtime.onInstalled.addListener(() => {
  console.info('TabFlow extension installed.')
})

const pendingWindowTimers = new Map<number, number>()
const organizingWindowIds = new Set<number>()
const debounceDelayMs = 750
const logPrefix = '[TabFlow auto-organize]'
let cachedSettings: TabFlowSettings | undefined
let settingsLoadPromise: Promise<TabFlowSettings> | undefined

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') {
    return
  }

  const relevantKeys = Object.values(tabFlowSettingsStorageKeys)
  const shouldRefreshSettings = relevantKeys.some((key) => key in changes)

  if (shouldRefreshSettings) {
    cachedSettings = undefined
    settingsLoadPromise = undefined
  }
})

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
    debugLog('skip: removed tab has no active window')
    return
  }

  scheduleAutoOrganize('tabs.onRemoved', removeInfo.windowId)
})

function scheduleAutoOrganize(eventType: string, windowId: number) {
  if (windowId < 0) {
    debugLog('event:', eventType, 'skip: invalid window id', windowId)
    return
  }

  if (organizingWindowIds.has(windowId)) {
    debugLog(
      'event:',
      eventType,
      'window:',
      windowId,
      'skip: currently organizing',
    )
    return
  }

  void getCachedSettings()
    .then((settings) => {
      if (!settings.autoOrganizeEnabled) {
        debugLog('event:', eventType, 'skip: disabled')
        return
      }

      debugLog('event:', eventType, 'schedule window:', windowId)

      const existingTimer = pendingWindowTimers.get(windowId)

      if (existingTimer !== undefined) {
        clearTimeout(existingTimer)
      }

      const timer = setTimeout(() => {
        pendingWindowTimers.delete(windowId)
        void organizeWindowIfReady(windowId)
      }, debounceDelayMs)

      pendingWindowTimers.set(windowId, timer)
    })
    .catch((error) => {
      console.error('TabFlow failed to read auto-organize settings.', error)
    })
}

async function organizeWindowIfReady(windowId: number) {
  if (organizingWindowIds.has(windowId)) {
    debugLog('window:', windowId, 'skip: already organizing')
    return
  }

  const settings = await getCachedSettings()

  debugLog(
    'enabled:',
    settings.autoOrganizeEnabled,
    'threshold:',
    settings.autoOrganizeThreshold,
    'window:',
    windowId,
  )

  if (!settings.autoOrganizeEnabled) {
    debugLog('skip: disabled')
    return
  }

  try {
    organizingWindowIds.add(windowId)
    const result = await autoOrganizeWindowTabsByThreshold(
      windowId,
      settings.autoOrganizeThreshold,
      settings.categories,
      settings.debugLogsEnabled,
    )

    debugLog(
      'threshold:',
      settings.autoOrganizeThreshold,
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
      debugLog('skip:', result.message)
    }
  } catch (error) {
    console.error('TabFlow auto-organize failed.', error)
  } finally {
    organizingWindowIds.delete(windowId)
  }
}

async function getCachedSettings() {
  if (cachedSettings !== undefined) {
    return cachedSettings
  }

  settingsLoadPromise ??= loadTabFlowSettings()
  cachedSettings = await settingsLoadPromise
  return cachedSettings
}

function debugLog(...args: unknown[]) {
  if (cachedSettings?.debugLogsEnabled) {
    console.info(logPrefix, ...args)
  }
}
