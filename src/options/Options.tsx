import { extensionName } from '../lib/extension'

export function Options() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
          Options
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          {extensionName} Settings
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          This page is ready for extension settings. Tab grouping preferences
          will be added later.
        </p>
      </section>
    </main>
  )
}
