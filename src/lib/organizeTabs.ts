import {
  classifyTab,
  getFallbackCategory,
  type TabCategoryMatch,
  type TabCategoryRule,
  type TabGroupColor,
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
  categoryRules?: TabCategoryRule[],
  shouldCollectDebugInfo = false,
): Promise<OrganizeTabsResult> {
  const rules = categoryRules ?? (await loadCategoryRules())
  const fallbackCategory = getFallbackCategory(rules)
  const tabs = await chrome.tabs.query({ windowId })
  const tabsToInspect = tabs.filter((tab) => !tab.pinned && tab.id !== undefined)
  const tabsByCategory = new Map<string, chrome.tabs.Tab[]>()
  const categoriesByName = new Map<string, TabCategoryMatch>()
  const inspectedTabs: NonNullable<OrganizeTabsResult['inspectedTabs']> = []

  for (const tab of tabsToInspect) {
    const category = classifyTab(tab, rules)

    if (shouldCollectDebugInfo) {
      inspectedTabs.push({
        group: category.name,
        matchedPattern: category.matchedPattern,
        reason: category.reason,
        title: tab.title,
        url: tab.url,
      })
    }

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

    selectedCategoryNames.push(categoryName)

    const groupedTabs = await groupTabs(categoryName, categoryTabs, categoriesByName)

    if (groupedTabs > 0) {
      groupedTabCount += groupedTabs
      groupCount += 1
    }
  }

  const message =
    selectedCategoryNames.length === 0
      ? `No group reached the ${threshold}-tab threshold.`
      : groupedTabCount === 0
        ? 'Matching groups are already organized.'
        : `Auto-organized ${groupedTabCount} tabs into ${groupCount} groups.`

  return {
    ok: true,
    message,
    groupedTabCount,
    groupCount,
    inspectedTabCount: tabsToInspect.length,
    inspectedTabs: shouldCollectDebugInfo ? inspectedTabs : undefined,
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
): Promise<number> {
  const tabIds = categoryTabs
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined)

  if (tabIds.length === 0) {
    return 0
  }

  const color = categoriesByName.get(categoryName)?.color ?? 'grey'
  const windowId = categoryTabs[0]?.windowId
  const existingGroup = await findMatchingGroup(windowId, categoryName, color)
  const tabsToMove = existingGroup
    ? categoryTabs.filter((tab) => tab.groupId !== existingGroup.id)
    : categoryTabs
  const tabIdsToMove = tabsToMove
    .map((tab) => tab.id)
    .filter((tabId): tabId is number => tabId !== undefined)

  if (existingGroup && tabIdsToMove.length === 0) {
    if (existingGroup.color !== color) {
      await chrome.tabGroups.update(existingGroup.id, { color })
    }

    return 0
  }

  if (tabIdsToMove.length === 0) {
    return 0
  }

  try {
    const groupId = await chrome.tabs.group({
      tabIds: toTabGroupIds(tabIdsToMove),
      ...(existingGroup ? { groupId: existingGroup.id } : {}),
    })

    await chrome.tabGroups.update(groupId, {
      title: categoryName,
      color,
    })
  } catch (error) {
    console.error(
      '[TabFlow groupTabs] grouping failed',
      {
        categoryName,
        tabIds: tabIdsToMove,
        lastError: chrome.runtime.lastError?.message,
      },
      error,
    )
    throw error
  }

  return tabIdsToMove.length
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
  const existingGroups = await chrome.tabGroups.query({ title: categoryName, windowId })

  return existingGroups[0]?.id
}

async function findMatchingGroup(
  windowId: number | undefined,
  categoryName: string,
  color: TabGroupColor,
): Promise<chrome.tabGroups.TabGroup | undefined> {
  if (windowId === undefined) {
    return undefined
  }

  const existingGroups = await chrome.tabGroups.query({
    title: categoryName,
    windowId,
  })

  return existingGroups.find((group) => group.color === color) ?? existingGroups[0]
}

function toTabGroupIds(tabIds: number[]): number | [number, ...number[]] {
  if (tabIds.length === 1) {
    return tabIds[0]
  }

  return tabIds as [number, ...number[]]
}
