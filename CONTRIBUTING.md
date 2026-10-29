# Contributing

## 守ること

- 個人の実データ(給与、年収、拠出額、年齢、資産額、金融機関、保有商品など)を、コード、テスト、fixture、Issue、PR、スクリーンショットに含めない。例は新規に作った合成データと、法令・制度上の公開境界値だけにする。
- 制度数値は一次資料を取得して入力し、`sourceUrl` と `verifiedAt` を付ける。記憶や二次情報から埋めない。確認できない値は `provisional` にするか、欠落させて「未対応」と表示する。
- React、Vue、Svelte、Rust、WebAssembly は使わない。Vanilla TypeScript のみ。
- 入力値をURL、ログ、解析イベント、外部通信に含めない。

## 開発の流れ

1. `pnpm typecheck && pnpm lint && pnpm test && pnpm build` が通ることを確認する。
2. 計算式または制度データを変えるときは、出典URL、変更理由、回帰テストを同じPRに入れる。
3. `main` へは PR 経由で入れる。

## テスト

Vitest(unit / integration)と Playwright(e2e)。制度データの期待値は、実装の出力ではなく一次資料から独立に導く。
