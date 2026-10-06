# Camera identification assets

These marks identify the equipment used for photos, not sponsorship or affiliation.
Trademarks remain the property of their respective owners. Except for the Ricoh
SVG framing described below, files are downloaded unchanged; black/white display
and the Nikon archive image framing use CSS only.

- `sony.svg`: https://www.sony.jp/header-footer/assets/img/GlobalHeader/logo.svg
- `sony-alpha.svg`: copied unchanged from
  https://github.com/hebingchang/boar-gallery-web/blob/main/src/assets/logos/Sony_Alpha_logo.svg.
  The compact alpha-symbol + model-text composition and 0.7rem symbol height
  follow that repository's `camera_name.tsx` and `manufacture_icon.tsx`.
  Source attribution: hebingchang / boar-gallery-web. Its original software is
  licensed under PolyForm Noncommercial License 1.0.0:
  https://polyformproject.org/licenses/noncommercial/1.0.0/.
  See https://github.com/hebingchang/boar-gallery-web/blob/main/LICENSE.
  Sony trademarks remain Sony's. This site's use is personal/noncommercial.
- `sony-a7iv.svg`: https://www.sony.jp/ichigan/a-universe/assets/img/special_a7M4/logo_a7iv.svg
  (https://www.sony.jp/ichigan/a-universe/special_a7M4/)
- `sony-a7cii.svg`: https://www.sony.jp/ichigan/a-universe/assets/img/newconcept/a7cm2/logo_a7cm2_black.svg
  (https://www.sony.jp/ichigan/a-universe/newconcept/a7CM2/)
- `ricoh.png`: https://www.ricoh-imaging.co.jp/japan/products/gr-3/common/img/logo_richo.png
- `ricoh.svg`: the user-selected official asset at
  https://www.ricoh.com/-/Media/Ricoh/Sites/com/about/company/history/img/logo/img-logo04.svg.
  The original red paths are unchanged. The viewBox is tightened to the wordmark
  and the full-page white background rectangle is removed for aligned, transparent
  display. This is the Ricoh manufacturer logo used by the card.
- `ricoh-gr-iiix.png`: https://www.ricoh-imaging.co.jp/japan/products/gr-3/top/img/gr-3x-txt.png
  (https://www.ricoh-imaging.co.jp/japan/products/gr-3/)
- `nikon-1968.jpg`: https://www.nikon.com/company/corporate/brand/brand_symbol/img/pic_1968.jpg
  Nikon's 1968 track symbol, in use when the FM was introduced in 1977, not the
  1988 or 2003 marks. Source: https://www.nikon.com/company/corporate/brand/brand_symbol/.
  `FM` remains a small typeset model label; it is not presented as a sourced model logo.
- `iphone-14-pro.svg`: Apple wordmark preserved at
  https://commons.wikimedia.org/wiki/File:IPhone_14_Pro_wordmark.svg
  (source: Apple's original iPhone 14 Pro product page, PD-textlogo/trademark).
  Apple brand icon is from the existing react-icons / Simple Icons package.

Unknown equipment retains a text fallback. The metadata resolver also supports
older Nikon FM records where the camera model field contained film/scanner names.
The full Sony model wordmarks above are retained as source assets, but the card
now uses the compact alpha composition. The old GR IIIx wordmark is also retained
but not rendered: it contains RICOH, which would duplicate the selected brand logo.
Ricoh now uses `ricoh.svg` followed by plain model text (`GR IIIx`).
