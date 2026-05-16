export type TabCategoryName = 'Dev' | 'AI' | 'School' | 'SNS' | 'Other'

export type TabGroupColor = `${chrome.tabGroups.Color}`

export type TabCategoryRule = {
  category: Exclude<TabCategoryName, 'Other'>
  color: TabGroupColor
  matches: string[]
}

export type TabCategory = {
  name: TabCategoryName
  color: TabGroupColor
}

export const fallbackCategory: TabCategory = {
  name: 'Other',
  color: 'grey',
}

export const defaultCategoryRules: TabCategoryRule[] = [
  {
    category: 'Dev',
    color: 'blue',
    matches: ['github.com', 'localhost', 'vercel.app', 'supabase.com'],
  },
  {
    category: 'AI',
    color: 'purple',
    matches: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'openai.com'],
  },
  {
    category: 'School',
    color: 'green',
    matches: ['classroom.google.com', 'drive.google.com'],
  },
  {
    category: 'SNS',
    color: 'red',
    matches: ['youtube.com', 'x.com', 'instagram.com'],
  },
]

export function classifyTab(tab: Pick<chrome.tabs.Tab, 'title' | 'url'>): TabCategory {
  const searchableText = `${tab.url ?? ''} ${tab.title ?? ''}`.toLowerCase()
  const matchedRule = defaultCategoryRules.find((rule) =>
    rule.matches.some((match) => searchableText.includes(match)),
  )

  if (!matchedRule) {
    return fallbackCategory
  }

  return {
    name: matchedRule.category,
    color: matchedRule.color,
  }
}
