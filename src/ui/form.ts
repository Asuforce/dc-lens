import type { FormValues } from "./state.ts";

const fields: [keyof FormValues, string][] = [
  ["age", "年齢"],
  ["retirementAge", "退職年齢"],
  ["pensionStartAge", "年金受給開始年齢"],
  ["pensionEndAge", "受給終了年齢"],
  ["annualIncome", "年収（円）"],
  ["monthlySalary", "月給（円・空欄なら推定）"],
  ["bonus", "賞与（年間・円）"],
  ["raiseRate", "昇給率（%）"],
  ["dcContribution", "選択制DC月額掛金（円）"],
  ["idecoContribution", "iDeCo月額掛金（円）"],
  ["dcCost", "DC年率コスト（%）"],
  ["idecoCost", "iDeCo年率コスト（%）"],
  ["fixedFee", "iDeCo固定費（月額円）"],
  ["grossReturn", "信託報酬控除前の想定利回り（%）"],
  ["inflation", "インフレ率（%）"],
  ["discount", "割引率（%）"],
];
const PREFECTURE_LABELS: Record<string, string> = {
  hokkaido: "北海道",
  aomori: "青森県",
  iwate: "岩手県",
  miyagi: "宮城県",
  akita: "秋田県",
  yamagata: "山形県",
  fukushima: "福島県",
  ibaraki: "茨城県",
  tochigi: "栃木県",
  gunma: "群馬県",
  saitama: "埼玉県",
  chiba: "千葉県",
  tokyo: "東京都",
  kanagawa: "神奈川県",
  niigata: "新潟県",
  toyama: "富山県",
  ishikawa: "石川県",
  fukui: "福井県",
  yamanashi: "山梨県",
  nagano: "長野県",
  gifu: "岐阜県",
  shizuoka: "静岡県",
  aichi: "愛知県",
  mie: "三重県",
  shiga: "滋賀県",
  kyoto: "京都府",
  osaka: "大阪府",
  hyogo: "兵庫県",
  nara: "奈良県",
  wakayama: "和歌山県",
  tottori: "鳥取県",
  shimane: "島根県",
  okayama: "岡山県",
  hiroshima: "広島県",
  yamaguchi: "山口県",
  tokushima: "徳島県",
  kagawa: "香川県",
  ehime: "愛媛県",
  kochi: "高知県",
  fukuoka: "福岡県",
  saga: "佐賀県",
  nagasaki: "長崎県",
  kumamoto: "熊本県",
  oita: "大分県",
  miyazaki: "宮崎県",
  kagoshima: "鹿児島県",
  okinawa: "沖縄県",
};
function select(
  name: string,
  label: string,
  options: [string, string, boolean?][],
): HTMLLabelElement {
  const l = document.createElement("label");
  l.textContent = label;
  const s = document.createElement("select");
  s.name = name;
  for (const [value, text, disabled] of options) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    o.disabled = !!disabled;
    s.append(o);
  }
  l.append(s);
  return l;
}
export function createForm(prefectures: string[]): HTMLFormElement {
  const form = document.createElement("form");
  form.noValidate = true;
  const grid = document.createElement("div");
  grid.className = "form-grid";
  const groups = ["本人情報", "収入", "掛金とコスト", "運用の仮定", "評価"].map((title) => {
    const group = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = title;
    group.append(legend);
    const container = document.createElement("div");
    container.className = "form-grid";
    group.append(container);
    form.append(group);
    return container;
  });
  for (const [index, [name, label]] of fields.entries()) {
    const l = document.createElement("label");
    l.textContent = label;
    const i = document.createElement("input");
    i.name = name;
    i.type = "number";
    i.step = "any";
    l.append(i);
    groups[index < 4 ? 0 : index < 8 ? 1 : index < 13 ? 2 : 3]?.append(l);
  }
  grid.append(
    select("prefecture", "都道府県", [
      ["", "選択してください"],
      ...prefectures.map((k) => [k, PREFECTURE_LABELS[k] ?? k] as [string, string]),
    ]),
    select("insurer", "健康保険者", [
      ["kyokai-kenpo", "協会けんぽ"],
      ["kenpo-kumiai", "健保組合"],
      ["custom", "カスタム料率"],
    ]),
    select("bonusMode", "賞与モード", [
      ["fixed-ratio", "賞与比率固定"],
      ["fixed-monthly-bonus-grows", "月給固定・賞与増加"],
    ]),
    select("mode", "計算モード", [
      ["simple", "簡易"],
      ["detailed", "詳細（フェーズ6）", true],
    ]),
    select("valuation", "評価基準", [
      ["nominal", "名目"],
      ["present-value", "現在価値"],
    ]),
  );
  for (const label of Array.from(grid.children)) {
    const name = label.querySelector("select")?.name;
    groups[name === "prefecture" || name === "insurer" ? 0 : name === "bonusMode" ? 1 : 4]?.append(
      label,
    );
  }
  const customRates = document.createElement("div");
  customRates.className = "form-grid";
  const help = document.createElement("p");
  help.textContent =
    "料率は労使合計を入力し、本人負担は折半として計算します。事業主負担が大きい場合は本人料率の2倍を合計として入力してください。";
  customRates.append(help);
  for (const [name, label] of [
    ["healthTotalRatePercent", "健康保険料率 合計（%）"],
    ["careTotalRatePercent", "介護保険料率（%）"],
    ["childSupportTotalRatePercent", "子ども・子育て支援金率（%）"],
  ]) {
    const l = document.createElement("label");
    l.textContent = label ?? "";
    const input = document.createElement("input");
    input.name = name ?? "";
    input.type = "number";
    input.step = "any";
    l.append(input);
    customRates.append(l);
  }
  groups[0]?.append(customRates);
  const insurer = form.querySelector<HTMLSelectElement>('[name="insurer"]');
  const prefecture = form.querySelector<HTMLSelectElement>('[name="prefecture"]');
  const updateInsurer = () => {
    const isCustom = insurer?.value !== "kyokai-kenpo";
    customRates.hidden = !isCustom;
    if (prefecture?.parentElement) prefecture.parentElement.hidden = isCustom;
  };
  insurer?.addEventListener("change", updateInsurer);
  updateInsurer();
  const events = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "昇給イベント";
  events.append(legend);
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "イベントを追加";
  add.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "event";
    for (const [name, label] of [
      ["eventAge", "年齢"],
      ["eventRate", "昇給率（%）"],
    ] as const) {
      const l = document.createElement("label");
      l.textContent = label;
      const i = document.createElement("input");
      i.type = "number";
      i.step = "any";
      i.name = name;
      l.append(i);
      row.append(l);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => row.remove());
    row.append(remove);
    events.insertBefore(row, add);
  });
  events.append(add);
  form.append(events);
  const transfer = document.createElement("fieldset");
  const transferLegend = document.createElement("legend");
  transferLegend.textContent = "既存資産の移換（新規掛金とは別の判断）";
  const toggleLabel = document.createElement("label");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.name = "transferEnabled";
  toggleLabel.append(toggle, document.createTextNode("既存資産の移換も比較する"));
  const transferFields = document.createElement("div");
  transferFields.className = "form-grid";
  transferFields.hidden = true;
  for (const [name, text] of [
    ["transferBalance", "移換する既存資産（円）"],
    ["transferFee", "移換手数料（円）"],
    ["idleMonths", "移換期間（月）"],
  ] as const) {
    const label = document.createElement("label");
    label.textContent = text;
    const input = document.createElement("input");
    input.type = "number";
    input.name = name;
    label.append(input);
    transferFields.append(label);
  }
  toggle.addEventListener("change", () => {
    transferFields.hidden = !toggle.checked;
  });
  transfer.append(transferLegend, toggleLabel, transferFields);
  form.append(transfer);
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "比較する";
  form.append(button);
  return form;
}
export function readForm(form: HTMLFormElement, version: string): FormValues {
  const data = new FormData(form);
  const get = (key: string) => String(data.get(key) ?? "");
  const ages = data.getAll("eventAge");
  const rates = data.getAll("eventRate");
  return {
    age: get("age"),
    retirementAge: get("retirementAge"),
    pensionStartAge: get("pensionStartAge"),
    pensionEndAge: get("pensionEndAge"),
    annualIncome: get("annualIncome"),
    monthlySalary: get("monthlySalary"),
    bonus: get("bonus"),
    raiseRate: get("raiseRate"),
    events: ages.map((age, i) => ({ age: String(age), rate: String(rates[i] ?? "") })),
    bonusMode: get("bonusMode"),
    prefecture: get("prefecture"),
    insurer: get("insurer"),
    healthTotalRatePercent: get("healthTotalRatePercent"),
    careTotalRatePercent: get("careTotalRatePercent"),
    childSupportTotalRatePercent: get("childSupportTotalRatePercent"),
    dcContribution: get("dcContribution"),
    idecoContribution: get("idecoContribution"),
    dcCost: get("dcCost"),
    idecoCost: get("idecoCost"),
    fixedFee: get("fixedFee"),
    transferEnabled: data.has("transferEnabled"),
    transferBalance: get("transferBalance"),
    transferFee: get("transferFee"),
    idleMonths: get("idleMonths"),
    grossReturn: get("grossReturn"),
    inflation: get("inflation"),
    discount: get("discount"),
    valuation: get("valuation"),
    regulationVersion: version,
  };
}
