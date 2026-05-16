import { classifyTab, type TabCategoryMatch } from './categories'
import { loadCategoryRules } from './settings'

export type OrganizeTabsResult = {
  ok: boolean
  message: string
  groupedTabCount: number
  groupCount: number
}

export async function organizeCurrentWindowTabs(): Promise<OrganizeTabsResult> {
  const categoryRules = await loadCategoryRules()
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const tabsToOrganize = tabs.filter((tab) => !tab.pinned && tab.id !== undefined)

  if (tabsToOrganize.length === 0) {
    return {
      ok: true,
      message: 'No unpinned tabs to organize.',
      groupedTabCount: 0,
      groupCount: 0,
    }
  }

  const tabsByCategory = new Map<string, chrome.tabs.Tab[]>()
  const categoriesByName = new Map<string, TabCategoryMatch>()

  for (const tab of tabsToOrganize) {
    const category = classifyTab(tab, categoryRules)
    const categoryTabs = tabsByCategory.get(category.name) ?? []
    categoryTabs.push(tab)
    tabsByCategory.set(category.name, categoryTabs)
    categoriesByName.set(category.name, category)
  }

  for (const [categoryName, categoryTabs] of tabsByCategory) {
    const tabIds = categoryTabs
      .map((tab) => tab.id)
      .filter((tabId): tabId is number => tabId !== undefined)

    if (tabIds.length === 0) {
      continue
    }

    const color = categoriesByName.get(categoryName)?.color ?? 'grey'
    const groupId = await chrome.tabs.group({
      tabIds: toTabGroupIds(tabIds),
    })

    await chrome.tabGroups.update(groupId, {
      title: categoryName,
      color,
    })
  }

  return {
    ok: true,
    message: `Organized ${tabsToOrganize.length} tabs into ${tabsByCategory.size} groups.`,
    groupedTabCount: tabsToOrganize.length,
    groupCount: tabsByCategory.size,
  }
}

function toTabGroupIds(tabIds: number[]): number | [number, ...number[]] {
  if (tabIds.length === 1) {
    return tabIds[0]
  }

  return tabIds as [number, ...number[]]
}
