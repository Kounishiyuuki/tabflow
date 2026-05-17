export type BuiltInTabCategoryId =
  | 'git'
  | 'ai'
  | 'dev'
  | 'infra'
  | 'school'
  | 'sns'
  | 'design'
  | 'portfolio'
  | 'other'

export type TabCategoryId = BuiltInTabCategoryId | `custom-${string}`

export type TabGroupColor = `${chrome.tabGroups.Color}`

export type TabCategoryRule = {
  id: TabCategoryId
  name: string
  color: TabGroupColor
  patterns: string[]
  includedCategoryIds?: TabCategoryId[]
}

export type TabCategoryMatch = {
  name: string
  color: TabGroupColor
  matchedPattern?: string
  reason?: string
}

export const fallbackCategoryId: BuiltInTabCategoryId = 'other'

export const tabGroupColors: TabGroupColor[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]

export const defaultCategoryRules: TabCategoryRule[] = [
  {
    id: 'git',
    name: 'Git',
    color: 'blue',
    patterns: [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'gist.github.com',
      'raw.githubusercontent.com',
      'docs.github.com',
    ],
  },
  {
    id: 'ai',
    name: 'AI',
    color: 'purple',
    patterns: [
      'chatgpt.com',
      'claude.ai',
      'gemini.google.com',
      'openai.com',
      'platform.openai.com',
      'perplexity.ai',
      'codex',
    ],
  },
  {
    id: 'dev',
    name: 'Dev',
    color: 'cyan',
    patterns: [
      'localhost',
      'npmjs.com',
      'developer.mozilla.org',
      'developer.chrome.com',
      'stackoverflow.com',
    ],
  },
  {
    id: 'infra',
    name: 'Infra',
    color: 'orange',
    patterns: [
      'vercel.com',
      'vercel.app',
      'supabase.com',
      'firebase.google.com',
      'cloudflare.com',
      'aws.amazon.com',
    ],
  },
  {
    id: 'school',
    name: 'School',
    color: 'green',
    patterns: [
      'classroom.google.com',
      'drive.google.com',
      'portal',
      'lms',
      '学生',
      '学修',
      '授業',
    ],
  },
  {
    id: 'sns',
    name: 'SNS',
    color: 'red',
    patterns: ['youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'instagram.com'],
  },
  {
    id: 'design',
    name: 'Design',
    color: 'pink',
    patterns: ['figma.com', 'stitch', 'canva.com', 'recraft.ai'],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    color: 'yellow',
    patterns: ['portfolio', 'github.io', 'kounishiyuuki', 'personal-site'],
  },
  {
    id: fallbackCategoryId,
    name: 'Other',
    color: 'grey',
    patterns: [],
  },
]

export function classifyTab(
  tab: Pick<chrome.tabs.Tab, 'title' | 'url'>,
  categories: TabCategoryRule[],
): TabCategoryMatch {
  const searchableText = `${tab.url ?? ''} ${tab.title ?? ''}`.toLowerCase()
  const fallbackCategory = getFallbackCategory(categories)
  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const categoriesByPriority = [
    ...categories.filter(isCustomCategory),
    ...categories.filter(
      (category) =>
        category.id !== fallbackCategoryId && !isCustomCategory(category),
    ),
  ]
  const matchedCategory = categoriesByPriority
    .map((category) => {
      const patterns = getCategoryPatterns(category, categoriesById)
      const matchedPattern = patterns.find((pattern) =>
        searchableText.includes(pattern.toLowerCase()),
      )

      return {
        category,
        matchedPattern,
      }
    })
    .find((match) => match.matchedPattern !== undefined)

  if (!matchedCategory) {
    return {
      ...fallbackCategory,
      reason: 'No category pattern matched the tab URL or title.',
    }
  }

  return {
    name: matchedCategory.category.name,
    color: matchedCategory.category.color,
    matchedPattern: matchedCategory.matchedPattern,
    reason: `Matched pattern "${matchedCategory.matchedPattern}".`,
  }
}

export function getFallbackCategory(
  categories: TabCategoryRule[],
): TabCategoryMatch {
  const fallbackCategory =
    categories.find((category) => category.id === fallbackCategoryId) ??
    defaultCategoryRules.find((category) => category.id === fallbackCategoryId)

  return {
    name: fallbackCategory?.name ?? 'Other',
    color: fallbackCategory?.color ?? 'grey',
  }
}

export function createDefaultCategoryRules(): TabCategoryRule[] {
  return defaultCategoryRules.map((category) => ({
    ...category,
    patterns: [...category.patterns],
  }))
}

function isCustomCategory(category: TabCategoryRule) {
  return category.id.startsWith('custom-')
}

function getCategoryPatterns(
  category: TabCategoryRule,
  categoriesById: Map<TabCategoryId, TabCategoryRule>,
) {
  const includedPatterns =
    category.includedCategoryIds?.flatMap(
      (categoryId) => categoriesById.get(categoryId)?.patterns ?? [],
    ) ?? []

  return [...category.patterns, ...includedPatterns]
}
