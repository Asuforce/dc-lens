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
const hints: Record<string, string> = {
  raiseRate:
    "毎年の給与増加率です。初期値2%は比較用の仮定で、統計上の平均や将来予測ではありません。勤務先の見込みに合わせて変更してください。",
  dcCost:
    "DCの商品資料にある信託報酬（税込・年率）を入力します。複数商品なら各商品の年率×資産配分の合計です。例：0.2%を60%、0.4%を40%なら0.28%。固定費は含めません。",
  idecoCost:
    "iDeCoの商品資料にある信託報酬（税込・年率）を入力します。複数商品なら各商品の年率×資産配分の合計です。例：0.2%を60%、0.4%を40%なら0.28%。月額の固定費は別欄に入力します。",
  grossReturn:
    "信託報酬を引く前の年間利回りです。初期値3%は比較用の仮定で、推奨商品や将来の収益を示しません。0%やマイナスの場合も比較してください。",
  inflation: "物価の年間上昇率です。初期値2%は比較用の仮定です。現在の計算では使用しません。",
  discount:
    "将来のお金を現在の価値に換算する年率です。1年後の102円は割引率2%なら現在の100円に相当します。初期値2%は比較用の仮定で、インフレ率とは別の設定です。",
  insurer: "健保組合・カスタム料率では、ご加入先が公表する料率を入力してください。",
  mode: "詳細モードでは昇給月を指定できます。対応範囲と計算上の仮定は結果で確認してください。",
  transferEnabled: "既存資産の運用コストと移換費用を、新規掛金の比較とは分けて試算します。",
  payoutEnabled:
    "一時金受取時の課税を追加で試算します。適用条件と対象外の条件を結果で確認してください。",
};
const defaults: Record<string, string> = {
  raiseRate: "2",
  grossReturn: "3",
  inflation: "2",
  discount: "2",
};
function addHints(form: HTMLFormElement) {
  for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    "input, select",
  )) {
    const label = control.closest("label");
    if (!label) continue;
    if (control.type === "checkbox") label.classList.add("checkbox-label");
    const text =
      hints[control.name] ??
      `${label.textContent ?? ""}を設定します。金額は円、割合は%で入力してください。`;
    const hint = document.createElement("span");
    hint.className = "field-help";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "?";
    button.setAttribute("aria-label", `${label.textContent}の説明`);
    const tip = document.createElement("span");
    tip.className = "field-tooltip";
    tip.id = `help-${control.name}`;
    tip.setAttribute("role", "tooltip");
    tip.textContent = text;
    button.setAttribute("aria-describedby", tip.id);
    button.addEventListener("click", () => hint.classList.toggle("is-open"));
    button.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hint.classList.remove("is-open");
        button.blur();
      }
    });
    hint.append(button, tip);
    label.after(hint);
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    label.before(wrapper);
    wrapper.append(label, hint);
  }
}
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
    i.value = defaults[name] ?? "";
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
      ["detailed", "詳細"],
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
  const raiseMonth = select(
    "raiseMonth",
    "昇給月",
    Array.from({ length: 12 }, (_, i) => [String(i + 1), `${i + 1}月`]),
  );
  const raiseSelect = raiseMonth.querySelector("select");
  if (raiseSelect) {
    raiseSelect.value = "4";
    raiseSelect.setAttribute("aria-describedby", "raise-month-help");
  }
  const raiseHelp = document.createElement("p");
  raiseHelp.id = "raise-month-help";
  raiseHelp.textContent = "2年目以降、毎年この月から昇給を反映します。";
  const raiseFields = document.createElement("div");
  raiseFields.append(raiseMonth, raiseHelp);
  groups[4]?.append(raiseFields);
  const mode = form.querySelector<HTMLSelectElement>('[name="mode"]');
  const updateMode = () => {
    raiseFields.hidden = mode?.value !== "detailed";
  };
  mode?.addEventListener("change", updateMode);
  updateMode();
  const customRates = document.createElement("div");
  customRates.className = "form-grid full-width";
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
    const prefectureField = prefecture?.closest(".field") ?? prefecture?.parentElement;
    if (prefectureField instanceof HTMLElement) prefectureField.hidden = isCustom;
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
  const payout = document.createElement("fieldset");
  const payoutLegend = document.createElement("legend");
  payoutLegend.textContent = "一時金受取";
  const payoutLabel = document.createElement("label");
  const payoutToggle = document.createElement("input");
  payoutToggle.type = "checkbox";
  payoutToggle.name = "payoutEnabled";
  payoutLabel.append(payoutToggle, document.createTextNode("一時金で受け取る場合の課税も試算する"));
  payout.append(payoutLegend, payoutLabel);
  form.append(payout);
  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "比較する";
  form.append(button);
  addHints(form);
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
    mode: get("mode"),
    raiseMonth: get("raiseMonth"),
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
    payoutEnabled: data.has("payoutEnabled"),
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
