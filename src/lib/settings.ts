import {
  createDefaultCategoryRules,
  fallbackCategoryId,
  tabGroupColors,
  type TabCategoryRule,
  type TabGroupColor,
} from './categories'

const storageKey = 'tabflowCategoryRules'
const autoOrganizeStorageKey = 'tabflowAutoOrganizeEnabled'
const autoOrganizeThresholdStorageKey = 'tabflowAutoOrganizeThreshold'
export const defaultAutoOrganizeThreshold = 8

type StoredCategoryRules = {
  [storageKey]?: TabCategoryRule[]
}

type StoredAutoOrganizeSetting = {
  [autoOrganizeStorageKey]?: boolean
  [autoOrganizeThresholdStorageKey]?: number
}

export async function loadCategoryRules(): Promise<TabCategoryRule[]> {
  const storedSettings = await chrome.storage.sync.get(storageKey)
  const storedCategories = (storedSettings as StoredCategoryRules)[storageKey]

  if (!Array.isArray(storedCategories)) {
    return createDefaultCategoryRules()
  }

  return normalizeCategoryRules(storedCategories)
}

export async function saveCategoryRules(
  categories: TabCategoryRule[],
): Promise<void> {
  await chrome.storage.sync.set({
    [storageKey]: normalizeCategoryRules(categories),
  })
}

export async function resetCategoryRules(): Promise<TabCategoryRule[]> {
  const defaultCategories = createDefaultCategoryRules()
  await saveCategoryRules(defaultCategories)
  return defaultCategories
}

export async function loadAutoOrganizeEnabled(): Promise<boolean> {
  const storedSettings = await chrome.storage.sync.get(autoOrganizeStorageKey)
  const storedValue = (storedSettings as StoredAutoOrganizeSetting)[
    autoOrganizeStorageKey
  ]

  return storedValue === true
}

export async function saveAutoOrganizeEnabled(
  isEnabled: boolean,
): Promise<void> {
  await chrome.storage.sync.set({
    [autoOrganizeStorageKey]: isEnabled,
  })
}

export async function loadAutoOrganizeThreshold(): Promise<number> {
  const storedSettings = await chrome.storage.sync.get(
    autoOrganizeThresholdStorageKey,
  )
  const storedValue = (storedSettings as StoredAutoOrganizeSetting)[
    autoOrganizeThresholdStorageKey
  ]

  return normalizeThreshold(storedValue)
}

export async function saveAutoOrganizeThreshold(
  threshold: number,
): Promise<void> {
  await chrome.storage.sync.set({
    [autoOrganizeThresholdStorageKey]: normalizeThreshold(threshold),
  })
}

function normalizeCategoryRules(categories: TabCategoryRule[]): TabCategoryRule[] {
  const defaultCategories = createDefaultCategoryRules()
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  const normalizedDefaultCategories = defaultCategories.map((defaultCategory) => {
    const savedCategory = categoriesById.get(defaultCategory.id)

    if (!savedCategory) {
      return defaultCategory
    }

    return {
      ...defaultCategory,
      name: savedCategory.name.trim() || defaultCategory.name,
      color: normalizeColor(savedCategory.color, defaultCategory.color),
      includedCategoryIds: [],
      patterns:
        defaultCategory.id === fallbackCategoryId
          ? []
          : mergePatterns(defaultCategory.patterns, savedCategory.patterns),
    }
  })

  const defaultCategoryIds = new Set(
    defaultCategories.map((category) => category.id),
  )
  const customCategories = categories
    .filter((category) => !defaultCategoryIds.has(category.id))
    .map(normalizeCustomCategory)
    .filter((category): category is TabCategoryRule => category !== undefined)

  return [...normalizedDefaultCategories, ...customCategories]
}

function normalizeCustomCategory(
  category: TabCategoryRule,
): TabCategoryRule | undefined {
  const name = category.name.trim()
  const patterns = normalizePatterns(category.patterns)
  const includedCategoryIds = normalizeIncludedCategoryIds(
    category.includedCategoryIds,
  )

  if (name.length === 0 || (patterns.length === 0 && includedCategoryIds.length === 0)) {
    return undefined
  }

  return {
    id: category.id,
    name,
    color: normalizeColor(category.color, 'grey'),
    patterns,
    includedCategoryIds,
  }
}

function normalizeIncludedCategoryIds(
  categoryIds: TabCategoryRule['includedCategoryIds'],
): TabCategoryRule['id'][] {
  if (!Array.isArray(categoryIds)) {
    return []
  }

  return categoryIds.filter((categoryId, index, allCategoryIds) => {
    if (
      categoryId === fallbackCategoryId ||
      categoryId.startsWith('custom-')
    ) {
      return false
    }

    return allCategoryIds.indexOf(categoryId) === index
  })
}

function normalizeColor(
  color: TabGroupColor,
  fallbackColor: TabGroupColor,
): TabGroupColor {
  return tabGroupColors.includes(color) ? color : fallbackColor
}

function normalizePatterns(patterns: string[]): string[] {
  if (!Array.isArray(patterns)) {
    return []
  }

  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern, index, allPatterns) => {
      if (pattern.length === 0) {
        return false
      }

      const normalizedPattern = pattern.toLowerCase()
      return (
        allPatterns.findIndex(
          (currentPattern) =>
            currentPattern.trim().toLowerCase() === normalizedPattern,
        ) === index
      )
    })
}

function mergePatterns(defaultPatterns: string[], savedPatterns: string[]) {
  return normalizePatterns([...defaultPatterns, ...savedPatterns])
}

function normalizeThreshold(threshold: unknown) {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
    return defaultAutoOrganizeThreshold
  }

  return Math.max(1, Math.round(threshold))
}
