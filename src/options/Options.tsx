import { useEffect, useState } from 'react'
import { extensionName } from '../lib/extension'
import {
  fallbackCategoryId,
  tabGroupColors,
  type TabCategoryId,
  type TabCategoryRule,
  type TabGroupColor,
} from '../lib/categories'
import {
  loadCategoryRules,
  resetCategoryRules,
  saveCategoryRules,
} from '../lib/settings'
import { organizeCurrentWindowTabs } from '../lib/organizeTabs'

type SaveStatus = {
  tone: 'idle' | 'success' | 'error'
  message: string
}

export function Options() {
  const [categories, setCategories] = useState<TabCategoryRule[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [quickPattern, setQuickPattern] = useState('')
  const [customGroupName, setCustomGroupName] = useState('')
  const [customGroupColor, setCustomGroupColor] = useState<TabGroupColor>('grey')
  const [customGroupPatterns, setCustomGroupPatterns] = useState([''])
  const [includedCategoryIds, setIncludedCategoryIds] = useState<
    TabCategoryId[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<SaveStatus>({
    tone: 'idle',
    message: 'Changes are saved to Chrome sync storage.',
  })

  useEffect(() => {
    loadCategoryRules()
      .then((loadedCategories) => {
        setCategories(loadedCategories)
        setSelectedCategoryId(getFirstEditableCategoryId(loadedCategories))
        setStatus({
          tone: 'idle',
          message: 'Changes are saved to Chrome sync storage.',
        })
      })
      .catch((error: unknown) => {
        setStatus({
          tone: 'error',
          message:
            error instanceof Error ? error.message : 'Unable to load settings.',
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  async function handleSave() {
    const validationError = validateCustomGroups(categories)

    if (validationError) {
      setStatus({
        tone: 'error',
        message: validationError,
      })
      return
    }

    setIsSaving(true)

    try {
      await saveCategoryRules(categories)
      const savedCategories = await loadCategoryRules()
      setCategories(savedCategories)
      await applySettingsToCurrentWindow()
      setStatus({
        tone: 'success',
        message: 'Settings saved and applied to the current window.',
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save settings.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    const shouldReset = window.confirm(
      'Reset category names, colors, and patterns to the TabFlow defaults?',
    )

    if (!shouldReset) {
      return
    }

    setIsSaving(true)

    try {
      const defaultCategories = await resetCategoryRules()
      setCategories(defaultCategories)
      setSelectedCategoryId(getFirstEditableCategoryId(defaultCategories))
      await applySettingsToCurrentWindow()
      setStatus({
        tone: 'success',
        message: 'Default rules restored and applied to the current window.',
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to reset settings.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleQuickAddRulePair() {
    const pattern = quickPattern.trim()
    const selectedCategory = categories.find(
      (category) => category.id === selectedCategoryId,
    )

    if (!selectedCategory || selectedCategory.id === fallbackCategoryId) {
      setStatus({
        tone: 'error',
        message: 'Choose a category before adding a pattern.',
      })
      return
    }

    if (pattern.length === 0) {
      setStatus({
        tone: 'error',
        message: 'Enter a pattern before adding it.',
      })
      return
    }

    const hasDuplicatePattern = selectedCategory.patterns.some(
      (currentPattern) =>
        currentPattern.trim().toLowerCase() === pattern.toLowerCase(),
    )

    if (hasDuplicatePattern) {
      setStatus({
        tone: 'error',
        message: `${pattern} already exists in ${selectedCategory.name}.`,
      })
      return
    }

    const updatedCategories = categories.map((category) =>
      category.id === selectedCategory.id
        ? {
            ...category,
            patterns: [...category.patterns, pattern],
          }
        : category,
    )

    setIsSaving(true)

    try {
      await saveCategoryRules(updatedCategories)
      const savedCategories = await loadCategoryRules()
      setCategories(savedCategories)
      setQuickPattern('')
      await applySettingsToCurrentWindow()
      setStatus({
        tone: 'success',
        message: `Added ${pattern} to ${selectedCategory.name} and applied changes.`,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to add pattern.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateCustomGroup() {
    const groupName = customGroupName.trim()
    const patterns = normalizePatternInputs(customGroupPatterns)

    if (groupName.length === 0) {
      setStatus({
        tone: 'error',
        message: 'Enter a custom group name before saving.',
      })
      return
    }

    const hasDuplicateGroupName = categories.some(
      (category) => category.name.trim().toLowerCase() === groupName.toLowerCase(),
    )

    if (hasDuplicateGroupName) {
      setStatus({
        tone: 'error',
        message: `${groupName} already exists. Choose a different group name.`,
      })
      return
    }

    if (patterns.length === 0 && includedCategoryIds.length === 0) {
      setStatus({
        tone: 'error',
        message:
          'Add at least one pattern or included category before saving a custom group.',
      })
      return
    }

    const customCategory: TabCategoryRule = {
      id: createCustomCategoryId(),
      name: groupName,
      color: customGroupColor,
      patterns,
      includedCategoryIds,
    }
    const updatedCategories = [...categories, customCategory]

    setIsSaving(true)

    try {
      await saveCategoryRules(updatedCategories)
      const savedCategories = await loadCategoryRules()
      setCategories(savedCategories)
      setSelectedCategoryId(customCategory.id)
      setCustomGroupName('')
      setCustomGroupColor('grey')
      setCustomGroupPatterns([''])
      setIncludedCategoryIds([])
      await applySettingsToCurrentWindow()
      setStatus({
        tone: 'success',
        message: `Created ${groupName} and applied changes to the current window.`,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to create custom group.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function updateCategoryName(categoryId: string, name: string) {
    updateCategory(categoryId, { name })
  }

  function updateCategoryColor(categoryId: string, color: TabGroupColor) {
    updateCategory(categoryId, { color })
  }

  function updatePattern(
    categoryId: string,
    patternIndex: number,
    pattern: string,
  ) {
    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== categoryId) {
          return category
        }

        return {
          ...category,
          patterns: category.patterns.map((currentPattern, currentIndex) =>
            currentIndex === patternIndex ? pattern : currentPattern,
          ),
        }
      }),
    )
  }

  function addPattern(categoryId: string) {
    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== categoryId || category.id === fallbackCategoryId) {
          return category
        }

        return {
          ...category,
          patterns: [...category.patterns, ''],
        }
      }),
    )
  }

  function addCustomGroupPatternInput() {
    setCustomGroupPatterns((currentPatterns) => [...currentPatterns, ''])
  }

  function updateCustomGroupPattern(patternIndex: number, pattern: string) {
    setCustomGroupPatterns((currentPatterns) =>
      currentPatterns.map((currentPattern, currentIndex) =>
        currentIndex === patternIndex ? pattern : currentPattern,
      ),
    )
  }

  function removeCustomGroupPatternInput(patternIndex: number) {
    setCustomGroupPatterns((currentPatterns) => {
      const remainingPatterns = currentPatterns.filter(
        (_pattern, currentIndex) => currentIndex !== patternIndex,
      )

      return remainingPatterns.length === 0 ? [''] : remainingPatterns
    })
  }

  function removePattern(categoryId: string, patternIndex: number) {
    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== categoryId) {
          return category
        }

        return {
          ...category,
          patterns: category.patterns.filter(
            (_pattern, currentIndex) => currentIndex !== patternIndex,
          ),
        }
      }),
    )
  }

  function toggleCategoryIncludedCategory(
    customCategoryId: string,
    includedCategoryId: TabCategoryId,
  ) {
    setCategories((currentCategories) =>
      currentCategories.map((category) => {
        if (category.id !== customCategoryId) {
          return category
        }

        const currentIncludedCategoryIds = category.includedCategoryIds ?? []
        const includedCategoryIds = currentIncludedCategoryIds.includes(
          includedCategoryId,
        )
          ? currentIncludedCategoryIds.filter(
              (categoryId) => categoryId !== includedCategoryId,
            )
          : [...currentIncludedCategoryIds, includedCategoryId]

        return {
          ...category,
          includedCategoryIds,
        }
      }),
    )
  }

  function deleteCustomGroup(categoryId: string) {
    const category = categories.find(
      (currentCategory) => currentCategory.id === categoryId,
    )

    if (!category || !category.id.startsWith('custom-')) {
      return
    }

    const shouldDelete = window.confirm(`Delete custom group ${category.name}?`)

    if (!shouldDelete) {
      return
    }

    setCategories((currentCategories) =>
      currentCategories.filter(
        (currentCategory) => currentCategory.id !== categoryId,
      ),
    )
    setStatus({
      tone: 'idle',
      message: 'Custom group removed. Save settings to persist this change.',
    })
  }

  function updateCategory(
    categoryId: string,
    updates: Partial<Pick<TabCategoryRule, 'name' | 'color'>>,
  ) {
    setCategories((currentCategories) =>
      currentCategories.map((category) =>
        category.id === categoryId ? { ...category, ...updates } : category,
      ),
    )
  }

  async function handleApplyChangesNow() {
    setIsSaving(true)

    try {
      await saveCategoryRules(categories)
      const savedCategories = await loadCategoryRules()
      setCategories(savedCategories)
      const result = await organizeCurrentWindowTabs()
      setStatus({
        tone: result.ok ? 'success' : 'error',
        message: result.ok
          ? `Applied settings. ${result.message}`
          : result.message,
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? `Unable to apply changes: ${error.message}`
            : 'Unable to apply changes.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  function toggleIncludedCategory(categoryId: TabCategoryId) {
    setIncludedCategoryIds((currentCategoryIds) =>
      currentCategoryIds.includes(categoryId)
        ? currentCategoryIds.filter((currentCategoryId) => currentCategoryId !== categoryId)
        : [...currentCategoryIds, categoryId],
    )
  }

  const statusClassName =
    status.tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : status.tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-slate-200 bg-white text-slate-600'

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Options
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {extensionName} Settings
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Edit the rule-based categories used when TabFlow organizes the
            current Chrome window.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Patterns are simple text matches. TabFlow checks each tab URL and
            title, ignores case, and places unmatched tabs in Other.
          </p>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving || isLoading}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleApplyChangesNow}
              disabled={isSaving || isLoading}
              className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Apply changes now
            </button>
          </div>
          <p className={`rounded-md border px-3 py-2 text-sm ${statusClassName}`}>
            {status.message}
          </p>
        </section>

        {isLoading ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
            Loading settings...
          </p>
        ) : (
          <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-slate-950">
                Quick add rule pair
              </h2>
              <p className="text-sm leading-6 text-slate-500">
                Pick a category and add one pattern. A pattern can be a domain,
                keyword, or Japanese text in the tab title. Examples:
                github.com, chatgpt.com, 学修, portfolio.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Category
                <select
                  value={selectedCategoryId}
                  onChange={(event) =>
                    setSelectedCategoryId(event.target.value)
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-600"
                >
                  {categories
                    .filter((category) => category.id !== fallbackCategoryId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Pattern
                <input
                  type="text"
                  value={quickPattern}
                  onChange={(event) => setQuickPattern(event.target.value)}
                  placeholder="github.com"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-600"
                />
              </label>

              <button
                type="button"
                onClick={handleQuickAddRulePair}
                disabled={isSaving}
                className="self-end rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Add
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-slate-950">
                Create custom group
              </h2>
              <p className="text-sm leading-6 text-slate-500">
                Create a new tab group label with its own color and matching
                patterns. The display name becomes the Chrome tab group title.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Group display name
                <input
                  type="text"
                  value={customGroupName}
                  onChange={(event) => setCustomGroupName(event.target.value)}
                  placeholder="AI x Git"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-600"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Group color
                <select
                  value={customGroupColor}
                  onChange={(event) =>
                    setCustomGroupColor(event.target.value as TabGroupColor)
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize text-slate-950 outline-none focus:border-sky-600"
                >
                  {tabGroupColors.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Included categories
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Select existing categories to merge into this custom group.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getIncludeableCategories(categories).map((category) => (
                    <label
                      key={category.id}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={includedCategoryIds.includes(category.id)}
                        onChange={() => toggleIncludedCategory(category.id)}
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Patterns
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add one or more domains, keywords, or Japanese title text.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCustomGroupPatternInput}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Add pattern
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {customGroupPatterns.map((pattern, patternIndex) => (
                  <div
                    key={`custom-group-pattern-${patternIndex}`}
                    className="grid gap-2 sm:grid-cols-[1fr_auto]"
                  >
                    <input
                      type="text"
                      value={pattern}
                      onChange={(event) =>
                        updateCustomGroupPattern(patternIndex, event.target.value)
                      }
                      placeholder="figma.com"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomGroupPatternInput(patternIndex)}
                      className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateCustomGroup}
              disabled={isSaving}
              className="mt-4 rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Create group
            </button>
          </section>

          <section className="grid gap-4">
            {categories.map((category) => {
              const isFallback = category.id === fallbackCategoryId
              const isCustom = category.id.startsWith('custom-')

              return (
                <article
                  key={category.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        {category.name || 'Untitled category'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {isFallback
                          ? 'Fallback group for tabs without a match.'
                          : `${category.patterns.length} manual pattern${category.patterns.length === 1 ? '' : 's'}${
                              isCustom
                                ? `, ${category.includedCategoryIds?.length ?? 0} included categor${
                                    (category.includedCategoryIds?.length ?? 0) === 1
                                      ? 'y'
                                      : 'ies'
                                  }`
                                : ''
                            }`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium capitalize text-slate-700">
                        {category.color}
                      </span>
                      {isCustom ? (
                        <button
                          type="button"
                          onClick={() => deleteCustomGroup(category.id)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Category name
                      <span className="text-xs font-normal text-slate-500">
                        This becomes the Chrome tab group title.
                      </span>
                      <input
                        type="text"
                        value={category.name}
                        onChange={(event) =>
                          updateCategoryName(category.id, event.target.value)
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-950 outline-none focus:border-sky-600"
                      />
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                      Group color
                      <span className="text-xs font-normal text-slate-500">
                        Uses Chrome tab group colors.
                      </span>
                      <select
                        value={category.color}
                        onChange={(event) =>
                          updateCategoryColor(
                            category.id,
                            event.target.value as TabGroupColor,
                          )
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-base capitalize text-slate-950 outline-none focus:border-sky-600"
                      >
                        {tabGroupColors.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5">
                    {isCustom ? (
                      <div className="mb-5">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Included categories
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Included category patterns also match this custom
                          group.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getIncludeableCategories(categories).map(
                            (includedCategory) => (
                              <label
                                key={includedCategory.id}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={(
                                    category.includedCategoryIds ?? []
                                  ).includes(includedCategory.id)}
                                  onChange={() =>
                                    toggleCategoryIncludedCategory(
                                      category.id,
                                      includedCategory.id,
                                    )
                                  }
                                />
                                {includedCategory.name}
                              </label>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Patterns
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Add words or domains to match against tab titles and
                          URLs.
                        </p>
                      </div>
                      {!isFallback && (
                        <button
                          type="button"
                          onClick={() => addPattern(category.id)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Add pattern
                        </button>
                      )}
                    </div>

                    {isFallback ? (
                      <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Other is the fallback category for tabs that do not
                        match any pattern.
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {category.patterns.length === 0 ? (
                          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                            No patterns yet. Add one to start matching tabs for
                            this category.
                          </p>
                        ) : null}

                        {category.patterns.map((pattern, patternIndex) => (
                          <div
                            key={`${category.id}-${patternIndex}`}
                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                          >
                            <input
                              type="text"
                              value={pattern}
                              onChange={(event) =>
                                updatePattern(
                                  category.id,
                                  patternIndex,
                                  event.target.value,
                                )
                              }
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none focus:border-sky-600"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                removePattern(category.id, patternIndex)
                              }
                              className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
          </>
        )}
      </div>
    </main>
  )
}

function getFirstEditableCategoryId(categories: TabCategoryRule[]) {
  return (
    categories.find((category) => category.id !== fallbackCategoryId)?.id ?? ''
  )
}

function getIncludeableCategories(categories: TabCategoryRule[]) {
  return categories.filter(
    (category) =>
      category.id !== fallbackCategoryId && !category.id.startsWith('custom-'),
  )
}

async function applySettingsToCurrentWindow() {
  await organizeCurrentWindowTabs()
}

function normalizePatternInputs(patterns: string[]) {
  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern, index, allPatterns) => {
      if (pattern.length === 0) {
        return false
      }

      return (
        allPatterns.findIndex(
          (currentPattern) =>
            currentPattern.trim().toLowerCase() === pattern.toLowerCase(),
        ) === index
      )
    })
}

function createCustomCategoryId(): TabCategoryId {
  if (crypto.randomUUID) {
    return `custom-${crypto.randomUUID()}`
  }

  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function validateCustomGroups(categories: TabCategoryRule[]) {
  const seenNames = new Set<string>()

  for (const category of categories) {
    const normalizedName = category.name.trim().toLowerCase()

    if (category.id !== fallbackCategoryId && normalizedName.length === 0) {
      return 'Category names cannot be empty.'
    }

    if (seenNames.has(normalizedName)) {
      return `${category.name} is already used. Category names must be unique.`
    }

    seenNames.add(normalizedName)

    if (!category.id.startsWith('custom-')) {
      continue
    }

    const hasManualPatterns = category.patterns.some(
      (pattern) => pattern.trim().length > 0,
    )
    const hasIncludedCategories =
      (category.includedCategoryIds ?? []).length > 0

    if (!hasManualPatterns && !hasIncludedCategories) {
      return `${category.name} needs at least one manual pattern or included category.`
    }
  }

  return undefined
}
