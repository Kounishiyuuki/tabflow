# TabFlow

TabFlow is a Chrome Extension for organizing busy browser sessions into
customizable Chrome Tab Groups. It combines rule-based tab classification,
manual organizing, editable categories, custom groups, and threshold-based
auto-organize behavior.

## 日本語 Overview

TabFlow は、開きすぎた Chrome タブを自動で見やすく整理する Chrome 拡張です。
AI、Git、開発、デザイン、学校、SNS などのルールに合わせて、タブを Chrome の
タブグループにまとめます。

手動でまとめることも、自動整理を ON にして条件を満たしたときだけまとめること
もできます。カテゴリやキーワードは自分で編集できるので、自分の作業スタイルに
合わせて育てていけます。

## できること

- **Organize now** で、今開いているタブをすぐに整理できます。
- `AI`、`Git`、`Dev`、`Infra`、`Design`、`School`、`Portfolio`、`SNS` などの
  カテゴリでタブを分類できます。
- 自分だけの **Custom group** を作れます。
- 既存カテゴリを組み合わせたグループを作れます。
- `github.com` や `chatgpt.com`、`学修` のような **Manual patterns** を追加
  できます。
- グループごとに Chrome タブグループの色を選べます。
- **Auto organize** を ON にすると、同じグループに一致するタブ数が
  **Threshold** に達したときだけ自動で整理します。

## 使い方

1. Chrome に TabFlow を読み込みます。
2. ツールバーの TabFlow アイコンをクリックします。
3. すぐ整理したいときは **Organize now** を押します。
4. ルールを編集したいときは **Edit categories** を押します。
5. Options 画面でカテゴリ、色、パターン、カスタムグループを編集します。
6. 変更を今開いているタブへ反映したいときは **Apply changes now** を押します。

### Organize now

`Organize now` は、現在のウィンドウにあるピン留めされていないタブをすぐに分類
してグループ化します。Auto organize が OFF でも動きます。

### Custom group

`Custom group` は、自分で名前をつけられるタブグループです。たとえば
`AI x Git`、`School Work`、`Portfolio Build` のようなグループを作れます。
表示名はそのまま Chrome のタブグループ名になります。

### Included categories

`Included categories` は、既存カテゴリをまとめて使う仕組みです。たとえば
`AI x Git` という Custom group に `AI` と `Git` を含めると、AI 系サイトと
Git 系サイトが同じグループに入ります。

### Manual patterns

`Manual patterns` は、URL やタブタイトルに含まれる文字で分類するルールです。
例: `github.com`、`chatgpt.com`、`figma.com`、`学修`、`portfolio`

### Auto organize と Threshold

`Auto organize` を ON にすると、タブを開いたり更新したりしたタイミングで自動
整理します。

`Threshold` は「同じグループに一致するタブが何個以上になったら自動でまとめる
か」という数です。全体のタブ数ではなく、同じカテゴリに一致したタブ数で判断し
ます。

例: Threshold が `3` の場合、YouTube タブが 3 個になると `SNS` グループが自動で
作られます。2 個だけならまだ自動ではまとめません。

## 日本語 Examples

### AI x Git グループ

1. Options 画面で **Create custom group** を開きます。
2. Group display name に `AI x Git` と入力します。
3. Included categories で `AI` と `Git` を選びます。
4. 保存します。

結果:

- ChatGPT
- Claude
- Codex
- GitHub
- GitHub Docs

これらのタブが `AI x Git` にまとまります。

### YouTube を SNS に自動整理

1. Popup で **Auto organize** を ON にします。
2. Threshold を `3` にします。
3. `youtube.com` のタブを 3 個開きます。

結果:

3 個の YouTube タブが自動で `SNS` グループにまとまります。

## ローカルで動かす手順

```bash
npm install
npm run build
```

開発中は、コードを変更したあとに `npm run build` を実行してください。

## Chromeに読み込む手順

1. Chrome で `chrome://extensions/` を開きます。
2. 右上の **Developer mode** を ON にします。
3. **Load unpacked** をクリックします。
4. このプロジェクトの `dist` フォルダを選びます。
5. ビルドし直したあとは、拡張機能一覧で TabFlow を Reload します。

## Motivation

Modern development work often spreads across AI tools, Git hosting, local
servers, design tools, school portals, documentation, and deployment services.
TabFlow keeps those contexts readable by grouping related tabs under clear,
user-defined labels.

## Features

- Manual **Organize now** action from the extension popup.
- Editable default categories such as `AI`, `Git`, `Dev`, `Infra`, `Design`,
  `School`, `Portfolio`, `SNS`, and `Other`.
- Custom group creation with stable internal IDs and editable display names.
- Combined custom groups, for example `AI x Git`, by including existing
  categories.
- Manual pattern rules using domains, keywords, or Japanese text.
- Quick add rule pair flow for adding one pattern to an existing category.
- Chrome Tab Group color customization.
- Threshold-based auto-organize by category count.
- Settings stored with `chrome.storage.sync`.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Chrome Extension Manifest V3
- Chrome Tabs and Tab Groups APIs

## Local Installation

```bash
npm install
npm run build
```

## Load in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist` folder.
5. After each new build, return to `chrome://extensions/` and reload TabFlow.

The popup is available from the extension toolbar icon. The options page is
available from the popup or from the extension details page.

## Usage

### Manual Organize Now

Click **Organize now** in the popup to classify all non-pinned tabs in the
current window. Manual organizing runs immediately and groups all matched tabs,
including the `Other` fallback group.

### Custom Groups

Open **Edit categories** from the popup to manage rules.

Use **Create custom group** to define a new group with:

- A display name used as the Chrome tab group title.
- A Chrome-supported group color.
- Manual patterns such as `github.com`, `chatgpt.com`, `学修`, or `portfolio`.
- Included categories, such as combining `AI` and `Git` into `AI x Git`.

Custom groups take priority over default categories, while `Other` remains the
protected fallback.

### Auto Organize

Auto organize can be enabled from the popup. The threshold means the minimum
number of tabs matching the same group before TabFlow auto-groups that group.

Example: with threshold `3`, opening three `youtube.com` tabs creates an `SNS`
group automatically. Categories below the threshold are left alone. Pinned tabs
are ignored, and `Other` is not auto-grouped automatically.

## Development Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Future Improvements

- Import and export category presets.
- Optional per-window or per-profile rule sets.
- Better duplicate group cleanup and group reuse controls.
- Keyboard shortcuts for manual organizing.
- Optional AI-assisted rule suggestions.
