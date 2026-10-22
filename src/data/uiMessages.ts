export const UI_LANGUAGES = ["zh-CN", "ja", "en"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];
export const UI_LANGUAGE_KEY = "gallery-ui-language";

// Interface copy only. Photo metadata, place names and authored text never enter this catalog.
export const uiMessages = {
  "nav.home": ["主页", "ホーム", "Home"],
  "nav.film": ["胶片", "フィルム", "Film"],
  "nav.map": ["地图", "地図", "Map"],
  language: ["界面语言", "表示言語", "Interface language"],
  rights: ["保留所有权利。", "無断転載を禁じます。", "All rights reserved."],
  close: ["关闭", "閉じる", "Close"],
  "menu.open": ["打开菜单", "メニューを開く", "Open menu"],
  "menu.close": ["关闭菜单", "メニューを閉じる", "Close menu"],
  "contact.instagram": [
    "在 Instagram 查看 inochiwa_39",
    "Instagram で inochiwa_39 を見る",
    "View inochiwa_39 on Instagram",
  ],
  "contact.github": [
    "在 GitHub 查看项目源码",
    "GitHub でソースコードを見る",
    "View source on GitHub",
  ],
  "contact.email": [
    "发送邮件到 {email}",
    "{email} にメールを送る",
    "Email {email}",
  ],
  retry: ["重试", "再試行", "Retry"],
  back: ["返回", "戻る", "Back"],
  loading: ["加载中", "読み込み中", "Loading"],
  "photo.loading": ["正在加载照片", "写真を読み込み中", "Loading photo"],
  "photo.error": [
    "照片暂时无法加载。",
    "写真を読み込めませんでした。",
    "Unable to load photos right now.",
  ],
  "photo.notFound": [
    "没有找到这张照片。",
    "写真が見つかりません。",
    "Photo not found.",
  ],
  "photo.fallback": ["照片", "写真", "Photo"],
  "photo.open": [
    "打开照片：{title}",
    "写真を開く：{title}",
    "Open photo: {title}",
  ],
  "film.open": [
    "打开胶片照片 {id}",
    "フィルム写真 {id} を開く",
    "Open film photo {id}",
  ],
  "film.error": [
    "胶片暂时无法加载",
    "フィルムを読み込めませんでした",
    "Unable to load film right now",
  ],
  "film.empty": [
    "暂无胶片照片",
    "フィルム写真はまだありません",
    "No film photos yet",
  ],
  "map.error": [
    "照片地图暂时无法加载。",
    "写真マップを読み込めませんでした。",
    "Unable to load the photo map right now.",
  ],
  "map.view": ["地图显示方式", "地図の表示方法", "Map view"],
  "map.regions": ["地区", "地域", "Regions"],
  "map.photos": ["照片", "写真", "Photos"],
  "map.countries": ["国家 / 地区", "国・地域", "Country / region"],
  "map.select_country": [
    "请选择一个国家或地区",
    "国・地域を選択",
    "Select a country or region",
  ],
  "map.back": ["返回地图", "地図に戻る", "Back to map"],
  "map.city": ["城市", "都市", "City"],
  "map.canvas": ["交互式地图", "インタラクティブ地図", "Interactive map"],
  "map.north": ["恢复正北方向", "北向きに戻す", "Reset bearing to north"],
  "map.attribution": [
    "切换地图来源信息",
    "地図の出典情報を切り替え",
    "Toggle attribution",
  ],
  "map.external": [
    "在 Google 地图中打开",
    "Google マップで開く",
    "Open in Google Maps",
  ],
  "map.allAreas": [
    "{region} · 全部区域",
    "{region} · すべての地域",
    "{region} · All areas",
  ],
  "blog.error": [
    "暂时无法读取後書き。",
    "後書きを読み込めませんでした。",
    "Unable to load 後書き right now.",
  ],
  "blog.empty": [
    "还没有公开的文章。",
    "公開された記事はまだありません。",
    "No published posts yet.",
  ],
  "blog.notFound": [
    "没有找到这篇文章",
    "記事が見つかりません",
    "Post not found",
  ],
  "blog.postError": [
    "文章暂时无法读取。",
    "記事を読み込めませんでした。",
    "Unable to load this post right now.",
  ],
  "blog.back": ["返回後書き", "後書きに戻る", "Back to 後書き"],
  "blog.end": ["完", "おわり", "END OF STORY"],
  notFound: ["404 / 未找到", "404 / 見つかりません", "404 / NOT FOUND"],
  "hdr.label": [
    "HDR 显示（有 HDR 版本的照片）",
    "HDR 表示（HDR 版がある写真）",
    "HDR display (where available)",
  ],
  "hdr.hint": [
    "HDR：有上传时显示原始 HDR 文件；效果取决于浏览器和屏幕",
    "HDR：アップロード済みの HDR 版を表示します。効果はブラウザーと画面に依存します",
    "HDR: show uploaded HDR originals; results depend on your browser and display",
  ],
  "hdr.loading": ["HDR 加载中…", "HDR 読み込み中…", "HDR loading…"],
  "hdr.error": [
    "HDR 暂时无法加载，已显示普通版本",
    "HDR を読み込めないため、通常版を表示しています",
    "HDR unavailable; showing the standard version",
  ],
  "film.canvas": [
    "胶片观片台，可拖动，滚轮浏览，Ctrl 或 Command 加滚轮或双指捏合缩放",
    "フィルムのライトテーブル。ドラッグで移動、ホイールでスクロール、Ctrl / Command とホイールまたはピンチでズーム",
    "Film light table: drag to pan, scroll to browse, Ctrl / Command + scroll or pinch to zoom",
  ],
  "film.zoom": ["胶片缩放", "フィルムのズーム", "Film zoom"],
  "film.gestures": [
    "滚轮浏览 · Ctrl / ⌘ + 滚轮缩放 · 拖动移动",
    "ホイールでスクロール · Ctrl / ⌘ + ホイールでズーム · ドラッグで移動",
    "Scroll to browse · Ctrl / ⌘ + scroll to zoom · Drag to pan",
  ],
  "zoom.out": ["缩小", "縮小", "Zoom out"],
  "zoom.in": ["放大", "拡大", "Zoom in"],
  "zoom.scale": ["缩放比例 {scale}%", "ズーム倍率 {scale}%", "Zoom {scale}%"],
  "film.reset": ["复位观片台", "ライトテーブルをリセット", "Reset light table"],
  loupe: ["观片放大镜", "ルーペ", "Loupe"],
  "loupe.glass": [
    "放大镜镜片，可拖动或使用方向键移动",
    "ルーペのレンズ。ドラッグまたは矢印キーで移動",
    "Loupe lens: drag or use arrow keys to move",
  ],
  "loupe.close": ["收起放大镜", "ルーペを閉じる", "Close loupe"],
  "loupe.zoom": ["局部放大倍率", "ルーペの倍率", "Loupe magnification"],
  "loupe.less": [
    "降低放大镜倍率",
    "ルーペの倍率を下げる",
    "Decrease loupe magnification",
  ],
  "loupe.more": [
    "提高放大镜倍率",
    "ルーペの倍率を上げる",
    "Increase loupe magnification",
  ],
} satisfies Record<string, readonly [string, string, string]>;

export type UiMessageKey = keyof typeof uiMessages;

export function isUiLanguage(value: unknown): value is UiLanguage {
  return UI_LANGUAGES.some((language) => language === value);
}

export function readUiLanguage(storage?: Pick<Storage, "getItem">): UiLanguage {
  try {
    const saved = storage?.getItem(UI_LANGUAGE_KEY);

    return isUiLanguage(saved) ? saved : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export function translateUi(
  language: UiLanguage,
  key: UiMessageKey,
  values: Record<string, string | number> = {},
): string {
  const message = uiMessages[key][UI_LANGUAGES.indexOf(language)];

  return message.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : token,
  );
}
