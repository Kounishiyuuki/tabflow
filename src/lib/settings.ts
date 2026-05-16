import {
  createDefaultCategoryRules,
  fallbackCategoryId,
  tabGroupColors,
  type TabCategoryRule,
  type TabGroupColor,
} from './categories'

const storageKey = 'tabflowCategoryRules'

type StoredCategoryRules = {
  [storageKey]?: TabCategoryRule[]
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

function normalizeCategoryRules(categories: TabCategoryRule[]): TabCategoryRule[] {
  const defaultCategories = createDefaultCategoryRules()
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )

  return defaultCategories.map((defaultCategory) => {
    const savedCategory = categoriesById.get(defaultCategory.id)

    if (!savedCategory) {
      return defaultCategory
    }

    return {
      ...defaultCategory,
      name: savedCategory.name.trim() || defaultCategory.name,
      color: normalizeColor(savedCategory.color, defaultCategory.color),
      patterns:
        defaultCategory.id === fallbackCategoryId
          ? []
          : normalizePatterns(savedCategory.patterns),
    }
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
