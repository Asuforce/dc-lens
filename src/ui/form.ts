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
  age: "試算を始める時点の満年齢を入力します。誕生日がまだなら、今年迎える年齢から1を引いてください。",
  retirementAge:
    "給与収入と毎月の掛金を止める予定年齢を入力します。定年後も働く場合は、働き終える年齢で比較してください。",
  pensionStartAge:
    "年金を受け取り始める想定年齢を入力します。受給開始を変えたときの対応範囲は、結果の警告も確認してください。",
  pensionEndAge:
    "年金の累計額を何歳まで比較するかを指定します。寿命の予測ではありません。この年齢を変えると生涯差が変わるため、複数の年齢で比較してください。",
  annualIncome:
    "源泉徴収票の「支払金額」など、税・社会保険料を引く前の給与と賞与の年間合計を入力します。手取り額や副業収入は含めません。",
  monthlySalary:
    "税・社会保険料を引く前の月給を入力します。年収＝月給×12＋賞与となるようにしてください。空欄の場合は（年収－賞与）÷12で推定します。",
  bonus:
    "税・社会保険料を引く前の賞与を年間分合計します。賞与なしなら0を入力してください。月給欄に賞与を含めないでください。",
  dcContribution:
    "勤務先の選択制DCで、給与から事業主掛金へ振り替える月額を入力します。勤務先が別途負担する掛金は足さず、利用できる金額を人事・制度案内で確認してください。",
  idecoContribution:
    "iDeCoで毎月積み立てる掛金を入力します。同額掛金の比較ではDC月額とそろえてください。口座管理手数料は含めず、固定費欄へ入力します。",
  fixedFee:
    "iDeCoの手数料一覧や取引明細で、毎月引かれる定額手数料を合計します。年額表示なら12で割ります。信託報酬と加入時だけの手数料は含めません。",
  prefecture:
    "協会けんぽの加入支部を選択します。居住地と異なる場合があるため、勤務先の保険料率表や人事の案内で確認してください。",
  bonusMode:
    "昇給分を月給と賞与の両方に配るなら「賞与比率固定」、月給を据え置き昇給分を賞与へ配るなら「月給固定・賞与増加」を選びます。",
  valuation:
    "将来その時点の円額を足すなら「名目」、将来の金額を割引率で現在の価値に換算して比べるなら「現在価値」を選びます。",
  raiseMonth:
    "勤務先で昇給後の給与が適用される月を選びます。入金日ではなく、給与改定の対象月を給与通知で確認してください。2年目以降に適用します。",
  healthTotalRatePercent:
    "加入先の保険料率表から健康保険の労使合計料率を入力します。介護保険・支援金を含む総料率なら、それらを引いてください。本人負担が折半でない場合は本人料率の2倍を入力します。",
  careTotalRatePercent:
    "加入先の保険料率表で、健康保険とは別に記載された介護保険の労使合計料率を入力します。本人負担率だけが分かる場合は2倍します。年齢による適用は計算側で判定します。",
  childSupportTotalRatePercent:
    "加入先の案内から「子ども・子育て支援金」の労使合計料率を入力します。名称の似た事業主負担の「子ども・子育て拠出金」は入力しません。",
  transferBalance:
    "現在のiDeCo残高のうち、DCへ移す想定額を入力します。今後積み立てる掛金は含めず、口座の評価額で確認してください。",
  transferFee:
    "移換元・移換先の手数料案内で、移換時に一度だけかかる費用を合計します。かからない場合は0、毎月の口座管理料は固定費欄へ入力してください。",
  idleMonths:
    "移換の手続きで資産を運用できない見込み月数を入力します。移換元・移換先に期間を確認し、運用停止なしの比較なら0にします。",
  eventAge:
    "通常の昇給率とは異なる給与改定を想定する年齢を入力します。同じ年齢を重複させず、試算開始より後・退職より前の年齢を指定してください。",
  eventRate:
    "この年齢の年だけ適用する昇給率を入力します。通常の昇給率への上乗せではなく置き換えです。給与が増えない年は0、下がる年は負の値にします。",
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
let hintSequence = 0;
function addHints(form: HTMLElement) {
  for (const control of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    "input, select",
  )) {
    const label = control.closest("label");
    if (!label || control.closest(".field")) continue;
    if (control.type === "checkbox") label.classList.add("checkbox-label");
    const text = hints[control.name];
    if (!text) continue;
    const hint = document.createElement("span");
    hint.className = "field-help";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "?";
    button.setAttribute("aria-label", `${label.textContent}の説明`);
    const tip = document.createElement("span");
    tip.className = "field-tooltip";
    const hintId = hintSequence++;
    tip.id = `help-${control.name}-${hintId}`;
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

    const wrapper = document.createElement("div");
    wrapper.className = "field";
    label.before(wrapper);
    const heading = document.createElement("div");
    heading.className = "field-heading";
    control.id = `field-${control.name}-${hintId}`;
    label.htmlFor = control.id;
    control.remove();
    heading.append(label, hint);
    wrapper.append(heading, control);
    if (control.type === "checkbox") {
      wrapper.classList.add("checkbox-field");
      wrapper.prepend(control);
    }
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
    addHints(row);
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
