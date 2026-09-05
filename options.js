(function () {
  "use strict";

  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};
  const FX_ENDPOINT = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,JPY";

  // ---------------------------------------------------------------------
  // Japanese localization - see i18n.js (loaded first, per manifest.json)
  // for the isJapanese detection logic (JPY currency selected or Japanese
  // browser/OS language; the third signal, an Axis JP-locale URL, doesn't
  // apply on this standalone options page).
  // ---------------------------------------------------------------------
  const JA = {
    headerTitle: "4XS Toolbox — 月次価格更新",
    headerSubtitle: "毎月AXIS Price List(.xls)をドロップすると、EURおよびFX換算のUSD/JPY価格を更新できます — 再インストール不要です。",
    currentStatusHeading: "現在の状態",
    favoritesHeading: "🧡 お気に入り",
    favoritesEmpty: "お気に入りはまだありません — axis.com上のカメラの♡をクリックしてください。",
    kofiHeading: "☕ この拡張機能を応援する",
    kofiText: "この拡張機能は個人が空き時間で開発しているプロジェクトで、無料・広告なし・トラッキングなしです。価格表を調べる手間が省けたなら、Pavelにコーヒーを一杯おごって開発の継続を支援していただけると嬉しいです。完全に任意で、どの機能を使うにも必須ではありません。",
    updatePricesHeading: "価格を更新",
    dropZoneInstructions: "価格表(.xls/.xlsx)をここにドロップするか、クリックしてファイルを選択してください",
    dropZoneHint: '通常のAXIS Price Listは自動的に認識されます("All products"シートを読み込み、全カテゴリーを網羅)。それ以外のファイルは列を手動でマッピングできます — 価格列の通貨(EUR/USD/JPY)も指定可能です。FXレート取得以外、どこにもアップロードされません。',
    mappingCardHeading: "列の設定",
    mappingHintText: "このファイルのレイアウトは自動認識できませんでした。下記でシートと列を選択し、プレビューを確認したうえで確定してください。",
    sheetLabel: "シート",
    headerRowLabel: "ヘッダー行(行番号)",
    nameColLabel: "機器名・モデル列",
    priceColLabel: "価格列",
    partColLabel: "型番/SKU列(任意、一致精度が上がります)",
    currencyChoiceLabel: "この価格列の通貨",
    currencyEurOption: "€ EUR",
    currencyUsdOption: "$ USD",
    currencyJpyOption: "¥ JPY",
    useMappingBtn: "このマッピングを使用",
    noneOption: "(なし)",
    blankColumnLabel: "(空白)",
    previewColName: "名前",
    previewColPart: "型番 #",
    previewColPrice: (currency) => `価格 (${currency})`,
    previewUnavailable: (msg) => `プレビュー不可: ${msg}`,
    fxRateEurUsdLabel: "EUR → USD レート",
    fxRateEurJpyLabel: "EUR → JPY レート",
    sourceLabelFieldLabel: "出典ラベル(バッジのツールチップに表示)",
    sourceLabelPlaceholder: "AXIS Price List、月 年(All productsシート)",
    coverageBySectionSummary: "セクション別カバー状況",
    unmatchedSkusSummary: "未一致のSKU",
    applyButton: "更新を適用",
    revertButton: "同梱の価格に戻す",
    privacyNoteText:
      "すべての処理はブラウザ内でローカルに行われます。価格ファイルはこのページ内でのみ解析され、お使いの端末から外部に送信されることはありません。" +
      "このページが行う唯一のネットワーク通信は、api.frankfurter.dev(ECB参照レート、APIキー不要、カメラ・価格データの送信なし)へのFXレート取得(EUR/USD、必要に応じてEUR/JPY)です。" +
      "取得に失敗した場合は、本日のレートを手動で入力できます。",
    currentStatusNoUpdate: (bundledSource) =>
      `月次更新は未適用です — 現在はこの拡張機能バージョンに同梱されている価格を使用しています: ${bundledSource}。新しいファイルを下にドロップするまで、これがデフォルトです。`,
    currentStatusApplied: (sourceLabel, when, matched, total, currencyNote) =>
      `現在使用中: ${sourceLabel} — ${when}に適用 (${matched}/${total} SKU${currencyNote})。`,
    currencyNoteUsd: "、USDで直接取得",
    currencyNoteJpy: "、JPYで取得",
    neverDate: "未取得",
    parseStatusReading: (name) => `${name} を読み込み中…`,
    parseStatusCouldntRecognize: (name) =>
      `${name} のレイアウトを自動認識できませんでした — 下記で列を設定し、プレビューを確認したうえで「このマッピングを使用」をクリックしてください。`,
    parseStatusCouldntParseFile: (msg) => `このファイルを解析できませんでした: ${msg}`,
    parseStatusPickColumns: "続行する前に、名前列と価格列の両方を選択してください。",
    parseStatusCouldntParseMapping: (msg) => `このマッピングでは解析できませんでした: ${msg}`,
    parseStatusFetchingRateEurUsd: "本日のEUR/USDレートを取得中…",
    parseStatusFetchingRateEurUsdJpy: "本日のEUR/USDおよびEUR/JPYレートを取得中…",
    parseStatusParsedRows: (count, currency) => `${count} 件の価格行を解析しました (${currency})。`,
    parseStatusEnterValidEurUsd: "適用する前に有効なEUR/USDレートを入力してください。",
    parseStatusEnterValidEurJpy: "適用する前に有効なEUR/JPYレートを入力してください。",
    parseStatusApplied: "適用しました。Product Selector、検索バッジ、ポップアップにはすぐに反映されます。",
    parseStatusAppliedWithNew: (count) =>
      `適用しました(このカタログに未登録だった新製品を${count}件含む)。Product Selector、検索バッジ、ポップアップにはすぐに反映されます。`,
    parseStatusReverted: "この拡張機能バージョンに同梱されている価格に戻しました(自動追加された新製品も含めて)。",
    errorSheetNotFound: (sheetName) => `このファイルにシート "${sheetName}" が見つかりません。`,
    errorNoPricedRows: "このマッピングでは価格行が見つかりませんでした - シート、ヘッダー行、列を確認してください。",
    fxSourceAutoFetched: (date) => `api.frankfurter.devから自動取得(ECB参照レート、${date}時点)`,
    fxSourceAutoFetchFailed: (msg) => `自動取得に失敗しました (${msg}) - 下記にレートを手動で入力してください。`,
    sourceLabelDefaultAuto: (monthYear, sheetName) => `AXIS Price List、${monthYear} (${sheetName}シート、自動検出)`,
    sourceLabelDefaultManual: (sheetName, date) => `価格表 (${sheetName}シート)、${date}に手動マッピング`,
    sourceLabelFallbackOnApply: (date) => `価格表 (${date}にアップロード)`,
    summaryLine: (matched, total, partMatched, fallbackMatched, unmatchedCount) =>
      `${matched} / ${total} 件のカタログSKUが一致 (${partMatched} 件は型番、${fallbackMatched} 件は名前で一致)。${unmatchedCount} 件が未一致。`,
    unmatchedNone: "該当なし。",
    noPartNumberFallback: "型番なし",
    unmatchedMoreFormat: (count) => `…他 ${count} 件。`,
    newProductsSummary: (count) =>
      `このファイルにはまだカタログにない製品が${count}件あり、適用すると新規エントリとして追加されます。`,
  };
  const isJa = () => typeof AxisI18N !== "undefined" && AxisI18N.isJapanese;

  // ---------------------------------------------------------------------
  // Basic multi-language support for this page's static labels only (the
  // dynamic parse/status/error messages below stay in English for these
  // nine, same as before this update - a lighter-weight pass than the full
  // 11-language system in popup.js, which does cover every string).
  // This page has no flag picker of its own: it just follows whatever
  // language the user already picked in the toolbar popup, read from the
  // same "axisPopupLang" storage key popup.js writes to. Japanese keeps its
  // original full-coverage JA table and its existing isJapanese detection,
  // unchanged from before.
  // ---------------------------------------------------------------------
  const BASIC_TRANSLATIONS = {
    cs: {
      headerTitle: "4XS Toolbox — Měsíční aktualizace cen",
      headerSubtitle:
        "Každý měsíc přetáhněte ceník AXIS Price List (.xls) pro aktualizaci cen v EUR a z nich odvozených cen v USD/JPY podle kurzu — bez nutnosti přeinstalace.",
      currentStatusHeading: "Aktuální stav",
      favoritesHeading: "🧡 Oblíbené",
      kofiHeading: "☕ Podpořte toto rozšíření",
      kofiText: "Toto rozšíření je projekt jednoho člověka ve volném čase — zdarma, bez reklam, bez sledování. Pokud vám ušetřilo cestu do ceníku, kávou pro Pavla podpoříte jeho další údržbu a aktualizace. Zcela dobrovolné a nikdy nutné pro používání jakékoli funkce zde.",
      favoritesEmpty: "Zatím žádné oblíbené — klikněte na ♡ u libovolné kamery na axis.com.",
      updatePricesHeading: "Aktualizovat ceny",
      dropZoneInstructions: "Přetáhněte sem ceník (.xls/.xlsx), nebo klikněte pro výběr souboru",
      dropZoneHint:
        'Běžný ceník AXIS Price List se rozpozná automaticky (načte list "All products", pokrývající všechny kategorie). Sloupce jiného souboru lze namapovat ručně níže - včetně určení, v jaké měně (EUR/USD/JPY) je sloupec s cenou. Nikam se nic nenahrává kromě dotazu na kurz měn.',
      mappingCardHeading: "Nastavit sloupce",
      mappingHintText:
        "Rozvržení tohoto souboru nebylo rozpoznáno automaticky. Vyberte níže list a sloupce, zkontrolujte náhled a poté potvrďte.",
      sheetLabel: "List",
      headerRowLabel: "Řádek s hlavičkou (číslo řádku)",
      nameColLabel: "Sloupec s názvem zařízení / modelu",
      priceColLabel: "Sloupec s cenou",
      partColLabel: "Sloupec s číslem dílu / SKU (volitelné, zlepší přiřazení)",
      currencyChoiceLabel: "Tento sloupec s cenou je v",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Použít toto mapování",
      fxRateEurUsdLabel: "Kurz EUR → USD",
      fxRateEurJpyLabel: "Kurz EUR → JPY",
      sourceLabelFieldLabel: "Popisek zdroje (zobrazí se v tooltipu štítku)",
      sourceLabelPlaceholder: "AXIS Price List, měsíc rok (list All products)",
      coverageBySectionSummary: "Pokrytí podle sekcí",
      unmatchedSkusSummary: "Nepřiřazené SKU",
      applyButton: "Použít aktualizaci",
      revertButton: "Vrátit se k přiloženým cenám",
      privacyNoteText:
        "Vše se zpracovává lokálně ve vašem prohlížeči. Soubor s cenami se analyzuje pouze na této stránce a nikdy neopustí váš počítač. Jediný síťový požadavek, který tato stránka provádí, je dotaz na kurz měn (EUR/USD, případně EUR/JPY) na api.frankfurter.dev (referenční kurzy ECB, bez API klíče, bez odesílání dat o kamerách či cenách). Pokud se dotaz nezdaří, můžete dnešní kurz(y) zadat ručně.",
    },
    es: {
      headerTitle: "4XS Toolbox — Actualización mensual de precios",
      headerSubtitle:
        "Suelta la lista de precios AXIS (.xls) cada mes para actualizar los precios en EUR y los precios en USD/JPY derivados del tipo de cambio — sin necesidad de reinstalar.",
      currentStatusHeading: "Estado actual",
      favoritesHeading: "🧡 Favoritos",
      kofiHeading: "☕ Apoya esta extensión",
      kofiText: "Esta extensión es un proyecto personal desarrollado en tiempo libre — gratis, sin anuncios, sin seguimiento. Si te ha ahorrado una consulta a la lista de precios, invitar a Pavel a un café ayuda a mantenerla y actualizarla. Totalmente opcional, nunca necesario para usar ninguna función.",
      favoritesEmpty: "Aún no hay favoritos — haz clic en ♡ en cualquier cámara de axis.com.",
      updatePricesHeading: "Actualizar precios",
      dropZoneInstructions: "Suelta aquí una lista de precios (.xls/.xlsx), o haz clic para elegir un archivo",
      dropZoneHint:
        'La lista de precios AXIS habitual se reconoce automáticamente (lee la hoja "All products", que cubre todas las categorías). Las columnas de cualquier otro archivo se pueden asignar manualmente abajo - incluyendo indicar en qué moneda (EUR/USD/JPY) está su columna de precio. No se sube nada a ningún sitio salvo una consulta del tipo de cambio.',
      mappingCardHeading: "Configurar columnas",
      mappingHintText:
        "El formato de este archivo no se reconoció automáticamente. Elige la hoja y las columnas abajo, revisa la vista previa y luego confirma.",
      sheetLabel: "Hoja",
      headerRowLabel: "Fila de encabezado (número de fila)",
      nameColLabel: "Columna de nombre de dispositivo / modelo",
      priceColLabel: "Columna de precio",
      partColLabel: "Columna de número de pieza / SKU (opcional, mejora la coincidencia)",
      currencyChoiceLabel: "Esta columna de precio está en",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Usar esta asignación",
      fxRateEurUsdLabel: "Tipo de cambio EUR → USD",
      fxRateEurJpyLabel: "Tipo de cambio EUR → JPY",
      sourceLabelFieldLabel: "Etiqueta de origen (se muestra en los tooltips de la insignia)",
      sourceLabelPlaceholder: "Lista de precios AXIS, mes año (hoja All products)",
      coverageBySectionSummary: "Cobertura por sección",
      unmatchedSkusSummary: "SKU sin coincidencia",
      applyButton: "Aplicar actualización",
      revertButton: "Volver a los precios incluidos",
      privacyNoteText:
        "Todo se procesa localmente en tu navegador. El archivo de precios se analiza solo en esta página y nunca sale de tu equipo. La única solicitud de red que hace esta página es una consulta del tipo de cambio (EUR/USD, y EUR/JPY si es necesario) a api.frankfurter.dev (tipos de referencia del BCE, sin clave de API, sin enviar datos de cámaras ni de precios). Si esa consulta falla, puedes introducir el/los tipo(s) de hoy manualmente.",
    },
    de: {
      headerTitle: "4XS Toolbox — Monatliches Preisupdate",
      headerSubtitle:
        "Jeden Monat die AXIS-Preisliste (.xls) hier ablegen, um EUR- und daraus abgeleitete USD/JPY-Preise zu aktualisieren — keine Neuinstallation nötig.",
      currentStatusHeading: "Aktueller Status",
      favoritesHeading: "🧡 Favoriten",
      kofiHeading: "☕ Diese Erweiterung unterstützen",
      kofiText: "Diese Erweiterung ist ein Ein-Personen-Projekt in der Freizeit — kostenlos, ohne Werbung, ohne Tracking. Wenn sie dir einen Blick in die Preisliste erspart hat, hilft ein Kaffee für Pavel bei der weiteren Pflege und Aktualisierung. Völlig freiwillig und nie Voraussetzung für irgendeine Funktion hier.",
      favoritesEmpty: "Noch keine Favoriten — klicken Sie auf ♡ bei einer beliebigen Kamera auf axis.com.",
      updatePricesHeading: "Preise aktualisieren",
      dropZoneInstructions: "Preisliste (.xls/.xlsx) hier ablegen oder klicken, um eine Datei auszuwählen",
      dropZoneHint:
        'Die übliche AXIS-Preisliste wird automatisch erkannt (liest das Blatt "All products", das alle Kategorien abdeckt). Die Spalten jeder anderen Datei können unten manuell zugeordnet werden - inklusive Angabe, in welcher Währung (EUR/USD/JPY) die Preisspalte ist. Es wird nichts hochgeladen außer einer Wechselkursabfrage.',
      mappingCardHeading: "Spalten konfigurieren",
      mappingHintText:
        "Der Aufbau dieser Datei wurde nicht automatisch erkannt. Wählen Sie unten Blatt und Spalten aus, prüfen Sie die Vorschau und bestätigen Sie dann.",
      sheetLabel: "Blatt",
      headerRowLabel: "Kopfzeile (Zeilennummer)",
      nameColLabel: "Spalte für Gerätename / Modell",
      priceColLabel: "Preisspalte",
      partColLabel: "Spalte für Teile-/SKU-Nummer (optional, verbessert die Zuordnung)",
      currencyChoiceLabel: "Diese Preisspalte ist in",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Diese Zuordnung verwenden",
      fxRateEurUsdLabel: "Kurs EUR → USD",
      fxRateEurJpyLabel: "Kurs EUR → JPY",
      sourceLabelFieldLabel: "Quellenangabe (in Badge-Tooltips angezeigt)",
      sourceLabelPlaceholder: "AXIS-Preisliste, Monat Jahr (Blatt All products)",
      coverageBySectionSummary: "Abdeckung nach Abschnitt",
      unmatchedSkusSummary: "Nicht zugeordnete SKUs",
      applyButton: "Update anwenden",
      revertButton: "Auf mitgelieferte Preise zurücksetzen",
      privacyNoteText:
        "Alles läuft lokal in Ihrem Browser. Die Preisdatei wird nur auf dieser Seite analysiert und verlässt niemals Ihr Gerät. Die einzige Netzwerkanfrage dieser Seite ist eine Wechselkursabfrage (EUR/USD, bei Bedarf EUR/JPY) an api.frankfurter.dev (EZB-Referenzkurse, kein API-Schlüssel, keine Kamera- oder Preisdaten werden gesendet). Falls diese Abfrage fehlschlägt, können Sie die heutigen Kurse manuell eingeben.",
    },
    fr: {
      headerTitle: "4XS Toolbox — Mise à jour mensuelle des prix",
      headerSubtitle:
        "Déposez la liste de prix AXIS (.xls) chaque mois pour actualiser les prix en EUR et les prix en USD/JPY dérivés du taux de change — sans réinstallation nécessaire.",
      currentStatusHeading: "État actuel",
      favoritesHeading: "🧡 Favoris",
      kofiHeading: "☕ Soutenir cette extension",
      kofiText: "Cette extension est un projet personnel développé sur le temps libre — gratuite, sans publicité, sans pistage. Si elle vous a évité de consulter la liste de prix, offrir un café à Pavel aide à la maintenir et à la mettre à jour. Totalement facultatif, jamais requis pour utiliser une fonctionnalité.",
      favoritesEmpty: "Aucun favori pour l'instant — cliquez sur ♡ sur n'importe quelle caméra sur axis.com.",
      updatePricesHeading: "Mettre à jour les prix",
      dropZoneInstructions: "Déposez ici une liste de prix (.xls/.xlsx), ou cliquez pour choisir un fichier",
      dropZoneHint:
        'La liste de prix AXIS habituelle est reconnue automatiquement (lit la feuille "All products", couvrant toutes les catégories). Les colonnes de tout autre fichier peuvent être associées manuellement ci-dessous - y compris en indiquant dans quelle devise (EUR/USD/JPY) se trouve la colonne de prix. Rien n\'est envoyé nulle part, à l\'exception d\'une consultation du taux de change.',
      mappingCardHeading: "Configurer les colonnes",
      mappingHintText:
        "La mise en page de ce fichier n'a pas été reconnue automatiquement. Choisissez la feuille et les colonnes ci-dessous, vérifiez l'aperçu, puis confirmez.",
      sheetLabel: "Feuille",
      headerRowLabel: "Ligne d'en-tête (numéro de ligne)",
      nameColLabel: "Colonne nom de l'appareil / modèle",
      priceColLabel: "Colonne de prix",
      partColLabel: "Colonne numéro de référence / SKU (facultatif, améliore la correspondance)",
      currencyChoiceLabel: "Cette colonne de prix est en",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Utiliser cette correspondance",
      fxRateEurUsdLabel: "Taux EUR → USD",
      fxRateEurJpyLabel: "Taux EUR → JPY",
      sourceLabelFieldLabel: "Libellé de la source (affiché dans les infobulles des badges)",
      sourceLabelPlaceholder: "Liste de prix AXIS, mois année (feuille All products)",
      coverageBySectionSummary: "Couverture par section",
      unmatchedSkusSummary: "SKU non appariées",
      applyButton: "Appliquer la mise à jour",
      revertButton: "Revenir aux prix intégrés",
      privacyNoteText:
        "Tout est traité localement dans votre navigateur. Le fichier de prix n'est analysé que sur cette page et ne quitte jamais votre ordinateur. La seule requête réseau effectuée par cette page est une consultation du taux de change (EUR/USD, et EUR/JPY si nécessaire) auprès d'api.frankfurter.dev (taux de référence BCE, sans clé API, aucune donnée caméra ou tarifaire envoyée). Si cette consultation échoue, vous pouvez saisir le(s) taux du jour manuellement.",
    },
    ko: {
      headerTitle: "4XS Toolbox — 월간 가격 업데이트",
      headerSubtitle: "매달 AXIS 가격표(.xls)를 드롭하면 EUR 가격과 환율 기반 USD/JPY 가격이 갱신됩니다 — 재설치가 필요 없습니다.",
      currentStatusHeading: "현재 상태",
      favoritesHeading: "🧡 즐겨찾기",
      kofiHeading: "☕ 이 확장 프로그램 후원하기",
      kofiText: "이 확장 프로그램은 한 사람이 여가 시간에 만드는 프로젝트로, 무료이며 광고와 추적이 없습니다. 가격표를 찾아보는 수고를 덜어드렸다면, Pavel에게 커피 한 잔을 사주시면 유지 관리와 업데이트에 큰 도움이 됩니다. 전적으로 선택 사항이며 어떤 기능을 사용하는 데도 필요하지 않습니다.",
      favoritesEmpty: "아직 즐겨찾기가 없습니다 — axis.com의 카메라에서 ♡를 클릭하세요.",
      updatePricesHeading: "가격 업데이트",
      dropZoneInstructions: "가격표(.xls/.xlsx)를 여기로 드롭하거나 클릭해 파일을 선택하세요",
      dropZoneHint:
        '일반적인 AXIS 가격표는 자동으로 인식됩니다(모든 카테고리를 포함하는 "All products" 시트를 읽음). 다른 파일의 열은 아래에서 수동으로 매핑할 수 있습니다 - 가격 열의 통화(EUR/USD/JPY)를 지정하는 것도 포함됩니다. 환율 조회 외에는 어디에도 업로드되지 않습니다.',
      mappingCardHeading: "열 구성",
      mappingHintText: "이 파일의 레이아웃이 자동으로 인식되지 않았습니다. 아래에서 시트와 열을 선택하고 미리보기를 확인한 후 확정하세요.",
      sheetLabel: "시트",
      headerRowLabel: "머리글 행(행 번호)",
      nameColLabel: "장치 이름 / 모델 열",
      priceColLabel: "가격 열",
      partColLabel: "부품/SKU 번호 열(선택, 일치 정확도 향상)",
      currencyChoiceLabel: "이 가격 열의 통화는",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "이 매핑 사용",
      fxRateEurUsdLabel: "EUR → USD 환율",
      fxRateEurJpyLabel: "EUR → JPY 환율",
      sourceLabelFieldLabel: "출처 라벨(배지 툴팁에 표시됨)",
      sourceLabelPlaceholder: "AXIS 가격표, 월 연도(All products 시트)",
      coverageBySectionSummary: "섹션별 커버리지",
      unmatchedSkusSummary: "일치하지 않는 SKU",
      applyButton: "업데이트 적용",
      revertButton: "번들 가격으로 되돌리기",
      privacyNoteText:
        "모든 처리는 브라우저에서 로컬로 이루어집니다. 가격 파일은 이 페이지에서만 분석되며 사용자의 기기를 벗어나지 않습니다. 이 페이지가 수행하는 유일한 네트워크 요청은 api.frankfurter.dev(ECB 참조 환율, API 키 없음, 카메라나 가격 데이터 전송 없음)에 대한 환율 조회(EUR/USD, 필요 시 EUR/JPY)입니다. 조회가 실패하면 오늘의 환율을 직접 입력할 수 있습니다.",
    },
    zh: {
      headerTitle: "4XS Toolbox — 每月价格更新",
      headerSubtitle: "每月拖入 AXIS 价格表(.xls)以刷新欧元价格及基于汇率换算的美元/日元价格 — 无需重新安装。",
      currentStatusHeading: "当前状态",
      favoritesHeading: "🧡 收藏",
      kofiHeading: "☕ 支持这个扩展",
      kofiText: "这个扩展是个人利用业余时间开发的项目——免费、无广告、无追踪。如果它帮你省去了查价目表的麻烦，请 Pavel 喝杯咖啡有助于持续维护和更新。完全自愿，绝不是使用任何功能的必要条件。",
      favoritesEmpty: "暂无收藏 — 点击 axis.com 上任意相机的 ♡ 即可添加。",
      updatePricesHeading: "更新价格",
      dropZoneInstructions: "将价格表(.xls/.xlsx)拖到此处，或点击选择文件",
      dropZoneHint:
        '常规的 AXIS 价格表会被自动识别(读取涵盖所有类别的"All products"工作表)。其他文件的列可在下方手动映射 - 包括指定其价格列所使用的货币(EUR/USD/JPY)。除汇率查询外，不会上传任何内容。',
      mappingCardHeading: "配置列",
      mappingHintText: "未能自动识别此文件的格式。请在下方选择工作表和列，检查预览后确认。",
      sheetLabel: "工作表",
      headerRowLabel: "标题行(行号)",
      nameColLabel: "设备名称/型号列",
      priceColLabel: "价格列",
      partColLabel: "料号/SKU 列(可选，可提高匹配精度)",
      currencyChoiceLabel: "此价格列使用的货币是",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "使用此映射",
      fxRateEurUsdLabel: "EUR → USD 汇率",
      fxRateEurJpyLabel: "EUR → JPY 汇率",
      sourceLabelFieldLabel: "来源标签(显示在徽章提示中)",
      sourceLabelPlaceholder: "AXIS 价格表，月份 年份(All products 工作表)",
      coverageBySectionSummary: "按类别的覆盖情况",
      unmatchedSkusSummary: "未匹配的 SKU",
      applyButton: "应用更新",
      revertButton: "恢复为内置价格",
      privacyNoteText:
        "所有处理均在您的浏览器本地完成。价格文件仅在此页面解析，绝不会离开您的设备。此页面发出的唯一网络请求是向 api.frankfurter.dev 查询汇率(EUR/USD，如需要则包括 EUR/JPY)(欧洲央行参考汇率，无需 API 密钥，不发送任何摄像机或价格数据)。如果该查询失败，您可以手动输入当日汇率。",
    },
    sv: {
      headerTitle: "4XS Toolbox — Månatlig prisuppdatering",
      headerSubtitle:
        "Släpp AXIS Price List (.xls) varje månad för att uppdatera EUR-priser och växelkursbaserade USD/JPY-priser — ingen ominstallation behövs.",
      currentStatusHeading: "Aktuell status",
      favoritesHeading: "🧡 Favoriter",
      kofiHeading: "☕ Stötta det här tillägget",
      kofiText: "Det här tillägget är ett fritidsprojekt av en person — gratis, utan reklam, utan spårning. Om det sparat dig en titt i prislistan hjälper en kaffe till Pavel till att hålla det underhållet och uppdaterat. Helt frivilligt och aldrig ett krav för att använda någon funktion.",
      favoritesEmpty: "Inga favoriter än — klicka på ♡ på valfri kamera på axis.com.",
      updatePricesHeading: "Uppdatera priser",
      dropZoneInstructions: "Släpp en prislista (.xls/.xlsx) här, eller klicka för att välja en fil",
      dropZoneHint:
        'Den vanliga AXIS Price List känns igen automatiskt (läser bladet "All products", som täcker alla kategorier). Kolumnerna i andra filer kan mappas manuellt nedan - inklusive att ange vilken valuta (EUR/USD/JPY) priskolumnen är i. Inget laddas upp någonstans förutom en växelkursförfrågan.',
      mappingCardHeading: "Konfigurera kolumner",
      mappingHintText:
        "Den här filens layout kunde inte kännas igen automatiskt. Välj blad och kolumner nedan, kontrollera förhandsgranskningen och bekräfta sedan.",
      sheetLabel: "Blad",
      headerRowLabel: "Rubrikrad (radnummer)",
      nameColLabel: "Kolumn för enhetsnamn / modell",
      priceColLabel: "Priskolumn",
      partColLabel: "Kolumn för artikelnummer / SKU (valfritt, förbättrar matchningen)",
      currencyChoiceLabel: "Den här priskolumnen är i",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Använd den här mappningen",
      fxRateEurUsdLabel: "Växelkurs EUR → USD",
      fxRateEurJpyLabel: "Växelkurs EUR → JPY",
      sourceLabelFieldLabel: "Källetikett (visas i badge-tooltips)",
      sourceLabelPlaceholder: "AXIS Price List, månad år (bladet All products)",
      coverageBySectionSummary: "Täckning per avsnitt",
      unmatchedSkusSummary: "Omatchade SKU:er",
      applyButton: "Tillämpa uppdatering",
      revertButton: "Återgå till medföljande priser",
      privacyNoteText:
        "Allt körs lokalt i din webbläsare. Prisfilen analyseras endast på den här sidan och lämnar aldrig din dator. Den enda nätverksförfrågan den här sidan gör är en växelkursförfrågan (EUR/USD, och EUR/JPY vid behov) till api.frankfurter.dev (ECB:s referenskurser, ingen API-nyckel, ingen kamera- eller prisdata skickas). Om förfrågan misslyckas kan du ange dagens kurs(er) manuellt.",
    },
    uk: {
      headerTitle: "4XS Toolbox — Щомісячне оновлення цін",
      headerSubtitle:
        "Щомісяця перетягуйте прайс-лист AXIS (.xls), щоб оновити ціни в EUR і похідні від курсу ціни в USD/JPY — перевстановлення не потрібне.",
      currentStatusHeading: "Поточний стан",
      favoritesHeading: "🧡 Обране",
      kofiHeading: "☕ Підтримати це розширення",
      kofiText: "Це розширення — проєкт однієї людини у вільний час: безкоштовний, без реклами, без відстеження. Якщо воно заощадило вам похід до прайс-листа, кава для Павла допоможе підтримувати й оновлювати його надалі. Це повністю добровільно і ніколи не є обов’язковим для використання будь-якої функції.",
      favoritesEmpty: "Поки що немає обраного — натисніть ♡ на будь-якій камері на axis.com.",
      updatePricesHeading: "Оновити ціни",
      dropZoneInstructions: "Перетягніть сюди прайс-лист (.xls/.xlsx) або натисніть, щоб вибрати файл",
      dropZoneHint:
        'Звичайний прайс-лист AXIS розпізнається автоматично (читає аркуш "All products", що охоплює всі категорії). Стовпці будь-якого іншого файлу можна зіставити вручну нижче - зокрема вказати, в якій валюті (EUR/USD/JPY) стовпець із ціною. Нічого нікуди не завантажується, окрім запиту курсу обміну.',
      mappingCardHeading: "Налаштувати стовпці",
      mappingHintText:
        "Розмітку цього файлу не вдалося розпізнати автоматично. Виберіть аркуш і стовпці нижче, перевірте попередній перегляд, а потім підтвердьте.",
      sheetLabel: "Аркуш",
      headerRowLabel: "Рядок заголовка (номер рядка)",
      nameColLabel: "Стовпець назви пристрою / моделі",
      priceColLabel: "Стовпець ціни",
      partColLabel: "Стовпець номера деталі / SKU (необов'язково, покращує зіставлення)",
      currencyChoiceLabel: "Цей стовпець ціни в",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Використати це зіставлення",
      fxRateEurUsdLabel: "Курс EUR → USD",
      fxRateEurJpyLabel: "Курс EUR → JPY",
      sourceLabelFieldLabel: "Мітка джерела (показується в підказках значка)",
      sourceLabelPlaceholder: "Прайс-лист AXIS, місяць рік (аркуш All products)",
      coverageBySectionSummary: "Покриття за розділами",
      unmatchedSkusSummary: "Незіставлені SKU",
      applyButton: "Застосувати оновлення",
      revertButton: "Повернутися до вбудованих цін",
      privacyNoteText:
        "Усе обробляється локально у вашому браузері. Файл цін аналізується лише на цій сторінці й ніколи не залишає ваш пристрій. Єдиний мережевий запит, який робить ця сторінка, - це запит курсу обміну (EUR/USD, і за потреби EUR/JPY) до api.frankfurter.dev (референтні курси ЄЦБ, без API-ключа, без надсилання даних про камери чи ціни). Якщо цей запит не вдасться, ви можете ввести сьогоднішній курс(и) вручну.",
    },
    ar: {
      headerTitle: "4XS Toolbox — تحديث الأسعار الشهري",
      headerSubtitle:
        "أفلت قائمة أسعار AXIS (.xls) كل شهر لتحديث أسعار اليورو والأسعار المشتقة من سعر الصرف بالدولار الأمريكي/الين الياباني — دون الحاجة لإعادة التثبيت.",
      currentStatusHeading: "الحالة الحالية",
      favoritesHeading: "🧡 المفضلة",
      kofiHeading: "☕ ادعم هذا الامتداد",
      kofiText: "هذا الامتداد مشروع شخصي يُطوَّر في أوقات الفراغ — مجاني، بلا إعلانات، بلا تتبع. إذا وفّر عليك عناء البحث في قائمة الأسعار، فإن شراء قهوة لبافيل يساعد في استمرار صيانته وتحديثه. الأمر اختياري تمامًا وليس مطلوبًا أبدًا لاستخدام أي ميزة هنا.",
      favoritesEmpty: "لا توجد عناصر مفضلة بعد — انقر على ♡ على أي كاميرا في axis.com.",
      updatePricesHeading: "تحديث الأسعار",
      dropZoneInstructions: "أفلت قائمة أسعار (.xls/.xlsx) هنا، أو انقر لاختيار ملف",
      dropZoneHint:
        'يتم التعرف تلقائيًا على قائمة أسعار AXIS المعتادة (تقرأ ورقة "All products" التي تغطي جميع الفئات). يمكن ربط أعمدة أي ملف آخر يدويًا أدناه - بما في ذلك تحديد العملة (EUR/USD/JPY) التي يكون بها عمود السعر. لا يتم رفع أي شيء إلى أي مكان باستثناء الاستعلام عن سعر الصرف.',
      mappingCardHeading: "تهيئة الأعمدة",
      mappingHintText: "لم يتم التعرف على تنسيق هذا الملف تلقائيًا. اختر الورقة والأعمدة أدناه، وتحقق من المعاينة، ثم أكّد.",
      sheetLabel: "الورقة",
      headerRowLabel: "صف العنوان (رقم الصف)",
      nameColLabel: "عمود اسم الجهاز / الطراز",
      priceColLabel: "عمود السعر",
      partColLabel: "عمود رقم القطعة / SKU (اختياري، يحسّن المطابقة)",
      currencyChoiceLabel: "عمود السعر هذا بعملة",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "استخدام هذا الربط",
      fxRateEurUsdLabel: "سعر صرف EUR → USD",
      fxRateEurJpyLabel: "سعر صرف EUR → JPY",
      sourceLabelFieldLabel: "تسمية المصدر (تظهر في تلميحات الشارة)",
      sourceLabelPlaceholder: "قائمة أسعار AXIS، الشهر السنة (ورقة All products)",
      coverageBySectionSummary: "التغطية حسب القسم",
      unmatchedSkusSummary: "رموز SKU غير المطابقة",
      applyButton: "تطبيق التحديث",
      revertButton: "الرجوع إلى الأسعار المرفقة",
      privacyNoteText:
        "تتم معالجة كل شيء محليًا في متصفحك. يُحلَّل ملف الأسعار في هذه الصفحة فقط ولا يغادر جهازك أبدًا. الطلب الشبكي الوحيد الذي تجريه هذه الصفحة هو استعلام سعر الصرف (EUR/USD، وEUR/JPY عند الحاجة) إلى api.frankfurter.dev (أسعار الصرف المرجعية للبنك المركزي الأوروبي، دون مفتاح API، ودون إرسال بيانات كاميرات أو أسعار). إذا فشل هذا الاستعلام، يمكنك إدخال سعر (أسعار) اليوم يدويًا.",
    },
    nl: {
      headerTitle: "4XS Toolbox — Maandelijkse prijsupdate",
      headerSubtitle:
        "Sleep elke maand de AXIS-prijslijst (.xls) hierheen om EUR- en via wisselkoers afgeleide USD/JPY-prijzen bij te werken — geen herinstallatie nodig.",
      currentStatusHeading: "Huidige status",
      favoritesHeading: "🧡 Favorieten",
      kofiHeading: "☕ Steun deze extensie",
      kofiText:
        "Deze extensie is een eenmansproject in vrije tijd — gratis, zonder advertenties, zonder tracking. Als het je een gang naar de prijslijst bespaart, help je met een kopje koffie voor Pavel het onderhoud en de updates te ondersteunen. Volledig optioneel en nooit vereist om een functie hier te gebruiken.",
      favoritesEmpty: "Nog geen favorieten — klik op ♡ bij een camera op axis.com.",
      updatePricesHeading: "Prijzen bijwerken",
      dropZoneInstructions: "Sleep hier een prijslijst (.xls/.xlsx) naartoe, of klik om een bestand te kiezen",
      dropZoneHint:
        'De gebruikelijke AXIS-prijslijst wordt automatisch herkend (leest het tabblad "All products", dat alle categorieën omvat). Kolommen van een ander bestand kunnen hieronder handmatig worden toegewezen - inclusief opgeven in welke valuta (EUR/USD/JPY) de prijskolom staat. Er wordt nergens iets geüpload, behalve een opvraging van de wisselkoers.',
      mappingCardHeading: "Kolommen instellen",
      mappingHintText:
        "De indeling van dit bestand is niet automatisch herkend. Kies hieronder het tabblad en de kolommen, controleer de voorbeeldweergave en bevestig dan.",
      sheetLabel: "Tabblad",
      headerRowLabel: "Kopregel (rijnummer)",
      nameColLabel: "Kolom met apparaatnaam/model",
      priceColLabel: "Prijskolom",
      partColLabel: "Kolom met onderdeel-/SKU-nummer (optioneel, verbetert de koppeling)",
      currencyChoiceLabel: "Deze prijskolom staat in",
      currencyEurOption: "€ EUR",
      currencyUsdOption: "$ USD",
      currencyJpyOption: "¥ JPY",
      useMappingBtn: "Deze toewijzing gebruiken",
      fxRateEurUsdLabel: "Koers EUR → USD",
      fxRateEurJpyLabel: "Koers EUR → JPY",
      sourceLabelFieldLabel: "Bronlabel (getoond in badge-tooltips)",
      sourceLabelPlaceholder: "AXIS-prijslijst, maand jaar (tabblad All products)",
      coverageBySectionSummary: "Dekking per sectie",
      unmatchedSkusSummary: "Niet-gekoppelde SKU's",
      applyButton: "Update toepassen",
      revertButton: "Terug naar meegeleverde prijzen",
      privacyNoteText:
        "Alles wordt lokaal in je browser verwerkt. Het prijsbestand wordt alleen op deze pagina geanalyseerd en verlaat nooit je computer. Het enige netwerkverzoek dat deze pagina doet, is een opvraging van de wisselkoers (EUR/USD, en indien nodig EUR/JPY) bij api.frankfurter.dev (ECB-referentiekoersen, geen API-sleutel, geen camera- of prijsgegevens verzonden). Als die opvraging mislukt, kun je de koers(en) van vandaag handmatig invoeren.",
    },
  };
  // Which language (among the nine above) the popup's flag picker last set,
  // resolved once at startup - "en"/"ja" (or anything unrecognized/unset)
  // just leaves basicLang null, so t() below falls through to the existing
  // English/Japanese behavior untouched.
  let basicLang = null;
  function tBasic(key, enFallback) {
    if (!basicLang) return enFallback;
    const v = BASIC_TRANSLATIONS[basicLang] && BASIC_TRANSLATIONS[basicLang][key];
    return v === undefined ? enFallback : v;
  }
  function t(key, enFallback, ...args) {
    if (!isJa()) return tBasic(key, enFallback);
    const v = JA[key];
    if (v === undefined) return enFallback;
    return typeof v === "function" ? v(...args) : v;
  }

  // ---------------------------------------------------------------------
  // Matching logic - deliberately mirrors the Python merge script used to
  // build the bundled catalog, so a self-service monthly update reproduces
  // the same coverage (part-number join, then a normalized-name-prefix
  // fallback for the handful of PTZ SKUs whose EU/US part numbers differ
  // for 50Hz/60Hz regional variants). Operates on generic {name, part,
  // price} rows - the caller decides whether `price` means EUR or USD.
  // ---------------------------------------------------------------------

  function cleanPart(p) {
    if (!p) return null;
    p = String(p).trim();
    return p.replace(/\s*\(.*?\)\s*$/, ""); // strip trailing "(N pcs)" bulk-pack suffixes
  }

  function normalizeName(name) {
    name = (name || "").toUpperCase();
    name = name.replace(/AXIS /g, "");
    name = name.replace(/[^\w\s]/g, " ");
    name = name.replace(/\s+/g, " ").trim();
    return name;
  }

  function colLetter(idx) {
    let s = "";
    idx = idx + 1;
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }

  // ---------------------------------------------------------------------
  // Auto-detection: recognizes the AXIS Price List's normal shape (a
  // sheet called "All products" or "Camera", with a title row then a header
  // row containing "Product Name" / "MSRP" style headers) without any user
  // interaction. Anything that doesn't match falls through to the manual
  // column-mapping UI below.
  // ---------------------------------------------------------------------

  function guessHeaderRow(rows2d) {
    let bestIdx = 0,
      bestScore = -1;
    const limit = Math.min(15, rows2d.length);
    for (let i = 0; i < limit; i++) {
      const row = rows2d[i] || [];
      const score = row.filter((c) => typeof c === "string" && c.trim() !== "").length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function findColumn(headerRow, patterns) {
    for (const pat of patterns) {
      const idx = headerRow.findIndex((c) => typeof c === "string" && c.toLowerCase().includes(pat));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function detectCurrencyHint(rows2d) {
    const text = rows2d
      .slice(0, 3)
      .map((r) => (r || []).join(" "))
      .join(" ")
      .toUpperCase();
    if (text.includes("USD")) return "USD";
    if (text.includes("JPY") || text.includes("¥") || text.includes("YEN")) return "JPY";
    if (text.includes("EUR")) return "EUR";
    return null;
  }

  // Best-effort guess of the uploader's own currency, purely from the
  // browser/OS locale (not the page or catalog locale) - used only as a
  // fallback default for the currency radios/auto-detect when nothing else
  // (file header text, previously-stored lastCurrency) gives a better hint.
  const AMERICAS_REGIONS = [
    "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "CR", "DO", "GT", "EC",
    "UY", "PA", "BO", "PY", "SV", "HN", "NI", "VE", "PR",
  ];
  function guessSystemCurrency() {
    let locale = "";
    try {
      locale = (Intl && Intl.NumberFormat && Intl.NumberFormat().resolvedOptions().locale) || "";
    } catch (e) {
      /* ignore */
    }
    if (!locale && typeof navigator !== "undefined") locale = navigator.language || "";
    if (!locale) return "EUR";
    const parts = locale.split(/[-_]/);
    const lang = (parts[0] || "").toLowerCase();
    const region = (parts[1] || "").toUpperCase();
    if (lang === "ja" || region === "JP") return "JPY";
    if (AMERICAS_REGIONS.includes(region)) return "USD";
    return "EUR";
  }

  const NAME_PATTERNS = ["product name", "name", "model"];
  const PRICE_PATTERNS = ["msrp", "price"];
  const PART_PATTERNS = ["product number", "part number", "part no", "sku", "part"];

  function tryAutoDetect(workbook) {
    const priority = ["all products", "camera"];
    const orderedSheetNames = workbook.SheetNames.slice().sort((a, b) => {
      const ia = priority.indexOf(a.toLowerCase());
      const ib = priority.indexOf(b.toLowerCase());
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    for (const sheetName of orderedSheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
      if (rows2d.length < 2) continue;
      const headerRowIdx = guessHeaderRow(rows2d);
      const headerRow = (rows2d[headerRowIdx] || []).map((c) => (typeof c === "string" ? c : ""));
      const nameCol = findColumn(headerRow, NAME_PATTERNS);
      const priceCol = findColumn(headerRow, PRICE_PATTERNS);
      if (nameCol === -1 || priceCol === -1) continue;
      const partCol = findColumn(headerRow, PART_PATTERNS);
      const currency = detectCurrencyHint(rows2d) || fallbackCurrency();
      return { sheetName, headerRowIdx, nameCol, priceCol, partCol: partCol === -1 ? null : partCol, currency, auto: true };
    }
    return null;
  }

  function parseWithMapping(workbook, mapping) {
    const sheet = workbook.Sheets[mapping.sheetName];
    if (!sheet) throw new Error(t("errorSheetNotFound", 'Sheet "' + mapping.sheetName + '" not found in this file.', mapping.sheetName));
    const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const rows = [];
    for (let r = mapping.headerRowIdx + 1; r < rows2d.length; r++) {
      const row = rows2d[r];
      if (!row) continue;
      const name = row[mapping.nameCol];
      const price = row[mapping.priceCol];
      const part = mapping.partCol != null ? row[mapping.partCol] : null;
      if (!name) continue;
      if (typeof price !== "number") continue;
      rows.push({ name: String(name).trim(), part: part != null ? String(part).trim() : null, price });
    }
    if (rows.length === 0) {
      throw new Error(t("errorNoPricedRows", "No priced rows found with this column mapping - double-check the sheet, header row, and columns."));
    }
    return rows;
  }

  function prefixFallback(modelKey, normRows) {
    const nk = normalizeName(modelKey);
    let min = null;
    for (const { normName, price } of normRows) {
      if (normName.startsWith(nk) || nk.startsWith(normName)) {
        if (min === null || price < min) min = price;
      }
    }
    return min;
  }

  // Any uploaded row whose part number doesn't belong to a catalog SKU we
  // already know about (bundled catalog + whatever's already been added by a
  // previous update) describes a product this extension has never seen -
  // most often something Axis introduced after this extension version was
  // built. Rather than silently dropping it (or requiring a new extension
  // release before it can show a price), it's captured here and, once
  // applied, added to the live catalog under a clearly-labeled synthetic
  // section so it's obviously distinct from the curated PDF-sourced entries.
  // This runs the same way regardless of whether the uploaded file is priced
  // in EUR, USD, or JPY - only runMerge's caller (materializeNewProducts)
  // cares which currency the raw `price` values are in.
  const NEW_PRODUCTS_SECTION = "New products (auto-added)";

  function runMerge(rows) {
    const partToPrice = new Map();
    for (const { part, price } of rows) {
      const cp = cleanPart(part);
      if (!cp) continue;
      if (!partToPrice.has(cp) || price < partToPrice.get(cp)) partToPrice.set(cp, price);
    }
    const normRows = rows.map((r) => ({ normName: normalizeName(r.name), price: r.price }));

    const overrides = {};
    let partMatched = 0,
      fallbackMatched = 0,
      totalVariants = 0;
    const unmatched = [];
    const sectionStats = {};
    const knownParts = new Set();

    for (const modelKey in MODELS) {
      for (const v of MODELS[modelKey]) {
        totalVariants++;
        const section = v.section || "(unlabeled section)";
        if (!sectionStats[section]) sectionStats[section] = [0, 0];
        sectionStats[section][1]++;

        const part = cleanPart(v.part_number);
        if (part) knownParts.add(part);
        const direct = part ? partToPrice.get(part) : undefined;
        let newPrice = null,
          matched = false;

        if (direct !== undefined) {
          newPrice = direct;
          matched = true;
          partMatched++;
        } else {
          const fb = prefixFallback(modelKey, normRows);
          if (fb !== null) {
            newPrice = fb;
            matched = true;
            fallbackMatched++;
          }
        }

        if (matched && v.part_number) {
          overrides[v.part_number] = { value: newPrice };
          sectionStats[section][0]++;
        } else if (!matched) {
          unmatched.push({ modelKey, part: v.part_number, section });
        }
      }
    }

    // Also merge in whatever a previous update already added, so re-running
    // an update (or uploading the same file twice) doesn't treat already-added
    // products as new again, and doesn't lose them if this upload doesn't
    // happen to mention them.
    if (typeof lastKnownNewProducts === "object" && lastKnownNewProducts) {
      for (const key in lastKnownNewProducts) {
        for (const v of lastKnownNewProducts[key]) {
          if (v.part_number) knownParts.add(cleanPart(v.part_number));
        }
      }
    }

    const newProducts = {};
    const seenNewParts = new Set();
    for (const { name, part, price } of rows) {
      const cp = cleanPart(part);
      if (!cp || knownParts.has(cp) || seenNewParts.has(cp)) continue;
      seenNewParts.add(cp);
      if (!newProducts[name]) newProducts[name] = [];
      newProducts[name].push({ part_number: cp, value: price });
    }

    return {
      overrides,
      partMatched,
      fallbackMatched,
      unmatched,
      sectionStats,
      totalVariants,
      sourceRowCount: rows.length,
      newProducts,
    };
  }

  // Converts the generic { part_number, value } list built above into the
  // same variant-object shape used throughout MODELS (see catalog-data.js),
  // tagged with a `note` explaining where it came from. Mirrors
  // materializeOverrides' currency handling exactly.
  function materializeNewProducts(newProducts, currency, rates, sourceLabel) {
    const note = "Added automatically from an uploaded price list update" + (sourceLabel ? " (" + sourceLabel + ")" : "") + ".";
    const out = {};
    for (const name in newProducts) {
      out[name] = newProducts[name].map(({ part_number, value }) => {
        let msrp, msrp_eur;
        if (currency === "USD") {
          msrp = Math.round(value);
        } else if (currency === "JPY") {
          const eur = value / rates.eurJpy;
          msrp_eur = Math.round(eur * 100) / 100;
          msrp = Math.round(eur * rates.eurUsd);
        } else {
          msrp_eur = value;
          msrp = Math.round(value * rates.eurUsd);
        }
        const entry = {
          variant: null,
          part_number,
          msrp,
          msrp_display: "$" + msrp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          note,
          section: NEW_PRODUCTS_SECTION,
          group: null,
        };
        if (msrp_eur !== undefined) entry.msrp_eur = msrp_eur;
        return entry;
      });
    }
    return out;
  }

  // Turns the generic { value } overrides into concrete catalog fields.
  // EUR source: msrp_eur = value, msrp = FX-derived via eurUsd. USD source:
  // msrp = value directly (no FX involved), msrp_eur is left untouched on
  // the catalog side (the override simply won't carry that key). JPY
  // source: value is JPY, first converted to EUR via eurJpy (JPY per 1
  // EUR), then msrp (USD) derived from that EUR figure via eurUsd, same as
  // the EUR-source path - this file's own catalog format has no separate
  // "msrp_jpy" field, JPY is always displayed live (see content.js/popup.js).
  function materializeOverrides(overrides, currency, rates) {
    for (const key in overrides) {
      const value = overrides[key].value;
      if (currency === "USD") {
        const usd = Math.round(value);
        overrides[key] = {
          msrp: usd,
          msrp_display: "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          msrp_exact: true,
        };
      } else if (currency === "JPY") {
        const eur = value / rates.eurJpy;
        const usd = Math.round(eur * rates.eurUsd);
        overrides[key] = {
          msrp_eur: Math.round(eur * 100) / 100,
          msrp: usd,
          msrp_display: "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          msrp_exact: false,
        };
      } else {
        const usd = Math.round(value * rates.eurUsd);
        overrides[key] = {
          msrp_eur: value,
          msrp: usd,
          msrp_display: "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          msrp_exact: false,
        };
      }
    }
  }

  async function fetchFxRate() {
    const resp = await fetch(FX_ENDPOINT);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    if (!data || !data.rates || typeof data.rates.USD !== "number" || typeof data.rates.JPY !== "number") {
      throw new Error("Unexpected response shape from " + FX_ENDPOINT);
    }
    return { eurUsd: data.rates.USD, eurJpy: data.rates.JPY, date: data.date };
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------

  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const parseStatus = document.getElementById("parseStatus");
  const reportSection = document.getElementById("reportSection");
  const summaryEl = document.getElementById("summary");
  const sectionTableEl = document.getElementById("sectionTable");
  const unmatchedListEl = document.getElementById("unmatchedList");
  const fxRow = document.getElementById("fxRow");
  const fxRateInput = document.getElementById("fxRateInput");
  const fxRateJpyRow = document.getElementById("fxRateJpyRow");
  const fxRateJpyInput = document.getElementById("fxRateJpyInput");
  const fxSourceEl = document.getElementById("fxSource");
  const sourceLabelInput = document.getElementById("sourceLabelInput");
  const applyBtn = document.getElementById("applyBtn");
  const revertBtn = document.getElementById("revertBtn");
  const currentStatusEl = document.getElementById("currentStatus");

  const mappingCard = document.getElementById("mappingCard");
  const mappingHint = document.getElementById("mappingHint");
  const sheetSelect = document.getElementById("sheetSelect");
  const headerRowInput = document.getElementById("headerRowInput");
  const nameColSelect = document.getElementById("nameColSelect");
  const partColSelect = document.getElementById("partColSelect");
  const priceColSelect = document.getElementById("priceColSelect");
  const currencyEUR = document.getElementById("currencyEURRadio");
  const currencyUSD = document.getElementById("currencyUSDRadio");
  const currencyJPY = document.getElementById("currencyJPYRadio");
  const previewTable = document.getElementById("previewTable");
  const useMappingBtn = document.getElementById("useMappingBtn");

  let pendingMerge = null; // result of runMerge(), before FX/currency materialized
  let pendingCurrency = "EUR";
  let currentFx = null;
  let currentWorkbook = null;
  // Populated by initLastKnownCurrency() before drop-zone/file-input handlers
  // are wired, from chrome.storage.local's catalogOverride.lastCurrency (the
  // currency used the last time an update was applied). Used as a fallback
  // default ahead of guessSystemCurrency() when no file-header/preselect hint
  // is available.
  let lastKnownCurrency = null;
  // Products a previous update already added (see runMerge/materializeNewProducts
  // above), kept around so a later update doesn't re-flag them as new or drop
  // them if the newer file happens not to mention them.
  let lastKnownNewProducts = null;

  function fallbackCurrency() {
    return lastKnownCurrency || guessSystemCurrency();
  }

  function fmtDate(ts) {
    if (!ts) return t("neverDate", "never");
    return new Date(ts).toLocaleString();
  }

  function renderCurrentStatus() {
    chrome.storage.local.get(["catalogOverride"], (res) => {
      const ov = res.catalogOverride;
      // Remember the currency of the last applied update (if any) so that
      // reopening this page later defaults the currency guess to it, ahead
      // of falling back to a system-locale guess or plain "EUR".
      lastKnownCurrency = (ov && (ov.lastCurrency || ov.currency)) || lastKnownCurrency;
      lastKnownNewProducts = (ov && ov.newProducts) || lastKnownNewProducts;
      if (!ov) {
        // No monthly update has been applied - the extension already ships
        // with real, current-as-of-release prices baked into catalog-data.js
        // (not placeholder/empty data), so say exactly what that is rather
        // than a vague "bundled" message.
        const bundledSource = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.eur_source) || "the bundled price list";
        currentStatusEl.textContent = t(
          "currentStatusNoUpdate",
          "No monthly update applied - currently using the prices shipped with this extension version: " + bundledSource + ". This is the default until you drop a newer file below.",
          bundledSource
        );
        revertBtn.disabled = true;
      } else {
        const currencyNote =
          ov.currency === "USD"
            ? t("currencyNoteUsd", ", sourced directly in USD")
            : ov.currency === "JPY"
            ? t("currencyNoteJpy", ", sourced in JPY")
            : "";
        const when = fmtDate(ov.updatedAt);
        currentStatusEl.textContent = t(
          "currentStatusApplied",
          "Currently using: " + ov.sourceLabel + " — applied " + when +
            " (" + ov.matchedCount + "/" + ov.totalCount + " SKUs" + currencyNote + ").",
          ov.sourceLabel,
          when,
          ov.matchedCount,
          ov.totalCount,
          currencyNote
        );
        revertBtn.disabled = false;
      }
    });
  }
  renderCurrentStatus();

  function setParseStatus(msg, isError) {
    parseStatus.textContent = msg;
    parseStatus.classList.toggle("error", !!isError);
  }

  // ---- Manual mapping UI helpers ----

  function currentMappingFromUI() {
    return {
      sheetName: sheetSelect.value,
      headerRowIdx: Math.max(0, (parseInt(headerRowInput.value, 10) || 1) - 1),
      nameCol: nameColSelect.value === "" ? -1 : parseInt(nameColSelect.value, 10),
      priceCol: priceColSelect.value === "" ? -1 : parseInt(priceColSelect.value, 10),
      partCol: partColSelect.value === "" ? null : parseInt(partColSelect.value, 10),
      currency: currencyUSD.checked ? "USD" : currencyJPY.checked ? "JPY" : "EUR",
    };
  }

  function populateColumnSelects(rows2d, headerRowIdx, preselect) {
    const headerRow = (rows2d[headerRowIdx] || []).map((c) => (typeof c === "string" ? c : ""));
    const maxCols = Math.max(headerRow.length, ...rows2d.slice(0, 5).map((r) => (r || []).length));

    function fillSelect(sel, includeNone) {
      sel.innerHTML = "";
      if (includeNone) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = t("noneOption", "(none)");
        sel.appendChild(opt);
      }
      for (let c = 0; c < maxCols; c++) {
        const label = headerRow[c] ? headerRow[c].trim() : t("blankColumnLabel", "(blank)");
        const opt = document.createElement("option");
        opt.value = String(c);
        opt.textContent = colLetter(c) + ": " + label;
        sel.appendChild(opt);
      }
    }
    fillSelect(nameColSelect, false);
    fillSelect(priceColSelect, false);
    fillSelect(partColSelect, true);

    const nameGuess = preselect && preselect.nameCol != null && preselect.nameCol !== -1 ? preselect.nameCol : findColumn(headerRow, NAME_PATTERNS);
    const priceGuess = preselect && preselect.priceCol != null && preselect.priceCol !== -1 ? preselect.priceCol : findColumn(headerRow, PRICE_PATTERNS);
    const partGuess = preselect && preselect.partCol != null ? preselect.partCol : findColumn(headerRow, PART_PATTERNS);

    if (nameGuess !== -1) nameColSelect.value = String(nameGuess);
    if (priceGuess !== -1) priceColSelect.value = String(priceGuess);
    partColSelect.value = partGuess !== -1 && partGuess != null ? String(partGuess) : "";

    const currencyGuess = (preselect && preselect.currency) || detectCurrencyHint(rows2d) || fallbackCurrency();
    currencyEUR.checked = currencyGuess === "EUR";
    currencyUSD.checked = currencyGuess === "USD";
    currencyJPY.checked = currencyGuess === "JPY";
  }

  function renderPreview() {
    if (!currentWorkbook) return;
    const mapping = currentMappingFromUI();
    previewTable.innerHTML = "";
    try {
      const rows = parseWithMapping(currentWorkbook, mapping).slice(0, 8);
      const table = document.createElement("table");
      table.innerHTML =
        "<tr><th>" + t("previewColName", "Name") + "</th><th>" + t("previewColPart", "Part #") + "</th><th>" +
        t("previewColPrice", "Price (" + mapping.currency + ")", mapping.currency) + "</th></tr>" +
        rows.map((r) => "<tr><td>" + r.name + "</td><td>" + (r.part || "") + "</td><td>" + r.price + "</td></tr>").join("");
      previewTable.appendChild(table);
    } catch (e) {
      previewTable.textContent = t("previewUnavailable", "Preview unavailable: " + e.message, e.message);
    }
  }

  function onSheetOrHeaderChange() {
    const sheet = currentWorkbook.Sheets[sheetSelect.value];
    const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const headerRowIdx = Math.max(0, (parseInt(headerRowInput.value, 10) || 1) - 1);
    populateColumnSelects(rows2d, headerRowIdx, null);
    renderPreview();
  }

  sheetSelect.addEventListener("change", () => {
    const sheet = currentWorkbook.Sheets[sheetSelect.value];
    const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    headerRowInput.value = String(guessHeaderRow(rows2d) + 1);
    onSheetOrHeaderChange();
  });
  headerRowInput.addEventListener("change", onSheetOrHeaderChange);
  [nameColSelect, partColSelect, priceColSelect].forEach((el) => el.addEventListener("change", renderPreview));
  [currencyEUR, currencyUSD, currencyJPY].forEach((el) => el.addEventListener("change", renderPreview));

  function showMappingUI(workbook, guess) {
    currentWorkbook = workbook;
    mappingCard.style.display = "";
    sheetSelect.innerHTML = "";
    workbook.SheetNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sheetSelect.appendChild(opt);
    });
    const initialSheet = (guess && guess.sheetName) || workbook.SheetNames[0];
    sheetSelect.value = initialSheet;
    const sheet = workbook.Sheets[initialSheet];
    const rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const headerRowIdx = guess ? guess.headerRowIdx : guessHeaderRow(rows2d);
    headerRowInput.value = String(headerRowIdx + 1);
    populateColumnSelects(rows2d, headerRowIdx, guess);
    renderPreview();
  }

  async function finalizeMerge(rows, currency, sourceDescription) {
    pendingCurrency = currency;
    pendingMerge = runMerge(rows);

    if (currency === "EUR" || currency === "JPY") {
      setParseStatus(
        currency === "JPY"
          ? t("parseStatusFetchingRateEurUsdJpy", "Fetching today's EUR/USD and EUR/JPY rate…")
          : t("parseStatusFetchingRateEurUsd", "Fetching today's EUR/USD rate…"),
        false
      );
      let fx = null;
      try {
        fx = await fetchFxRate();
        fxSourceEl.textContent = t(
          "fxSourceAutoFetched",
          "auto-fetched from api.frankfurter.dev, ECB reference rate for " + fx.date,
          fx.date
        );
      } catch (e) {
        fx = { eurUsd: 1.1, eurJpy: 160, date: null };
        fxSourceEl.textContent = t(
          "fxSourceAutoFetchFailed",
          "auto-fetch failed (" + e.message + ") - enter the rate(s) manually below.",
          e.message
        );
      }
      currentFx = fx;
      fxRateInput.value = fx.eurUsd;
      fxRow.style.display = "";
      if (currency === "JPY") {
        fxRateJpyInput.value = fx.eurJpy;
        fxRateJpyRow.style.display = "";
      } else {
        fxRateJpyRow.style.display = "none";
      }
      materializeOverrides(pendingMerge.overrides, currency, { eurUsd: fx.eurUsd, eurJpy: fx.eurJpy });
      pendingMerge.materializedNewProducts = materializeNewProducts(pendingMerge.newProducts, currency, { eurUsd: fx.eurUsd, eurJpy: fx.eurJpy }, sourceDescription);
    } else {
      fxRow.style.display = "none";
      fxRateJpyRow.style.display = "none";
      currentFx = null;
      materializeOverrides(pendingMerge.overrides, "USD", null);
      pendingMerge.materializedNewProducts = materializeNewProducts(pendingMerge.newProducts, "USD", null, sourceDescription);
    }

    if (!sourceLabelInput.value.trim()) {
      const now = new Date();
      sourceLabelInput.value = sourceDescription || "Price list uploaded " + now.toLocaleDateString();
    }

    renderReport(pendingMerge);
    setParseStatus(
      t(
        "parseStatusParsedRows",
        "Parsed " + pendingMerge.sourceRowCount + " priced rows (" + currency + ").",
        pendingMerge.sourceRowCount,
        currency
      ),
      false
    );
    applyBtn.disabled = false;
  }

  async function handleFile(file) {
    if (!file) return;
    applyBtn.disabled = true;
    reportSection.style.display = "none";
    mappingCard.style.display = "none";
    setParseStatus(t("parseStatusReading", "Reading " + file.name + "…", file.name), false);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array" });
      currentWorkbook = workbook;

      const auto = tryAutoDetect(workbook);
      if (auto) {
        const rows = parseWithMapping(workbook, auto);
        const now = new Date();
        const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
        const label = isJa()
          ? t("sourceLabelDefaultAuto", "", monthYear, auto.sheetName)
          : "AXIS Price List, " + monthYear + " (" + auto.sheetName + " sheet, auto-detected)";
        await finalizeMerge(rows, auto.currency, label);
      } else {
        setParseStatus(
          t(
            "parseStatusCouldntRecognize",
            "Couldn't automatically recognize the layout of " + file.name + " - configure the columns below, check the preview, then click \"Use this mapping\".",
            file.name
          ),
          true
        );
        showMappingUI(workbook, null);
      }
    } catch (e) {
      setParseStatus(t("parseStatusCouldntParseFile", "Couldn't parse this file: " + e.message, e.message), true);
      pendingMerge = null;
    }
  }

  useMappingBtn.addEventListener("click", async () => {
    if (!currentWorkbook) return;
    const mapping = currentMappingFromUI();
    if (mapping.nameCol === -1 || mapping.priceCol === -1) {
      setParseStatus(t("parseStatusPickColumns", "Pick both a name column and a price column before continuing."), true);
      return;
    }
    try {
      const rows = parseWithMapping(currentWorkbook, mapping);
      const now = new Date();
      const label = isJa()
        ? t("sourceLabelDefaultManual", "", mapping.sheetName, now.toLocaleDateString())
        : "Price list (" + mapping.sheetName + " sheet), manually mapped " + now.toLocaleDateString();
      await finalizeMerge(rows, mapping.currency, label);
    } catch (e) {
      setParseStatus(t("parseStatusCouldntParseMapping", "Couldn't parse with this mapping: " + e.message, e.message), true);
    }
  });

  function renderReport(merge) {
    reportSection.style.display = "";
    const matched = merge.partMatched + merge.fallbackMatched;
    let summary = t(
      "summaryLine",
      matched + " / " + merge.totalVariants + " catalog SKUs matched (" +
        merge.partMatched + " by part number, " + merge.fallbackMatched + " by name fallback). " +
        merge.unmatched.length + " unmatched.",
      matched,
      merge.totalVariants,
      merge.partMatched,
      merge.fallbackMatched,
      merge.unmatched.length
    );
    const newCount = Object.keys(merge.newProducts || {}).length;
    if (newCount > 0) {
      summary +=
        " " +
        t(
          "newProductsSummary",
          newCount + " product(s) in this file aren't in the catalog yet and will be added as new entries when you apply.",
          newCount
        );
    }
    summaryEl.textContent = summary;

    sectionTableEl.innerHTML = "";
    const sections = Object.entries(merge.sectionStats).sort((a, b) => b[1][1] - a[1][1]);
    for (const [section, [matchedInSection, totalInSection]] of sections) {
      const row = document.createElement("div");
      row.className = "section-row";
      row.innerHTML =
        "<span>" + section + "</span><span>" + matchedInSection + " / " + totalInSection + "</span>";
      sectionTableEl.appendChild(row);
    }

    unmatchedListEl.innerHTML = "";
    if (merge.unmatched.length === 0) {
      unmatchedListEl.textContent = t("unmatchedNone", "None.");
    } else {
      const shown = merge.unmatched.slice(0, 30);
      const noPartFallback = t("noPartNumberFallback", "no part #");
      for (const u of shown) {
        const li = document.createElement("div");
        li.className = "unmatched-row";
        li.textContent = u.modelKey + " (" + (u.part || noPartFallback) + ") — " + u.section;
        unmatchedListEl.appendChild(li);
      }
      if (merge.unmatched.length > shown.length) {
        const more = document.createElement("div");
        more.className = "unmatched-row muted";
        const remaining = merge.unmatched.length - shown.length;
        more.textContent = t("unmatchedMoreFormat", "…and " + remaining + " more.", remaining);
        unmatchedListEl.appendChild(more);
      }
    }
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(file);
  });
  fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

  applyBtn.addEventListener("click", () => {
    if (!pendingMerge) return;

    // If the source was EUR or JPY and the user tweaked the rate(s) after
    // parsing, re-materialize with the current field values before persisting.
    if (pendingCurrency === "EUR" || pendingCurrency === "JPY") {
      const usdRate = parseFloat(fxRateInput.value);
      if (!usdRate || usdRate <= 0) {
        setParseStatus(t("parseStatusEnterValidEurUsd", "Enter a valid EUR/USD rate before applying."), true);
        return;
      }
      let jpyRate = null;
      if (pendingCurrency === "JPY") {
        jpyRate = parseFloat(fxRateJpyInput.value);
        if (!jpyRate || jpyRate <= 0) {
          setParseStatus(t("parseStatusEnterValidEurJpy", "Enter a valid EUR/JPY rate before applying."), true);
          return;
        }
      }
      const ratesChanged =
        !currentFx || usdRate !== currentFx.eurUsd || (pendingCurrency === "JPY" && jpyRate !== currentFx.eurJpy);
      if (ratesChanged) {
        // Overrides already materialized once; if the user edited a rate,
        // recompute msrp_eur (JPY source only)/msrp/msrp_display from the
        // original uploaded value, which we still have in pendingMerge
        // before materializeOverrides ran... except materializeOverrides
        // mutates in place, so recompute from the currently stored msrp_eur
        // for EUR source, or re-derive for JPY source using the ratio of
        // the new/old JPY rate against the already-stored msrp_eur.
        for (const key in pendingMerge.overrides) {
          const ov = pendingMerge.overrides[key];
          if (ov.msrp_eur == null) continue;
          let eur = ov.msrp_eur;
          if (pendingCurrency === "JPY" && currentFx && currentFx.eurJpy) {
            // msrp_eur was computed as originalJpyValue / currentFx.eurJpy;
            // recover originalJpyValue, then reapply the new rate.
            eur = (eur * currentFx.eurJpy) / jpyRate;
            ov.msrp_eur = Math.round(eur * 100) / 100;
          }
          const usd = Math.round(eur * usdRate);
          ov.msrp = usd;
          ov.msrp_display = "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          // This branch only runs for EUR/JPY sources (see guard above), so the
          // resulting USD figure is always FX-derived, never an exact USD quote.
          ov.msrp_exact = false;
        }
        for (const name in pendingMerge.materializedNewProducts) {
          for (const np of pendingMerge.materializedNewProducts[name]) {
            if (np.msrp_eur == null) continue;
            let eur = np.msrp_eur;
            if (pendingCurrency === "JPY" && currentFx && currentFx.eurJpy) {
              eur = (eur * currentFx.eurJpy) / jpyRate;
              np.msrp_eur = Math.round(eur * 100) / 100;
            }
            const usd = Math.round(eur * usdRate);
            np.msrp = usd;
            np.msrp_display = "$" + usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        }
      }
    }

    // Fold in whatever a previous update already added, so applying this one
    // doesn't drop products this file's rows simply didn't happen to repeat.
    const mergedNewProducts = Object.assign({}, lastKnownNewProducts, pendingMerge.materializedNewProducts);

    const fallbackSourceLabel = isJa()
      ? t("sourceLabelFallbackOnApply", "", new Date().toLocaleDateString())
      : "Price list (uploaded " + new Date().toLocaleDateString() + ")";
    const record = {
      updatedAt: Date.now(),
      sourceLabel: sourceLabelInput.value.trim() || fallbackSourceLabel,
      currency: pendingCurrency,
      lastCurrency: pendingCurrency,
      fxRate: pendingCurrency === "EUR" || pendingCurrency === "JPY" ? parseFloat(fxRateInput.value) : null,
      fxRateJpy: pendingCurrency === "JPY" ? parseFloat(fxRateJpyInput.value) : null,
      fxDate: (currentFx && currentFx.date) || (pendingCurrency === "EUR" || pendingCurrency === "JPY" ? "manual entry" : null),
      matchedCount: pendingMerge.partMatched + pendingMerge.fallbackMatched,
      totalCount: pendingMerge.totalVariants,
      overrides: pendingMerge.overrides,
      newProducts: mergedNewProducts,
    };
    chrome.storage.local.set({ catalogOverride: record }, () => {
      lastKnownCurrency = pendingCurrency;
      lastKnownNewProducts = mergedNewProducts;
      const newCount = Object.keys(pendingMerge.materializedNewProducts || {}).length;
      setParseStatus(
        newCount > 0
          ? t(
              "parseStatusAppliedWithNew",
              "Applied, including " + newCount + " new product(s) not previously in this catalog. Product Selector, search badges, and the popup will pick this up immediately.",
              newCount
            )
          : t("parseStatusApplied", "Applied. Product Selector, search badges, and the popup will pick this up immediately."),
        false
      );
      renderCurrentStatus();
    });
  });

  revertBtn.addEventListener("click", () => {
    chrome.storage.local.remove("catalogOverride", () => {
      lastKnownNewProducts = null;
      setParseStatus(t("parseStatusReverted", "Reverted to the prices bundled with this extension version, including any auto-added new products."), false);
      renderCurrentStatus();
    });
  });

  // Match whichever theme the popup is currently using, for visual consistency.
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("axisMsrpTheme", (r) => {
      if (r.axisMsrpTheme) document.documentElement.setAttribute("data-theme", r.axisMsrpTheme);
    });
  }

  // ---------------------------------------------------------------------
  // Favorites - the reviewable/removable list of everything currently
  // favorited (♡ -> 🧡) on the Product Selector page, category/product
  // pages, search results, and the toolbar popup. This used to be a small
  // section inside the on-page Filters panel; it moved here so that panel
  // can stay focused on filtering, with the full list one gear-icon click
  // away instead. Shares the same "axisFavorites" chrome.storage.local key
  // as every other surface - clicking a row here removes it everywhere,
  // exactly like unfavoriting a card on the page itself would.
  // ---------------------------------------------------------------------
  const FAVORITES_KEY = "axisFavorites";
  let favorites = [];
  const favoritesListEl = document.getElementById("favoritesList");
  const favoritesEmptyEl = document.getElementById("favoritesEmpty");

  function renderFavoritesList() {
    favoritesListEl.innerHTML = "";
    const names = favorites.slice().sort((a, b) => a.localeCompare(b));
    if (!names.length) {
      favoritesEmptyEl.textContent = t("favoritesEmpty", "No favorites yet — click ♡ on any camera on axis.com.");
      favoritesEmptyEl.style.display = "";
      return;
    }
    favoritesEmptyEl.style.display = "none";
    names.forEach((bareName) => {
      const row = document.createElement("div");
      row.className = "favorites-row";
      const label = document.createElement("span");
      label.textContent = bareName;
      row.appendChild(label);
      const remove = document.createElement("span");
      remove.className = "favorites-row-remove";
      remove.textContent = "✕";
      row.appendChild(remove);
      row.addEventListener("click", () => {
        favorites = favorites.filter((n) => n !== bareName);
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [FAVORITES_KEY]: favorites });
        }
        renderFavoritesList();
      });
      favoritesListEl.appendChild(row);
    });
  }

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(FAVORITES_KEY, (r) => {
      if (Array.isArray(r[FAVORITES_KEY])) favorites = r[FAVORITES_KEY];
      renderFavoritesList();
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        // Picks up favorites toggled on axis.com or the popup while this
        // Settings page is open.
        if (changes[FAVORITES_KEY]) {
          favorites = Array.isArray(changes[FAVORITES_KEY].newValue) ? changes[FAVORITES_KEY].newValue : [];
          renderFavoritesList();
        }
      });
    }
  } else {
    renderFavoritesList();
  }

  // Static labels/headings/placeholders/button text that don't depend on any
  // live parse/apply state - applied once at startup and again whenever
  // isJapanese changes later.
  function applyStaticI18nLabels() {
    document.getElementById("headerTitle").textContent = t("headerTitle", "4XS Toolbox — Monthly price update");
    document.getElementById("headerSubtitle").textContent = t(
      "headerSubtitle",
      "Drop the AXIS Price List (.xls) each month to refresh EUR and FX-derived USD/JPY prices — no reinstall needed."
    );
    document.getElementById("currentStatusHeading").textContent = t("currentStatusHeading", "Current status");
    document.getElementById("favoritesHeading").textContent = t("favoritesHeading", "🧡 Favorites");
    renderFavoritesList(); // re-render so the empty-state message picks up the new language too
    document.getElementById("kofiHeading").textContent = t("kofiHeading", "☕ Support this extension");
    // Shown only for Ukrainian-language users, slightly larger than the
    // regular body copy so it stands out at a glance.
    document.getElementById("uaGreeting").style.display = basicLang === "uk" ? "" : "none";
    document.getElementById("kofiText").textContent = t(
      "kofiText",
      "This extension is a one-person, spare-time project — free to use, no ads, no tracking. If it saves you a trip to the price list, buying Pavel a coffee helps keep it maintained and updated. Entirely optional, and never required to use any feature here."
    );
    document.getElementById("updatePricesHeading").textContent = t("updatePricesHeading", "Update prices");
    document.getElementById("dropZoneInstructions").textContent = t(
      "dropZoneInstructions",
      "Drop a price list (.xls/.xlsx) here, or click to choose a file"
    );
    document.getElementById("dropZoneHint").textContent = t(
      "dropZoneHint",
      'The usual AXIS Price List is recognized automatically (reads the "All products" sheet, covering every category). Any other file\'s columns can be mapped by hand below - including telling us what currency (EUR/USD/JPY) its price column is in. Nothing is uploaded anywhere except an FX rate lookup.'
    );
    document.getElementById("mappingCardHeading").textContent = t("mappingCardHeading", "Configure columns");
    mappingHint.textContent = t(
      "mappingHintText",
      "This file's layout wasn't recognized automatically. Pick the sheet and columns below, check the preview, then confirm."
    );
    document.getElementById("sheetLabel").textContent = t("sheetLabel", "Sheet");
    document.getElementById("headerRowLabel").textContent = t("headerRowLabel", "Header row (row number)");
    document.getElementById("nameColLabel").textContent = t("nameColLabel", "Device name / model column");
    document.getElementById("priceColLabel").textContent = t("priceColLabel", "Price column");
    document.getElementById("partColLabel").textContent = t(
      "partColLabel",
      "Part / SKU number column (optional, improves matching)"
    );
    document.getElementById("currencyChoiceLabel").textContent = t("currencyChoiceLabel", "This price column is in");
    document.getElementById("currencyEurOption").textContent = t("currencyEurOption", "€ EUR");
    document.getElementById("currencyUsdOption").textContent = t("currencyUsdOption", "$ USD");
    document.getElementById("currencyJpyOption").textContent = t("currencyJpyOption", "¥ JPY");
    useMappingBtn.textContent = t("useMappingBtn", "Use this mapping");
    document.getElementById("fxRateEurUsdLabel").textContent = t("fxRateEurUsdLabel", "EUR → USD rate");
    document.getElementById("fxRateEurJpyLabel").textContent = t("fxRateEurJpyLabel", "EUR → JPY rate");
    document.getElementById("sourceLabelFieldLabel").textContent = t(
      "sourceLabelFieldLabel",
      "Source label (shown in badge tooltips)"
    );
    sourceLabelInput.placeholder = t("sourceLabelPlaceholder", "AXIS Price List, Month Year (All products sheet)");
    document.getElementById("coverageBySectionSummary").textContent = t("coverageBySectionSummary", "Coverage by section");
    document.getElementById("unmatchedSkusSummary").textContent = t("unmatchedSkusSummary", "Unmatched SKUs");
    applyBtn.textContent = t("applyButton", "Apply update");
    revertBtn.textContent = t("revertButton", "Revert to bundled prices");
    document.getElementById("privacyNoteText").textContent = t(
      "privacyNoteText",
      "Everything runs locally in your browser. The price file is parsed on this page only and never leaves your machine. " +
        "The only network request this page makes is an FX rate lookup (EUR/USD, and EUR/JPY if needed) to " +
        "api.frankfurter.dev (ECB reference rates, no API key, no camera or pricing data sent). If that lookup fails, " +
        "you can type in today's rate(s) manually."
    );
    renderCurrentStatus(); // re-render so the currency/never-date phrasing picks up the new language too
  }
  // Pick up whichever flag the popup's language picker last set (same
  // "axisPopupLang" key popup.js persists to) before the first render, so
  // this page opens already in the right language instead of flashing
  // English first. Only affects the nine BASIC_TRANSLATIONS languages -
  // "en"/"ja"/unset all leave basicLang null, per tBasic() above.
  function startI18n() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get("axisPopupLang", (r) => {
        if (r.axisPopupLang && BASIC_TRANSLATIONS[r.axisPopupLang]) basicLang = r.axisPopupLang;
        applyStaticI18nLabels();
      });
    } else {
      applyStaticI18nLabels();
    }
  }
  startI18n();
  if (typeof AxisI18N !== "undefined") {
    AxisI18N.onLanguageChange(applyStaticI18nLabels);
  }
})();
