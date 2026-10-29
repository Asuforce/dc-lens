# アーキテクチャ

```text
入力(ui/form) -> 検証 -> simulate(input, regulationSet) -> 結果(ui/results, ui/charts)
                              ^
                  regulations/loader(verified のみ精密計算)
```

- `engine/` は副作用とDOM依存を持たない純粋関数。
- UIは計算せず、検証と描画だけを行う。
- 制度データは JSON で、計算コードに数値を埋め込まない。
- 配信は Cloudflare Workers Static Assets(`wrangler.jsonc` の `assets.directory` が `dist`、Worker スクリプトなし)。
