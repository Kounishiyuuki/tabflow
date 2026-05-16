import { classifyTab, fallbackCategory, type TabCategoryName } from './categories'

export type OrganizeTabsResult = {
  ok: boolean
  message: string
}

export async function organizeCurrentWindowTabs(): Promise<OrganizeTabsResult> {
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const tabsToOrganize = tabs.filter((tab) => !tab.pinned && tab.id !== undefined)

  if (tabsToOrganize.length === 0) {
    return {
      ok: true,
      message: 'No unpinned tabs to organize.',
    }
  }

  const tabsByCategory = new Map<TabCategoryName, chrome.tabs.Tab[]>()

  for (const tab of tabsToOrganize) {
    const category = classifyTab(tab)
    const categoryTabs = tabsByCategory.get(category.name) ?? []
    categoryTabs.push(tab)
    tabsByCategory.set(category.name, categoryTabs)
  }

  for (const [categoryName, categoryTabs] of tabsByCategory) {
    const tabIds = categoryTabs
      .map((tab) => tab.id)
      .filter((tabId): tabId is number => tabId !== undefined)

    if (tabIds.length === 0) {
      continue
    }

    const firstTabCategory = classifyTab(categoryTabs[0])
    const color =
      categoryName === fallbackCategory.name
        ? fallbackCategory.color
        : firstTabCategory.color
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
  }
}

function toTabGroupIds(tabIds: number[]): number | [number, ...number[]] {
  if (tabIds.length === 1) {
    return tabIds[0]
  }

  return tabIds as [number, ...number[]]
}
