import { organizeSingleTab } from '../lib/organizeTabs'
import { loadAutoOrganizeEnabled } from '../lib/settings'

chrome.runtime.onInstalled.addListener(() => {
  console.info('TabFlow extension installed.')
})

const tabsBeingOrganized = new Set<number>()

chrome.tabs.onCreated.addListener((tab) => {
  void organizeTabIfEnabled(tab)
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url === undefined && changeInfo.title === undefined) {
    return
  }

  void organizeTabIfEnabled(tab)
})

async function organizeTabIfEnabled(tab: chrome.tabs.Tab) {
  if (tab.id === undefined || tabsBeingOrganized.has(tab.id)) {
    return
  }

  const isAutoOrganizeEnabled = await loadAutoOrganizeEnabled()

  if (!isAutoOrganizeEnabled) {
    return
  }

  tabsBeingOrganized.add(tab.id)

  try {
    await organizeSingleTab(tab)
  } catch (error) {
    console.error('TabFlow auto-organize failed.', error)
  } finally {
    tabsBeingOrganized.delete(tab.id)
  }
}
