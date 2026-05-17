import {
  classifyTab,
  getFallbackCategory,
  type TabCategoryMatch,
} from './categories'
import { loadCategoryRules } from './settings'

export type OrganizeTabsResult = {
  ok: boolean
  message: string
  groupedTabCount: number
  groupCount: number
  inspectedTabCount?: number
  inspectedTabs?: Array<{
    group: string
    matchedPattern?: string
    reason?: string
    title?: string
    url?: string
  }>
  categoryCounts?: Record<string, number>
  selectedCategoryNames?: string[]
}

export async function organizeCurrentWindowTabs(): Promise<OrganizeTabsResult> {
  return organizeTabs({ currentWindow: true })
}

export async function organizeWindowTabs(
  windowId: number,
): Promise<OrganizeTabsResult> {
  return organizeTabs({ windowId })
}

export async function autoOrganizeWindowTabsByThreshold(
  windowId: number,
  threshold: number,
): Promise<OrganizeTabsResult> {
  const categoryRules = await loadCategoryRules()
  const fallbackCategory = getFallbackCategory(categoryRules)
  const tabs = await chrome.tabs.query({ windowId })
  const tabsToInspect = tabs.filter((tab) => !tab.pinned && tab.id !== undefined)
  const tabsByCategory = new Map<string, chrome.tabs.Tab[]>()
  const categoriesByName = new Map<string, TabCategoryMatch>()
  const inspectedTabs: NonNullable<OrganizeTabsResult['inspectedTabs']> = []

  for (const tab of tabsToInspect) {
    const category = classifyTab(tab, categoryRules)

    inspectedTabs.push({
      group: category.name,
      matchedPattern: category.matchedPattern,
      reason: category.reason,
      title: tab.title,
      url: tab.url,
    })

    if (category.name === fallbackCategory.name) {
      continue
    }

    const categoryTabs = tabsByCategory.get(category.name) ?? []
    categoryTabs.push(tab)
    tabsByCategory.set(category.name, categoryTabs)
    categoriesByName.set(category.name, category)
  }

  let groupedTabCount = 0
  let groupCount = 0
  const selectedCategoryNames: string[] = []

  for (const [categoryName, categoryTabs] of tabsByCategory) {
    if (categoryTabs.length < threshold) {
      continue
    }

    await groupTabs(categoryName, categoryTabs, categoriesByName)
    groupedTabCount += categoryTabs.length
    groupCount += 1
    selectedCategoryNames.push(categoryName)
  }

  return {
    ok: true,
    message:
      groupCount === 0
        ? `No group reached the ${threshold}-tab threshold.`
        : `Auto-organized ${groupedTabCount} tabs into ${groupCount} groups.`,
    groupedTabCount,
    groupCount,
    inspectedTabCount: tabsToInspect.length,
    inspectedTabs,
    categoryCounts: Object.fromEntries(
      Array.from(tabsByCategory, ([categoryName, categoryTabs]) => [
        categoryName,
        categoryTabs.length,
      ]),
    ),
    selectedCategoryNames,
  }
}

async function organizeTabs(
  queryInfo: chrome.tabs.QueryInfo,
): Promise<OrganizeTabsResult> {
  const categoryRules = await loadCategoryRules()
  const tabs = await chrome.tabs.query(queryInfo)
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
    await groupTabs(categoryName, categoryTabs, categoriesByName)
  }

  return {
    ok: true,
    message: `Organized ${tabsToOrganize.length} tabs into ${tabsByCategory.size} groups.`,
    groupedTabCount: tabsToOrganize.length,
    groupCount: tabsByCategory.size,
  }
}

async function groupTabs(
  categoryName: string,
  categoryTabs: chrome.tabs.Tab[],
  categoriesByName: Map<string, TabCategoryMatch>,
) {
  const tabIds = categoryTabs
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined)

  if (tabIds.length === 0) {
    return
  }

  const color = categoriesByName.get(categoryName)?.color ?? 'grey'
  console.info('[TabFlow groupTabs] grouping', {
    categoryName,
    color,
    tabIds,
  })
  let groupId: number

  try {
    groupId = await chrome.tabs.group({
      tabIds: toTabGroupIds(tabIds),
    })
  } catch (error) {
    console.error(
      '[TabFlow groupTabs] chrome.tabs.group failed',
      {
        categoryName,
        tabIds,
        lastError: chrome.runtime.lastError?.message,
      },
      error,
    )
    throw error
  }

  try {
    await chrome.tabGroups.update(groupId, {
      title: categoryName,
      color,
    })
  } catch (error) {
    console.error(
      '[TabFlow groupTabs] chrome.tabGroups.update failed',
      {
        categoryName,
        groupId,
        color,
        lastError: chrome.runtime.lastError?.message,
      },
      error,
    )
    throw error
  }
}

export async function organizeSingleTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.pinned || tab.id === undefined) {
    return
  }

  const categoryRules = await loadCategoryRules()
  const category = classifyTab(tab, categoryRules)
  const existingGroupId = await findMatchingGroupId(tab.windowId, category.name)

  if (existingGroupId === tab.groupId) {
    await chrome.tabGroups.update(existingGroupId, {
      title: category.name,
      color: category.color,
    })
    return
  }

  const groupId = await chrome.tabs.group({
    tabIds: tab.id,
    ...(existingGroupId === undefined ? {} : { groupId: existingGroupId }),
  })

  await chrome.tabGroups.update(groupId, {
    title: category.name,
    color: category.color,
  })
}

async function findMatchingGroupId(
  windowId: number,
  categoryName: string,
): Promise<number | undefined> {
  const existingGroups = await chrome.tabGroups.query({
    title: categoryName,
    windowId,
  })

  return existingGroups[0]?.id
}

function toTabGroupIds(tabIds: number[]): number | [number, ...number[]] {
  if (tabIds.length === 1) {
    return tabIds[0]
  }

  return tabIds as [number, ...number[]]
}
