The forntend code for my gallery "Nihon Saien" :)

Main code from https://github.com/hebingchang/boar-gallery-web

## 胶片页面

`/film` 从现有照片 API 中筛选胶片照片，复用照片流、缓存和详情展示，不改动数据库记录，主页仍展示全部照片。
当前旧数据通过 Nikon FM 或 FUJI SP-3000 扫描器信息识别；识别规则位于 `src/utils/film.ts`，不会将所有 Nikon / Fuji 数码相机归为胶片。

筛选、分页和缓存测试：`node --test tests/film.test.mjs`。

## TODO

- Single Photo Page

- Map View

- Connecting Speed Optimization

- And More...


## Log

20250916 add Mapbox in Photo Details
