(function () {
  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};

  // ---------------------------------------------------------------------
  // Localization - one flag-picked language, independent of the currency
  // toggle (picking a language never changes currency, and switching
  // currency never changes language - the two are unrelated settings that
  // happen to have lived in the same drawer before). Matches the language
  // list Axis itself supports across its products. English is the fallback
  // used directly from each t() call site rather than duplicated into a
  // table, so only the other ten languages need full entries below.
  //
  // Translation quality note: these are hardcoded here (no translation
  // service, no live fetching), written to the best of what's available in
  // this session. English, Czech, and Japanese are the most load-bearing for
  // this tool's actual userbase and were double-checked; Korean, Mandarin,
  // Ukrainian, and Arabic in particular would benefit from a native-speaker
  // pass before being fully relied on.
  // ---------------------------------------------------------------------
  const LANGS = [
    { code: "en", flag: "🇬🇧", name: "English" },
    { code: "cs", flag: "🇨🇿", name: "Čeština" },
    { code: "ja", flag: "🇯🇵", name: "日本語" },
    { code: "es", flag: "🇪🇸", name: "Español" },
    { code: "de", flag: "🇩🇪", name: "Deutsch" },
    { code: "fr", flag: "🇫🇷", name: "Français" },
    { code: "ko", flag: "🇰🇷", name: "한국어" },
    { code: "zh", flag: "🇨🇳", name: "简体中文" },
    { code: "sv", flag: "🇸🇪", name: "Svenska" },
    { code: "uk", flag: "🇺🇦", name: "Українська" },
    { code: "ar", flag: "🇸🇦", name: "العربية" },
    { code: "nl", flag: "🇳🇱", name: "Nederlands" },
  ];

  const FOOTER_EN =
    "Prices are Axis MSRP (list price), not street price. USD and EUR are both hardcoded from Axis's public price lists (the US and EE/EU comparison-table editions); a small number of US/Canada-only or 2N-branded SKUs have no EUR list price at all, so their EUR figure is estimated from USD at the current USD/EUR rate instead — shown with a \"~\" prefix so it reads as approximate. GBP and JPY have no list price of their own and are always converted live from USD (also \"~\"), using the current USD/GBP and USD/JPY reference rates (ECB, via api.frankfurter.dev), refreshed on the same weekly schedule as chipset data. Chipset info is sourced from CamStreamer's published app-compatibility list, not Axis. None of this refreshes automatically except chipset data and FX rates via the weekly background check or the Update button above.";

  const TRANSLATIONS = {
    cs: {
      languageLabel: "Jazyk",
      copyHint: "Kliknutím zkopírovat",
      countLabel: (models, skus) => `${models} modelů / ${skus} SKU načteno`,
      noMatches: "Žádné výsledky.",
      noEurData: "— (bez EUR ceny)",
      noRateYet: "— (kurz zatím nenačten)",
      currencyLabel: "Měna",
      currencyOffTitle: "Skrýt všechny ceny — čipset a filtr úhlu záběru zůstanou zachovány",
      fxLabel: "Kurzy (EUR→USD/GBP/JPY)",
      chipsetLabel: "Data o čipsetech (CamStreamer)",
      update: "Aktualizovat",
      updating: "Aktualizuji…",
      searchPlaceholder: "Hledat model nebo objednací číslo…",
      unavailable: "nedostupné",
      lastUpdateFailed: (msg) => `Poslední aktualizace selhala: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} modelů · aktualizováno ${when}`,
      updateFailed: (msg) => `Aktualizace selhala: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · aktualizováno ${when}`,
      notFetchedYet: "zatím nenačteno",
      fovMapBtnTitle: "Otevřít nástroj FOV Map na celou obrazovku",
      fovMapBtnText: "⛶ Celá obrazovka",
      catalogTabBtnText: "Čipset &\nMSRP",
      fovMapToggleBtnText: "FoV mapa\nnástroj",
      findCamsBtnText: "IP Utility\nskener",
      findCamsBtnTitle: "Prohledat místní síť a najít kamery Axis (model, sériové číslo, firmware, čipset)",
      findCamsHeading: "Kamery Axis v této síti",
      angleFieldLabel: "Požadované FoV",
      angleSliderTitle: "Zobrazit jen kamery pokrývající alespoň tento úhel - u PTZ se počítá celý rozsah otáčení, ne jen šířka objektivu. Stejný požadavek nastavuje i vykreslení kužele na mapě vlevo.",
      advancedBtnTitle: "Zobrazit/skrýt měnu, kurzy, informace o aktualizaci čipsetů, měsíční aktualizaci cen a poznámku k cenám",
      monthlyLabel: "NAHRÁT CENÍK .XLS",
      settingsBtnTitle: "Aktualizovat měsíční ceny",
      themeToggleTitle: "Přepnout světlý/tmavý motiv",
      kofiBtnTitle: "Koupit Pavlovi kávu — podpořit toto rozšíření",
      never: "nikdy",
      justNow: "právě teď",
      minAgo: (n) => `před ${n} min`,
      hAgo: (n) => `před ${n} h`,
      daysAgo: (n) => `před ${n} dny`,
      fovMapStepCamera: "Kliknutím na mapu umístíte polohu kamery.",
      fovMapStepEdge1: "Tažením od kamery nastavte jednu hranu požadovaného pokrytí.",
      fovMapStepEdge2: "Dalším tažením nastavte druhou hranu kužele.",
      fovMapStepDone: "Přetažením špendlíku nebo žluté úchytky změníte tvar - tažením dál za 180° otevřete kužel až do plného kruhu.",
      angleMatchSuffix: (n, deg) => `${n} odpovídá ≥${deg}°`,
      fovMapResultsHeading: "Vhodné modely",
      fovMapResultsIdle: "Nakreslete na mapě kužel a zobrazí se kamery, které jej pokryjí.",
      favToggleTitle: "Oblíbené - řadí se na začátek seznamu",
      footerDisclaimer:
        "Ceny jsou doporučené maloobchodní ceny Axis (MSRP), nikoli skutečné prodejní ceny. Základem je veřejný srovnávací ceník Axis Q1/Q2 2026 (v USD). Malá skupina produktů – videorekordéry, paměťová média (SD karty, pevné disky) a několik modelů kamer – navíc obsahuje aktualizace cen v USD a EUR ze srpna 2026; cena v EUR se zobrazuje pouze u těchto aktualizovaných položek. Cena v JPY se přepočítává živě z USD podle aktuálního referenčního kurzu USD/JPY (ECB, přes api.frankfurter.dev) a aktualizuje se ve stejném týdenním cyklu jako data o čipsetech. Informace o čipsetech pocházejí ze zveřejněného seznamu kompatibility aplikací CamStreamer, nikoli od Axis. Nic z toho se neaktualizuje automaticky kromě dat o čipsetech a kurzů měn via týdenní kontrolu na pozadí nebo tlačítko Aktualizovat výše.",
      filterBtnText: "Filtr",
      filterBtnTitle: "Filtrovat podle čipsetu a změnit řazení",
      filterSortHeading: "Řadit podle",
      sortModeFit: "Nejlepší shoda",
      sortModePriceAsc: "Cena — od nejnižší",
      sortModePriceDesc: "Cena — od nejvyšší",
      sortModeFovDesc: "FoV — nejširší první",
      filterChipsetHeading: "Čipset",
      filterSelectAll: "Vybrat vše",
      filterClear: "Zrušit",
      categoryLinkTitle: "Otevřít tuto kategorii produktů Axis",
    },
    ja: {
      languageLabel: "言語",
      copyHint: "クリックでコピー",
      countLabel: (models, skus) => `${models} モデル / ${skus} SKU 読み込み済み`,
      noMatches: "一致する結果がありません。",
      noEurData: "— (EURデータなし)",
      noRateYet: "— (レート未取得)",
      currencyLabel: "通貨",
      currencyOffTitle: "価格をすべて非表示 — チップセット情報と画角フィルターは維持",
      fxLabel: "為替レート (EUR→USD/GBP/JPY)",
      chipsetLabel: "チップセットデータ (CamStreamer)",
      update: "更新",
      updating: "更新中…",
      searchPlaceholder: "モデル名または型番で検索…",
      unavailable: "利用不可",
      lastUpdateFailed: (msg) => `前回の更新に失敗しました: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} モデル · ${when}に更新`,
      updateFailed: (msg) => `更新に失敗しました: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · ${when}に更新`,
      notFetchedYet: "まだ取得していません",
      fovMapBtnTitle: "フルスクリーンのFOVマップツールを開く",
      fovMapBtnText: "⛶ フルスクリーン",
      catalogTabBtnText: "チップセット\n& MSRP",
      fovMapToggleBtnText: "FoVマップ\nツール",
      findCamsBtnText: "IP Utility\nスキャナー",
      findCamsBtnTitle: "ローカルネットワークをスキャンしてAxisカメラを検索(モデル、シリアル、ファームウェア、チップセット)",
      findCamsHeading: "このネットワーク上のAxisカメラ",
      angleFieldLabel: "必要FoV",
      angleSliderTitle: "この角度以上をカバーできるカメラのみ表示します(PTZはパン動作による360°全周対応も含みます)。左側の地図でコーンを描いた場合と同じ条件です",
      advancedBtnTitle: "言語、通貨、為替レート、チップセット更新情報、月次価格更新、価格に関する注記の表示/非表示",
      monthlyLabel: "月次価格表(.xls)をアップロード",
      settingsBtnTitle: "月次価格を更新",
      themeToggleTitle: "ライト/ダークテーマを切り替え",
      kofiBtnTitle: "Pavelにコーヒーを一杯 — この拡張機能を応援する",
      never: "未取得",
      justNow: "たった今",
      minAgo: (n) => `${n}分前`,
      hAgo: (n) => `${n}時間前`,
      daysAgo: (n) => `${n}日前`,
      fovMapStepCamera: "地図をクリックしてカメラの位置をピン留めします。",
      fovMapStepEdge1: "カメラからドラッグして、必要なカバー範囲の一方の端を設定します。",
      fovMapStepEdge2: "もう一度ドラッグしてコーンの反対側の端を設定します。",
      fovMapStepDone: "ピンまたは黄色のハンドルをドラッグして形を調整できます - 180°を超えて全周まで開くにはさらに外側にドラッグしてください。",
      angleMatchSuffix: (n, deg) => `${deg}°以上に対応する${n}件`,
      fovMapResultsHeading: "適合するモデル",
      fovMapResultsIdle: "地図上にコーンを描くと、それをカバーできるカメラが表示されます。",
      favToggleTitle: "お気に入り - リストの一番上に表示されます",
      footerDisclaimer:
        "価格はAxisのMSRP(希望小売価格)であり、実売価格ではありません。基準となるのはAxisが公開しているQ1/Q2 2026比較表の価格表(USD)です。ごく一部の製品(ビデオレコーダー、ストレージメディア[SDカード、ハードドライブ]、および数機種のカメラ)については、2026年8月のUSDおよびEUR価格更新が反映されています。EUR価格はこれらの更新対象製品にのみ表示されます。JPY価格は、現在のUSD/JPY参照レート(ECB、api.frankfurter.dev経由)を使ってUSD価格からリアルタイムに換算されており、チップセット情報と同じ週次スケジュールで更新されます。チップセット情報はAxisではなくCamStreamerが公開しているアプリ対応リストが出典です。これらはチップセットデータとFXレートが週次のバックグラウンドチェックまたは上のUpdateボタンで更新される以外、自動的には更新されません。",
      filterBtnText: "フィルター",
      filterBtnTitle: "チップセットで絞り込み、並び順を変更",
      filterSortHeading: "並び替え",
      sortModeFit: "最適な一致",
      sortModePriceAsc: "価格 — 安い順",
      sortModePriceDesc: "価格 — 高い順",
      sortModeFovDesc: "FoV — 広い順",
      filterChipsetHeading: "チップセット",
      filterSelectAll: "すべて選択",
      filterClear: "クリア",
      categoryLinkTitle: "このAxis製品カテゴリを開く",
    },
    es: {
      languageLabel: "Idioma",
      copyHint: "Clic para copiar",
      countLabel: (models, skus) => `${models} modelos / ${skus} SKU cargados`,
      noMatches: "Sin resultados.",
      noEurData: "— (sin precio en EUR)",
      noRateYet: "— (tipo de cambio no disponible)",
      currencyLabel: "Moneda",
      currencyOffTitle: "Ocultar todos los precios — se mantiene el chipset y el filtro de ángulo",
      fxLabel: "Tipos de cambio (EUR→USD/GBP/JPY)",
      chipsetLabel: "Datos de chipset (CamStreamer)",
      update: "Actualizar",
      updating: "Actualizando…",
      searchPlaceholder: "Buscar modelo o número de referencia…",
      unavailable: "no disponible",
      lastUpdateFailed: (msg) => `La última actualización falló: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} modelos · actualizado ${when}`,
      updateFailed: (msg) => `Error al actualizar: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · actualizado ${when}`,
      notFetchedYet: "aún no obtenido",
      fovMapBtnTitle: "Abrir la herramienta FOV Map a pantalla completa",
      fovMapBtnText: "⛶ Pantalla completa",
      catalogTabBtnText: "Chipset &\nMSRP",
      fovMapToggleBtnText: "Mapa FoV\nHerramienta",
      findCamsBtnText: "IP Utility\nEscáner",
      findCamsBtnTitle: "Escanea tu red local en busca de cámaras Axis (modelo, número de serie, firmware, chipset)",
      findCamsHeading: "Cámaras Axis en esta red",
      angleFieldLabel: "FoV requerido",
      angleSliderTitle: "Mostrar solo cámaras que cubran al menos este ángulo - en las PTZ cuenta todo el recorrido de giro, no solo el ancho óptico. Es el mismo requisito que fija dibujar un cono en el mapa de la izquierda.",
      advancedBtnTitle: "Mostrar/ocultar idioma, moneda, tipos de cambio, datos de chipset, actualización mensual de precios y el aviso de precios",
      monthlyLabel: "SUBIR LISTA DE PRECIOS .XLS",
      settingsBtnTitle: "Actualizar precios mensuales",
      themeToggleTitle: "Cambiar entre tema claro/oscuro",
      kofiBtnTitle: "Invita a Pavel a un café — apoya esta extensión",
      never: "nunca",
      justNow: "ahora mismo",
      minAgo: (n) => `hace ${n} min`,
      hAgo: (n) => `hace ${n} h`,
      daysAgo: (n) => `hace ${n} días`,
      fovMapStepCamera: "Haz clic en el mapa para colocar la cámara.",
      fovMapStepEdge1: "Arrastra desde la cámara para fijar un borde de la cobertura requerida.",
      fovMapStepEdge2: "Arrastra de nuevo para fijar el otro borde del cono.",
      fovMapStepDone: "Arrastra el pin o cualquiera de las asas amarillas para ajustar la forma - sigue arrastrando hacia fuera para abrir más de 180° hasta un círculo completo.",
      angleMatchSuffix: (n, deg) => `${n} coinciden con ≥${deg}°`,
      fovMapResultsHeading: "Modelos compatibles",
      fovMapResultsIdle: "Dibuja un cono en el mapa para ver las cámaras que lo cubren.",
      favToggleTitle: "Favorito - se ordena al principio de la lista",
      footerDisclaimer:
        "Los precios son el PVP recomendado por Axis (MSRP), no el precio de venta real. La base es la lista de precios pública comparativa de Axis para el Q1/Q2 2026 (en USD). Un pequeño grupo de productos —grabadores de vídeo, medios de almacenamiento (tarjetas SD, discos duros) y algunos modelos de cámara— incluye además actualizaciones de precio de agosto de 2026 en USD y EUR; el precio en EUR solo se muestra para esos artículos actualizados. El precio en JPY se convierte en tiempo real desde el USD usando el tipo de cambio de referencia USD/JPY actual (BCE, vía api.frankfurter.dev), actualizado con la misma frecuencia semanal que los datos de chipset. La información de chipset procede de la lista de compatibilidad publicada por CamStreamer, no de Axis. Nada de esto se actualiza automáticamente salvo los datos de chipset y los tipos de cambio, mediante la comprobación semanal en segundo plano o el botón Actualizar de arriba.",
      filterBtnText: "Filtro",
      filterBtnTitle: "Filtrar por chipset y cambiar el orden",
      filterSortHeading: "Ordenar por",
      sortModeFit: "Mejor ajuste",
      sortModePriceAsc: "Precio — de menor a mayor",
      sortModePriceDesc: "Precio — de mayor a menor",
      sortModeFovDesc: "FoV — el más amplio primero",
      filterChipsetHeading: "Chipset",
      filterSelectAll: "Seleccionar todo",
      filterClear: "Borrar",
      categoryLinkTitle: "Abrir esta categoría de productos de Axis",
    },
    de: {
      languageLabel: "Sprache",
      copyHint: "Zum Kopieren klicken",
      countLabel: (models, skus) => `${models} Modelle / ${skus} SKUs geladen`,
      noMatches: "Keine Treffer.",
      noEurData: "— (keine EUR-Daten)",
      noRateYet: "— (Kurs noch nicht abgerufen)",
      currencyLabel: "Währung",
      currencyOffTitle: "Alle Preise ausblenden — Chipset-Info und Blickwinkel-Filter bleiben erhalten",
      fxLabel: "Wechselkurse (EUR→USD/GBP/JPY)",
      chipsetLabel: "Chipsatzdaten (CamStreamer)",
      update: "Aktualisieren",
      updating: "Aktualisiere…",
      searchPlaceholder: "Modell oder Artikelnummer suchen…",
      unavailable: "nicht verfügbar",
      lastUpdateFailed: (msg) => `Letzte Aktualisierung fehlgeschlagen: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} Modelle · aktualisiert ${when}`,
      updateFailed: (msg) => `Aktualisierung fehlgeschlagen: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · aktualisiert ${when}`,
      notFetchedYet: "noch nicht abgerufen",
      fovMapBtnTitle: "FOV-Map-Tool im Vollbild öffnen",
      fovMapBtnText: "⛶ Vollbild",
      catalogTabBtnText: "Chipset &\nMSRP",
      fovMapToggleBtnText: "FoV-Karte\nWerkzeug",
      findCamsBtnText: "IP Utility\nScanner",
      findCamsBtnTitle: "Durchsucht Ihr lokales Netzwerk nach Axis-Kameras (Modell, Seriennummer, Firmware, Chipsatz)",
      findCamsHeading: "Axis-Kameras in diesem Netzwerk",
      angleFieldLabel: "Erforderliches FoV",
      angleSliderTitle: "Zeigt nur Kameras, die mindestens diesen Winkel abdecken - bei PTZ zählt der volle Schwenkbereich, nicht nur die Objektivbreite. Gleiche Anforderung wie beim Zeichnen eines Kegels auf der Karte links.",
      advancedBtnTitle: "Sprache, Währung, Wechselkurse, Chipsatz-Aktualisierung, monatliches Preisupdate und den Preishinweis ein-/ausblenden",
      monthlyLabel: "XLS-PREISLISTE HOCHLADEN",
      settingsBtnTitle: "Monatliche Preise aktualisieren",
      themeToggleTitle: "Zwischen hellem/dunklem Design wechseln",
      kofiBtnTitle: "Pavel einen Kaffee spendieren — diese Erweiterung unterstützen",
      never: "nie",
      justNow: "gerade eben",
      minAgo: (n) => `vor ${n} Min.`,
      hAgo: (n) => `vor ${n} Std.`,
      daysAgo: (n) => `vor ${n} Tagen`,
      fovMapStepCamera: "Auf die Karte klicken, um die Kameraposition zu setzen.",
      fovMapStepEdge1: "Von der Kamera aus ziehen, um eine Kante des benötigten Abdeckungsbereichs festzulegen.",
      fovMapStepEdge2: "Erneut ziehen, um die andere Kante des Kegels festzulegen.",
      fovMapStepDone: "Stift oder einen der gelben Griffe ziehen, um die Form zu ändern - weiter nach außen ziehen, um über 180° bis zum Vollkreis zu öffnen.",
      angleMatchSuffix: (n, deg) => `${n} passend zu ≥${deg}°`,
      fovMapResultsHeading: "Passende Modelle",
      fovMapResultsIdle: "Zeichnen Sie einen Kegel auf der Karte, um die Kameras zu sehen, die ihn abdecken.",
      favToggleTitle: "Favorit - wird ganz oben in der Liste einsortiert",
      footerDisclaimer:
        "Die Preise entsprechen der unverbindlichen Preisempfehlung von Axis (MSRP), nicht dem Straßenpreis. Grundlage ist die öffentliche Axis-Vergleichspreisliste Q1/Q2 2026 (in USD). Eine kleine Gruppe von Produkten – Videorekorder, Speichermedien (SD-Karten, Festplatten) und einige Kameramodelle – enthält zusätzlich Preisaktualisierungen vom August 2026 in USD und EUR; der EUR-Preis wird nur bei diesen aktualisierten Artikeln angezeigt. Der JPY-Preis wird live aus dem USD-Preis anhand des aktuellen USD/JPY-Referenzkurses (EZB, über api.frankfurter.dev) umgerechnet und im selben wöchentlichen Rhythmus aktualisiert wie die Chipsatzdaten. Chipsatz-Infos stammen aus der veröffentlichten App-Kompatibilitätsliste von CamStreamer, nicht von Axis. Nichts davon aktualisiert sich automatisch, außer Chipsatzdaten und Wechselkurse über die wöchentliche Hintergrundprüfung oder die Schaltfläche Aktualisieren oben.",
      filterBtnText: "Filter",
      filterBtnTitle: "Nach Chipsatz filtern und die Sortierung ändern",
      filterSortHeading: "Sortieren nach",
      sortModeFit: "Beste Übereinstimmung",
      sortModePriceAsc: "Preis — aufsteigend",
      sortModePriceDesc: "Preis — absteigend",
      sortModeFovDesc: "FoV — größtes zuerst",
      filterChipsetHeading: "Chipsatz",
      filterSelectAll: "Alle auswählen",
      filterClear: "Zurücksetzen",
      categoryLinkTitle: "Diese Axis-Produktkategorie öffnen",
    },
    fr: {
      languageLabel: "Langue",
      copyHint: "Cliquer pour copier",
      countLabel: (models, skus) => `${models} modèles / ${skus} références chargées`,
      noMatches: "Aucun résultat.",
      noEurData: "— (pas de prix EUR)",
      noRateYet: "— (taux non récupéré)",
      currencyLabel: "Devise",
      currencyOffTitle: "Masquer tous les prix — les infos chipset et le filtre d'angle restent actifs",
      fxLabel: "Taux de change (EUR→USD/GBP/JPY)",
      chipsetLabel: "Données chipset (CamStreamer)",
      update: "Mettre à jour",
      updating: "Mise à jour…",
      searchPlaceholder: "Rechercher un modèle ou une référence…",
      unavailable: "indisponible",
      lastUpdateFailed: (msg) => `Échec de la dernière mise à jour : ${msg}`,
      chipsetStatusOk: (count, when) => `${count} modèles · mis à jour ${when}`,
      updateFailed: (msg) => `Échec de la mise à jour : ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · mis à jour ${when}`,
      notFetchedYet: "pas encore récupéré",
      fovMapBtnTitle: "Ouvrir l'outil FOV Map en plein écran",
      fovMapBtnText: "⛶ Plein écran",
      catalogTabBtnText: "Chipset &\nMSRP",
      fovMapToggleBtnText: "Carte FoV\nOutil",
      findCamsBtnText: "IP Utility\nScanner",
      findCamsBtnTitle: "Analyse votre réseau local à la recherche de caméras Axis (modèle, numéro de série, firmware, chipset)",
      findCamsHeading: "Caméras Axis sur ce réseau",
      angleFieldLabel: "FoV requis",
      angleSliderTitle: "N'affiche que les caméras couvrant au moins cet angle - pour les PTZ, c'est toute la plage de rotation qui compte, pas seulement la largeur optique. Même exigence que celle définie en dessinant un cône sur la carte à gauche.",
      advancedBtnTitle: "Afficher/masquer la langue, la devise, les taux de change, les infos chipset, la mise à jour mensuelle des prix et l'avertissement sur les prix",
      monthlyLabel: "IMPORTER LA LISTE DE PRIX .XLS",
      settingsBtnTitle: "Mettre à jour les prix mensuels",
      themeToggleTitle: "Basculer entre thème clair/sombre",
      kofiBtnTitle: "Offrir un café à Pavel — soutenir cette extension",
      never: "jamais",
      justNow: "à l'instant",
      minAgo: (n) => `il y a ${n} min`,
      hAgo: (n) => `il y a ${n} h`,
      daysAgo: (n) => `il y a ${n} jours`,
      fovMapStepCamera: "Cliquez sur la carte pour placer la caméra.",
      fovMapStepEdge1: "Faites glisser depuis la caméra pour fixer un bord de la couverture requise.",
      fovMapStepEdge2: "Faites glisser à nouveau pour fixer l'autre bord du cône.",
      fovMapStepDone: "Faites glisser l'épingle ou l'une des poignées jaunes pour ajuster la forme - continuez vers l'extérieur pour dépasser 180° jusqu'au cercle complet.",
      angleMatchSuffix: (n, deg) => `${n} correspondent à ≥${deg}°`,
      fovMapResultsHeading: "Modèles correspondants",
      fovMapResultsIdle: "Dessinez un cône sur la carte pour voir les caméras qui le couvrent.",
      favToggleTitle: "Favori - remonte en haut de la liste",
      footerDisclaimer:
        "Les prix correspondent au prix public conseillé par Axis (MSRP), et non au prix de vente réel. La base est la liste de prix comparative publique d'Axis pour le Q1/Q2 2026 (en USD). Un petit groupe de produits — enregistreurs vidéo, supports de stockage (cartes SD, disques durs) et quelques modèles de caméra — comporte en plus des mises à jour de prix d'août 2026 en USD et EUR ; le prix en EUR n'est affiché que pour ces articles mis à jour. Le prix en JPY est converti en direct à partir de l'USD selon le taux de référence USD/JPY actuel (BCE, via api.frankfurter.dev), mis à jour selon le même rythme hebdomadaire que les données chipset. Les infos chipset proviennent de la liste de compatibilité publiée par CamStreamer, pas d'Axis. Rien de tout cela ne se met à jour automatiquement, à l'exception des données chipset et des taux de change via la vérification hebdomadaire en arrière-plan ou le bouton Mettre à jour ci-dessus.",
      filterBtnText: "Filtre",
      filterBtnTitle: "Filtrer par chipset et changer le tri",
      filterSortHeading: "Trier par",
      sortModeFit: "Meilleure correspondance",
      sortModePriceAsc: "Prix — croissant",
      sortModePriceDesc: "Prix — décroissant",
      sortModeFovDesc: "FoV — le plus large d'abord",
      filterChipsetHeading: "Chipset",
      filterSelectAll: "Tout sélectionner",
      filterClear: "Effacer",
      categoryLinkTitle: "Ouvrir cette catégorie de produits Axis",
    },
    ko: {
      languageLabel: "언어",
      copyHint: "클릭하여 복사",
      countLabel: (models, skus) => `모델 ${models}개 / SKU ${skus}개 로드됨`,
      noMatches: "일치하는 결과가 없습니다.",
      noEurData: "— (EUR 가격 없음)",
      noRateYet: "— (환율 미수신)",
      currencyLabel: "통화",
      currencyOffTitle: "모든 가격 숨기기 — 칩셋 정보와 화각 필터는 유지됩니다",
      fxLabel: "환율 (EUR→USD/GBP/JPY)",
      chipsetLabel: "칩셋 데이터 (CamStreamer)",
      update: "업데이트",
      updating: "업데이트 중…",
      searchPlaceholder: "모델명 또는 부품 번호 검색…",
      unavailable: "사용 불가",
      lastUpdateFailed: (msg) => `마지막 업데이트 실패: ${msg}`,
      chipsetStatusOk: (count, when) => `모델 ${count}개 · ${when} 업데이트됨`,
      updateFailed: (msg) => `업데이트 실패: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · ${when} 업데이트됨`,
      notFetchedYet: "아직 가져오지 않음",
      fovMapBtnTitle: "전체 화면 FOV 맵 도구 열기",
      fovMapBtnText: "⛶ 전체 화면",
      catalogTabBtnText: "칩셋 &\nMSRP",
      fovMapToggleBtnText: "FoV 지도\n도구",
      findCamsBtnText: "IP Utility\n스캐너",
      findCamsBtnTitle: "로컬 네트워크에서 Axis 카메라를 검색합니다(모델, 일련번호, 펌웨어, 칩셋)",
      findCamsHeading: "이 네트워크의 Axis 카메라",
      angleFieldLabel: "필요 FoV",
      angleSliderTitle: "이 각도 이상을 커버할 수 있는 카메라만 표시합니다 - PTZ는 렌즈 폭이 아니라 팬 전체 범위가 기준입니다. 왼쪽 지도에서 원뿔을 그릴 때와 동일한 조건입니다.",
      advancedBtnTitle: "언어, 통화, 환율, 칩셋 업데이트 정보, 월간 가격 업데이트, 가격 안내 문구 표시/숨기기",
      monthlyLabel: "XLS 가격표 업로드",
      settingsBtnTitle: "월간 가격 업데이트",
      themeToggleTitle: "라이트/다크 테마 전환",
      kofiBtnTitle: "Pavel에게 커피 한 잔 사주기 — 이 확장 프로그램 후원",
      never: "없음",
      justNow: "방금 전",
      minAgo: (n) => `${n}분 전`,
      hAgo: (n) => `${n}시간 전`,
      daysAgo: (n) => `${n}일 전`,
      fovMapStepCamera: "지도를 클릭해 카메라 위치를 지정하세요.",
      fovMapStepEdge1: "카메라에서 드래그하여 필요한 커버리지의 한쪽 경계를 설정하세요.",
      fovMapStepEdge2: "다시 드래그하여 원뿔의 반대쪽 경계를 설정하세요.",
      fovMapStepDone: "핀이나 노란색 손잡이를 드래그해 모양을 조정할 수 있습니다 - 180°를 넘어 완전한 원이 될 때까지 계속 바깥으로 드래그하세요.",
      angleMatchSuffix: (n, deg) => `${deg}° 이상 대응 ${n}건`,
      fovMapResultsHeading: "적합한 모델",
      fovMapResultsIdle: "지도에 원뿔을 그리면 해당 영역을 커버하는 카메라가 표시됩니다.",
      favToggleTitle: "즐겨찾기 - 목록 맨 위로 정렬됩니다",
      footerDisclaimer:
        "표시된 가격은 Axis 권장 소비자가(MSRP)이며 실제 판매가가 아닙니다. 기준은 Axis가 공개한 2026년 Q1/Q2 비교표 가격표(USD)입니다. 일부 제품군 — 비디오 레코더, 저장 매체(SD 카드, 하드 드라이브), 일부 카메라 모델 — 은 2026년 8월 USD 및 EUR 가격 업데이트가 추가로 반영되어 있으며, EUR 가격은 이렇게 업데이트된 항목에만 표시됩니다. JPY 가격은 현재 USD/JPY 기준 환율(ECB, api.frankfurter.dev 경유)을 사용해 USD 가격에서 실시간으로 환산되며, 칩셋 데이터와 동일한 주간 일정으로 갱신됩니다. 칩셋 정보는 Axis가 아니라 CamStreamer가 공개한 앱 호환성 목록에서 가져온 것입니다. 위 Update 버튼이나 주간 백그라운드 점검을 통한 칩셋 데이터·환율 갱신을 제외하면 나머지는 자동으로 갱신되지 않습니다.",
      filterBtnText: "필터",
      filterBtnTitle: "칩셋으로 필터링하고 정렬 순서 변경",
      filterSortHeading: "정렬 기준",
      sortModeFit: "최적 일치",
      sortModePriceAsc: "가격 — 낮은 순",
      sortModePriceDesc: "가격 — 높은 순",
      sortModeFovDesc: "FoV — 넓은 순",
      filterChipsetHeading: "칩셋",
      filterSelectAll: "전체 선택",
      filterClear: "지우기",
      categoryLinkTitle: "이 Axis 제품 카테고리 열기",
    },
    zh: {
      languageLabel: "语言",
      copyHint: "点击复制",
      countLabel: (models, skus) => `已加载 ${models} 个型号 / ${skus} 个 SKU`,
      noMatches: "没有匹配结果。",
      noEurData: "— (无欧元价格)",
      noRateYet: "— (汇率尚未获取)",
      currencyLabel: "货币",
      currencyOffTitle: "隐藏所有价格 — 保留芯片组信息和视场角过滤",
      fxLabel: "汇率 (EUR→USD/GBP/JPY)",
      chipsetLabel: "芯片组数据 (CamStreamer)",
      update: "更新",
      updating: "更新中…",
      searchPlaceholder: "搜索型号或料号…",
      unavailable: "不可用",
      lastUpdateFailed: (msg) => `上次更新失败: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} 个型号 · ${when}更新`,
      updateFailed: (msg) => `更新失败: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · ${when}更新`,
      notFetchedYet: "尚未获取",
      fovMapBtnTitle: "打开全屏 FOV Map 工具",
      fovMapBtnText: "⛶ 全屏",
      catalogTabBtnText: "芯片组 &\nMSRP",
      fovMapToggleBtnText: "FoV 地图\n工具",
      findCamsBtnText: "IP Utility\n扫描器",
      findCamsBtnTitle: "扫描您的本地网络以查找Axis摄像机(型号、序列号、固件、芯片组)",
      findCamsHeading: "此网络上的Axis摄像机",
      angleFieldLabel: "所需FoV",
      angleSliderTitle: "只显示能覆盖至少此角度的摄像机 - PTZ 摄像机按整个平移范围计算,而非镜头光学宽度。与在左侧地图上绘制扇形所设定的要求相同。",
      advancedBtnTitle: "显示/隐藏语言、货币、汇率、芯片组更新信息、月度价格更新及价格说明",
      monthlyLabel: "上传 XLS 价格表",
      settingsBtnTitle: "更新月度价格",
      themeToggleTitle: "切换浅色/深色主题",
      kofiBtnTitle: "请 Pavel 喝杯咖啡 — 支持这个扩展",
      never: "从未",
      justNow: "刚刚",
      minAgo: (n) => `${n} 分钟前`,
      hAgo: (n) => `${n} 小时前`,
      daysAgo: (n) => `${n} 天前`,
      fovMapStepCamera: "点击地图以放置摄像机位置。",
      fovMapStepEdge1: "从摄像机处拖动以设定所需覆盖范围的一条边。",
      fovMapStepEdge2: "再次拖动以设定扇形的另一条边。",
      fovMapStepDone: "拖动图钉或任一黄色手柄可调整形状 - 继续向外拖动可超过180°直至形成整圆。",
      angleMatchSuffix: (n, deg) => `${n} 个匹配 ≥${deg}°`,
      fovMapResultsHeading: "匹配的型号",
      fovMapResultsIdle: "在地图上绘制锥形区域，即可查看可覆盖它的摄像机。",
      favToggleTitle: "收藏 - 会排到列表最前面",
      footerDisclaimer:
        "所示价格为 Axis 建议零售价(MSRP)，并非实际销售价格。基准数据来自 Axis 公开的 2026 年第一/二季度比较表价格表（美元）。一小部分产品——录像机、存储介质（SD 卡、硬盘）以及少数几款摄像机——还包含 2026 年 8 月的美元和欧元价格更新；欧元价格仅在这些已更新的产品上显示。日元价格使用当前美元/日元参考汇率（欧洲央行，通过 api.frankfurter.dev）从美元实时换算，更新频率与芯片组数据相同，为每周一次。芯片组信息来源于 CamStreamer 公布的应用兼容性列表，而非 Axis。除芯片组数据和汇率会通过每周后台检查或上方的\"更新\"按钮刷新外，其余内容均不会自动更新。",
      filterBtnText: "筛选",
      filterBtnTitle: "按芯片组筛选并更改排序",
      filterSortHeading: "排序方式",
      sortModeFit: "最佳匹配",
      sortModePriceAsc: "价格 — 从低到高",
      sortModePriceDesc: "价格 — 从高到低",
      sortModeFovDesc: "FoV — 最宽优先",
      filterChipsetHeading: "芯片组",
      filterSelectAll: "全选",
      filterClear: "清除",
      categoryLinkTitle: "打开此 Axis 产品类别",
    },
    sv: {
      languageLabel: "Språk",
      copyHint: "Klicka för att kopiera",
      countLabel: (models, skus) => `${models} modeller / ${skus} SKU:er inlästa`,
      noMatches: "Inga träffar.",
      noEurData: "— (inget EUR-pris)",
      noRateYet: "— (växelkurs saknas ännu)",
      currencyLabel: "Valuta",
      currencyOffTitle: "Dölj alla priser — chipsetinfo och synfältsfilter behålls",
      fxLabel: "Växelkurser (EUR→USD/GBP/JPY)",
      chipsetLabel: "Chipsetdata (CamStreamer)",
      update: "Uppdatera",
      updating: "Uppdaterar…",
      searchPlaceholder: "Sök modell eller artikelnummer…",
      unavailable: "ej tillgänglig",
      lastUpdateFailed: (msg) => `Senaste uppdateringen misslyckades: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} modeller · uppdaterad ${when}`,
      updateFailed: (msg) => `Uppdateringen misslyckades: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · uppdaterad ${when}`,
      notFetchedYet: "inte hämtad ännu",
      fovMapBtnTitle: "Öppna FOV Map-verktyget i helskärm",
      fovMapBtnText: "⛶ Helskärm",
      catalogTabBtnText: "Chipset &\nMSRP",
      fovMapToggleBtnText: "FoV-karta\nverktyg",
      findCamsBtnText: "IP Utility\nskanner",
      findCamsBtnTitle: "Skannar ditt lokala nätverk efter Axis-kameror (modell, serienummer, firmware, chipset)",
      findCamsHeading: "Axis-kameror på det här nätverket",
      angleFieldLabel: "Önskat FoV",
      angleSliderTitle: "Visa endast kameror som täcker minst denna vinkel - för PTZ räknas hela panoreringsomfånget, inte bara objektivets bredd. Samma krav som att rita en kon på kartan till vänster ger.",
      advancedBtnTitle: "Visa/dölj språk, valuta, växelkurser, chipsetuppdateringsinfo, månatlig prisuppdatering och prisreservationen",
      monthlyLabel: "LADDA UPP XLS-PRISLISTA",
      settingsBtnTitle: "Uppdatera månatliga priser",
      themeToggleTitle: "Växla mellan ljust/mörkt tema",
      kofiBtnTitle: "Bjud Pavel på en kaffe — stötta det här tillägget",
      never: "aldrig",
      justNow: "just nu",
      minAgo: (n) => `${n} min sedan`,
      hAgo: (n) => `${n} tim sedan`,
      daysAgo: (n) => `${n} dagar sedan`,
      fovMapStepCamera: "Klicka på kartan för att placera kamerans position.",
      fovMapStepEdge1: "Dra från kameran för att ange ena kanten av den önskade täckningen.",
      fovMapStepEdge2: "Dra igen för att ange konens andra kant.",
      fovMapStepDone: "Dra nålen eller något av de gula handtagen för att ändra formen - fortsätt dra utåt för att öppna förbi 180° upp till en hel cirkel.",
      angleMatchSuffix: (n, deg) => `${n} matchar ≥${deg}°`,
      fovMapResultsHeading: "Matchande modeller",
      fovMapResultsIdle: "Rita en kon på kartan för att se kamerorna som täcker den.",
      favToggleTitle: "Favorit - sorteras överst i listan",
      footerDisclaimer:
        "Priserna är Axis rekommenderade cirkapriser (MSRP), inte gatupriser. Grunden är Axis offentliga jämförelseprislista för Q1/Q2 2026 (i USD). En liten grupp produkter – videoinspelare, lagringsmedia (SD-kort, hårddiskar) och några kameramodeller – har dessutom prisuppdateringar från augusti 2026 i USD och EUR; EUR-priset visas endast för dessa uppdaterade artiklar. JPY-priset omvandlas live från USD med aktuell USD/JPY-referenskurs (ECB, via api.frankfurter.dev), uppdaterad enligt samma veckoschema som chipsetdata. Chipsetinfo kommer från CamStreamers publicerade applikationskompatibilitetslista, inte från Axis. Inget av detta uppdateras automatiskt förutom chipsetdata och växelkurser, via veckovis bakgrundskontroll eller Uppdatera-knappen ovan.",
      filterBtnText: "Filter",
      filterBtnTitle: "Filtrera efter chipset och ändra sorteringen",
      filterSortHeading: "Sortera efter",
      sortModeFit: "Bästa träff",
      sortModePriceAsc: "Pris — lägst först",
      sortModePriceDesc: "Pris — högst först",
      sortModeFovDesc: "FoV — bredast först",
      filterChipsetHeading: "Chipset",
      filterSelectAll: "Markera alla",
      filterClear: "Rensa",
      categoryLinkTitle: "Öppna den här Axis-produktkategorin",
    },
    uk: {
      languageLabel: "Мова",
      copyHint: "Натисніть, щоб скопіювати",
      countLabel: (models, skus) => `Завантажено ${models} моделей / ${skus} SKU`,
      noMatches: "Збігів немає.",
      noEurData: "— (немає ціни в EUR)",
      noRateYet: "— (курс ще не отримано)",
      currencyLabel: "Валюта",
      currencyOffTitle: "Приховати всі ціни — інформація про чипсет і фільтр кута огляду залишаються",
      fxLabel: "Курси обміну (EUR→USD/GBP/JPY)",
      chipsetLabel: "Дані про чипсет (CamStreamer)",
      update: "Оновити",
      updating: "Оновлення…",
      searchPlaceholder: "Пошук моделі або артикулу…",
      unavailable: "недоступно",
      lastUpdateFailed: (msg) => `Останнє оновлення не вдалося: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} моделей · оновлено ${when}`,
      updateFailed: (msg) => `Помилка оновлення: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · оновлено ${when}`,
      notFetchedYet: "ще не отримано",
      fovMapBtnTitle: "Відкрити інструмент FOV Map на весь екран",
      fovMapBtnText: "⛶ Повний екран",
      catalogTabBtnText: "Чипсет &\nMSRP",
      fovMapToggleBtnText: "Карта FoV\nінструмент",
      findCamsBtnText: "IP Utility\nсканер",
      findCamsBtnTitle: "Сканує вашу локальну мережу на наявність камер Axis (модель, серійний номер, прошивка, чипсет)",
      findCamsHeading: "Камери Axis у цій мережі",
      angleFieldLabel: "Потрібний FoV",
      angleSliderTitle: "Показувати лише камери, що покривають щонайменше цей кут - для PTZ враховується весь діапазон повороту, а не лише ширина об'єктива. Та сама вимога, що встановлюється малюванням конуса на карті зліва.",
      advancedBtnTitle: "Показати/приховати мову, валюту, курси обміну, інформацію про оновлення чипсета, щомісячне оновлення цін і застереження щодо цін",
      monthlyLabel: "ЗАВАНТАЖИТИ ПРАЙС-ЛИСТ .XLS",
      settingsBtnTitle: "Оновити щомісячні ціни",
      themeToggleTitle: "Перемкнути світлу/темну тему",
      kofiBtnTitle: "Пригостити Павла кавою — підтримати це розширення",
      never: "ніколи",
      justNow: "щойно",
      minAgo: (n) => `${n} хв тому`,
      hAgo: (n) => `${n} год тому`,
      daysAgo: (n) => `${n} дн тому`,
      fovMapStepCamera: "Натисніть на карту, щоб розмістити камеру.",
      fovMapStepEdge1: "Перетягніть від камери, щоб задати один край потрібного покриття.",
      fovMapStepEdge2: "Перетягніть ще раз, щоб задати інший край конуса.",
      fovMapStepDone: "Перетягніть шпильку або будь-яку жовту ручку, щоб змінити форму - тягніть далі назовні, щоб відкрити більше 180° аж до повного кола.",
      angleMatchSuffix: (n, deg) => `${n} відповідають ≥${deg}°`,
      fovMapResultsHeading: "Підходящі моделі",
      fovMapResultsIdle: "Намалюйте конус на карті, щоб побачити камери, які його покривають.",
      favToggleTitle: "Обране - переміщується на початок списку",
      footerDisclaimer:
        "Слава Україні! Героям слава! Ціни відповідають рекомендованій роздрібній ціні Axis (MSRP), а не фактичній ціні продажу. Базою є публічний порівняльний прайс-лист Axis за Q1/Q2 2026 (у USD). Невелика група товарів – відеореєстратори, носії даних (SD-карти, жорсткі диски) та кілька моделей камер – також містить оновлення цін у USD та EUR за серпень 2026 року; ціна в EUR показується лише для цих оновлених позицій. Ціна в JPY конвертується в реальному часі з USD за поточним референтним курсом USD/JPY (ЄЦБ, через api.frankfurter.dev), що оновлюється за тим самим щотижневим графіком, що й дані про чипсет. Інформація про чипсет отримана з опублікованого списку сумісності застосунків CamStreamer, а не від Axis. Ніщо з цього не оновлюється автоматично, окрім даних про чипсет і курсів обміну – через щотижневу фонову перевірку або кнопку Оновити вище.",
      filterBtnText: "Фільтр",
      filterBtnTitle: "Фільтрувати за чипсетом і змінити сортування",
      filterSortHeading: "Сортувати за",
      sortModeFit: "Найкраща відповідність",
      sortModePriceAsc: "Ціна — від найнижчої",
      sortModePriceDesc: "Ціна — від найвищої",
      sortModeFovDesc: "FoV — найширший спершу",
      filterChipsetHeading: "Чипсет",
      filterSelectAll: "Вибрати все",
      filterClear: "Очистити",
      categoryLinkTitle: "Відкрити цю категорію продуктів Axis",
    },
    ar: {
      languageLabel: "اللغة",
      copyHint: "انقر للنسخ",
      countLabel: (models, skus) => `تم تحميل ${models} طرازًا / ${skus} رمز صنف`,
      noMatches: "لا توجد نتائج مطابقة.",
      noEurData: "— (لا يوجد سعر باليورو)",
      noRateYet: "— (لم يُجلب سعر الصرف بعد)",
      currencyLabel: "العملة",
      currencyOffTitle: "إخفاء جميع الأسعار — مع الإبقاء على معلومات الشريحة وفلتر زاوية الرؤية",
      fxLabel: "أسعار الصرف (EUR→USD/GBP/JPY)",
      chipsetLabel: "بيانات الشريحة (CamStreamer)",
      update: "تحديث",
      updating: "جارٍ التحديث…",
      searchPlaceholder: "ابحث عن الطراز أو رقم القطعة…",
      unavailable: "غير متاح",
      lastUpdateFailed: (msg) => `فشل آخر تحديث: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} طرازًا · تم التحديث ${when}`,
      updateFailed: (msg) => `فشل التحديث: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 يورو ≈ $${usd} / ¥${jpy} · تم التحديث ${when}`,
      notFetchedYet: "لم يُجلب بعد",
      fovMapBtnTitle: "فتح أداة خريطة زاوية الرؤية بملء الشاشة",
      fovMapBtnText: "⛶ ملء الشاشة",
      catalogTabBtnText: "الشريحة &\nMSRP",
      fovMapToggleBtnText: "خريطة FoV\nأداة",
      findCamsBtnText: "IP Utility\nماسح",
      findCamsBtnTitle: "يمسح شبكتك المحلية بحثًا عن كاميرات Axis (الطراز، الرقم التسلسلي، البرنامج الثابت، الشريحة)",
      findCamsHeading: "كاميرات Axis في هذه الشبكة",
      angleFieldLabel: "FoV المطلوب",
      angleSliderTitle: "عرض الكاميرات القادرة على تغطية هذه الزاوية على الأقل فقط - بالنسبة لكاميرات PTZ يُحتسب نطاق الدوران الكامل وليس عرض العدسة فقط. نفس المتطلب الذي يحدده رسم مخروط على الخريطة إلى اليسار.",
      advancedBtnTitle: "إظهار/إخفاء اللغة والعملة وأسعار الصرف ومعلومات تحديث الشريحة والتحديث الشهري للأسعار وملاحظة الأسعار",
      monthlyLabel: "تحميل قائمة الأسعار .XLS",
      settingsBtnTitle: "تحديث الأسعار الشهرية",
      themeToggleTitle: "التبديل بين الوضع الفاتح والداكن",
      kofiBtnTitle: "اشترِ لبافيل قهوة — لدعم هذا الامتداد",
      never: "أبدًا",
      justNow: "الآن",
      minAgo: (n) => `قبل ${n} دقيقة`,
      hAgo: (n) => `قبل ${n} ساعة`,
      daysAgo: (n) => `قبل ${n} يوم`,
      fovMapStepCamera: "انقر على الخريطة لتحديد موقع الكاميرا.",
      fovMapStepEdge1: "اسحب من الكاميرا لتحديد أحد حدَي التغطية المطلوبة.",
      fovMapStepEdge2: "اسحب مرة أخرى لتحديد الحد الآخر للمخروط.",
      fovMapStepDone: "اسحب الدبوس أو أيًا من المقبضين الأصفرين لتعديل الشكل - استمر بالسحب للخارج للتوسّع بعد 180° حتى الدائرة الكاملة.",
      angleMatchSuffix: (n, deg) => `${n} مطابقة لـ ≥${deg}°`,
      fovMapResultsHeading: "الطرازات المطابقة",
      fovMapResultsIdle: "ارسم مخروطًا على الخريطة لرؤية الكاميرات التي تغطيه.",
      favToggleTitle: "مفضّلة - تنتقل إلى أعلى القائمة",
      footerDisclaimer:
        "الأسعار المعروضة هي السعر الموصى به من Axis (MSRP)، وليست سعر البيع الفعلي. الأساس هو قائمة أسعار Axis العامة المقارنة لربعي 2026 الأول والثاني (بالدولار الأمريكي). مجموعة صغيرة من المنتجات - مسجلات الفيديو، ووسائط التخزين (بطاقات SD، والأقراص الصلبة)، وبعض طرازات الكاميرات - تتضمن أيضًا تحديثات أسعار بالدولار واليورو لشهر أغسطس 2026؛ ويظهر سعر اليورو فقط لهذه العناصر المحدّثة. يُحوَّل سعر الين الياباني مباشرة من الدولار باستخدام سعر الصرف المرجعي الحالي للدولار/الين (البنك المركزي الأوروبي، عبر api.frankfurter.dev)، ويُحدَّث وفق نفس الجدول الأسبوعي لبيانات الشريحة. معلومات الشريحة مصدرها قائمة توافق التطبيقات المنشورة من CamStreamer، وليس من Axis. لا يُحدَّث أي شيء من هذا تلقائيًا باستثناء بيانات الشريحة وأسعار الصرف، عبر الفحص الأسبوعي في الخلفية أو زر التحديث أعلاه.",
      filterBtnText: "تصفية",
      filterBtnTitle: "التصفية حسب الشريحة وتغيير الترتيب",
      filterSortHeading: "الترتيب حسب",
      sortModeFit: "أفضل تطابق",
      sortModePriceAsc: "السعر — من الأقل",
      sortModePriceDesc: "السعر — من الأعلى",
      sortModeFovDesc: "FoV — الأوسع أولاً",
      filterChipsetHeading: "الشريحة",
      filterSelectAll: "تحديد الكل",
      filterClear: "مسح",
      categoryLinkTitle: "فتح فئة منتجات Axis هذه",
    },
    nl: {
      languageLabel: "Taal",
      copyHint: "Klik om te kopiëren",
      countLabel: (models, skus) => `${models} modellen / ${skus} SKU's geladen`,
      noMatches: "Geen resultaten.",
      noEurData: "— (geen EUR-prijs)",
      noRateYet: "— (koers nog niet opgehaald)",
      currencyLabel: "Valuta",
      currencyOffTitle: "Alle prijzen verbergen — chipsetinfo en FOV-filter blijven behouden",
      fxLabel: "Wisselkoersen (EUR→USD/GBP/JPY)",
      chipsetLabel: "Chipsetgegevens (CamStreamer)",
      update: "Bijwerken",
      updating: "Bijwerken…",
      searchPlaceholder: "Zoek model of onderdeelnummer…",
      unavailable: "niet beschikbaar",
      lastUpdateFailed: (msg) => `Laatste update mislukt: ${msg}`,
      chipsetStatusOk: (count, when) => `${count} modellen · bijgewerkt ${when}`,
      updateFailed: (msg) => `Bijwerken mislukt: ${msg}`,
      fxStatusOk: (usd, jpy, when) => `1 EUR ≈ $${usd} / ¥${jpy} · bijgewerkt ${when}`,
      notFetchedYet: "nog niet opgehaald",
      fovMapBtnTitle: "Open de FOV Map-tool op volledig scherm",
      fovMapBtnText: "⛶ Volledig scherm",
      catalogTabBtnText: "Chipset &\nMSRP",
      fovMapToggleBtnText: "FoV-kaart\ntool",
      findCamsBtnText: "IP Utility\nscanner",
      findCamsBtnTitle: "Scan je lokale netwerk naar Axis-camera's (model, serienummer, firmware, chipset)",
      findCamsHeading: "Axis-camera's op dit netwerk",
      angleFieldLabel: "Vereist FoV",
      angleSliderTitle: "Toon alleen camera's die minstens deze hoek kunnen dekken - bij een PTZ telt het volledige pan-bereik, niet alleen de lensbreedte. Dezelfde eis die het tekenen van een kegel op de kaart links instelt.",
      advancedBtnTitle: "Taal, valuta, wisselkoersen, chipset-updategegevens, maandelijkse prijsupdate en de prijsvermelding tonen/verbergen",
      monthlyLabel: "PRIJSLIJST .XLS UPLOADEN",
      settingsBtnTitle: "Maandelijkse prijzen bijwerken",
      themeToggleTitle: "Licht/donker thema wisselen",
      kofiBtnTitle: "Trakteer Pavel op een kopje koffie — steun deze extensie",
      never: "nooit",
      justNow: "zojuist",
      minAgo: (n) => `${n} min geleden`,
      hAgo: (n) => `${n} u geleden`,
      daysAgo: (n) => `${n} dagen geleden`,
      fovMapStepCamera: "Klik op de kaart om de camerapositie te plaatsen.",
      fovMapStepEdge1: "Sleep vanaf de camera om één rand van de vereiste dekking in te stellen.",
      fovMapStepEdge2: "Sleep opnieuw om de andere rand van de kegel in te stellen.",
      fovMapStepDone: "Sleep de pin of een van de gele handvatten om de vorm aan te passen - blijf naar buiten slepen om voorbij 180° te openen tot een volledige cirkel.",
      angleMatchSuffix: (n, deg) => `${n} komt overeen met ≥${deg}°`,
      fovMapResultsHeading: "Passende modellen",
      fovMapResultsIdle: "Teken een kegel op de kaart om de camera's te zien die deze dekken.",
      favToggleTitle: "Favoriet - favorieten komen bovenaan de lijst",
      footerDisclaimer:
        "Prijzen zijn de door Axis geadviseerde verkoopprijzen (MSRP), niet de daadwerkelijke verkoopprijs. Dit is gebaseerd op de publieke Axis Q1/Q2 2026-vergelijkingsprijslijst (in USD). Een kleine groep producten — videorecorders, opslagmedia (SD-kaarten, harde schijven) en enkele cameramodellen — bevat daarnaast USD- en EUR-prijsupdates van augustus 2026; de EUR-prijs wordt alleen getoond voor deze bijgewerkte artikelen. De JPY-prijs wordt live omgerekend vanuit USD met de actuele USD/JPY-referentiekoers (ECB, via api.frankfurter.dev) en wordt bijgewerkt volgens hetzelfde wekelijkse schema als de chipsetgegevens. Chipsetinformatie is afkomstig van de gepubliceerde app-compatibiliteitslijst van CamStreamer, niet van Axis. Niets hiervan wordt automatisch bijgewerkt, behalve chipsetgegevens en wisselkoersen, via de wekelijkse achtergrondcontrole of de knop Bijwerken hierboven.",
      filterBtnText: "Filter",
      filterBtnTitle: "Filteren op chipset en de sortering wijzigen",
      filterSortHeading: "Sorteren op",
      sortModeFit: "Beste match",
      sortModePriceAsc: "Prijs — laag naar hoog",
      sortModePriceDesc: "Prijs — hoog naar laag",
      sortModeFovDesc: "FoV — breedste eerst",
      filterChipsetHeading: "Chipset",
      filterSelectAll: "Alles selecteren",
      filterClear: "Wissen",
      categoryLinkTitle: "Deze Axis-productcategorie openen",
    },
  };

  // navigator.language-based auto-detect, falling back to English when it
  // doesn't match any supported code - e.g. "pt-BR" or "it-IT" have no
  // translation table here, so they land on English rather than guessing.
  function detectLangCode() {
    const nav = ((navigator.language || navigator.userLanguage || "en") + "").toLowerCase();
    const primary = nav.split("-")[0];
    // Any browser language we don't have a translation for lands on Dutch,
    // not English - a deliberate choice so "the popup opened in Dutch"
    // is a visible signal that detection fell through to the catch-all,
    // rather than being indistinguishable from a browser that's genuinely
    // set to English. Same rule applied in i18n.js's AxisI18N.langCode.
    return LANGS.some((l) => l.code === primary) ? primary : "nl";
  }

  // Locale-based first-run currency default: if the user has never
  // explicitly picked a currency in this popup, infer one from the
  // browser's own navigator.language region (not the page URL - the popup
  // has no axis.com page context of its own, unlike content.js/
  // products-content.js/search-content.js which read the /xx-yy/ locale
  // prefix from location.pathname instead). Region "GB"/"UK" -> GBP,
  // "JP" -> JPY, an Americas region -> USD, everything else (including no
  // region at all, e.g. plain "en") keeps the original EUR default.
  function localeDefaultCurrency() {
    const nav = ((navigator.language || navigator.userLanguage || "") + "").toLowerCase();
    const parts = nav.split("-");
    const lang = parts[0] || "";
    const region = parts[1] || "";
    if (region === "jp" || lang === "ja") return "JPY";
    if (region === "gb" || region === "uk") return "GBP";
    const AMERICAS = ["us", "ca", "mx", "br", "ar", "cl", "co", "pe", "cr", "do", "gt", "ec", "uy", "pa", "bo", "py", "sv", "hn", "ni", "ve", "pr"];
    if (AMERICAS.includes(region)) return "USD";
    return "EUR";
  }

  let currentLang = "en"; // replaced below once chrome.storage/detection resolve
  // t(key, enFallback, ...args): looks up TRANSLATIONS[currentLang][key]
  // (calling it with ...args if it's a function); "en" (and any language
  // missing a given key) just returns enFallback directly.
  function t(key, enFallback, ...args) {
    if (currentLang === "en") return enFallback;
    const table = TRANSLATIONS[currentLang];
    const v = table && table[key];
    if (v === undefined) return enFallback;
    return typeof v === "function" ? v(...args) : v;
  }

  // Version shown in the header - read from the manifest so it never needs
  // manual updates when the version is bumped.
  if (chrome.runtime && chrome.runtime.getManifest) {
    const versionEl = document.getElementById("versionLabel");
    if (versionEl) versionEl.textContent = "v" + chrome.runtime.getManifest().version;
  }

  // ---------------------------------------------------------------------
  // Chipset lookup (CamStreamer supported-camera data) - same matching
  // approach as content.js/search-content.js, just keyed directly off each
  // catalog model name instead of a scraped page-title string.
  // ---------------------------------------------------------------------

  let CHIPSETS = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};
  const CAMSTREAMER_ACAPS_PRESET = ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"];

  function normalizeBare(s) {
    return (s || "")
      .toUpperCase()
      .replace(/®|™/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^AXIS\s+/, "");
  }

  let chipsetIndex = new Map();
  let sortedChipsetKeys = [];
  function rebuildChipsetIndex() {
    chipsetIndex = new Map();
    for (const key of Object.keys(CHIPSETS)) {
      chipsetIndex.set(normalizeBare(key), CHIPSETS[key]);
    }
    sortedChipsetKeys = Array.from(chipsetIndex.keys()).sort((a, b) => b.length - a.length);
  }
  rebuildChipsetIndex();

  function lookupChipset(norm) {
    if (chipsetIndex.has(norm)) return chipsetIndex.get(norm);
    for (const key of sortedChipsetKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return chipsetIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedChipsetKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    return bestKey ? chipsetIndex.get(bestKey) : null;
  }

  function chipsetFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupChipset(norm);
    if (direct) return direct;
    // See content.js for the rationale - Axis marine/stainless "S" variants
    // (Q3538-SLVE vs base Q3538-LVE) aren't always listed separately by
    // CamStreamer, but share the same chipset when they are.
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupChipset(demarined) : null;
  }

  // ---------------------------------------------------------------------
  // FOV lookup + PTZ-aware coverage classification, ported from content.js
  // (see that file for the full rationale) so the compact FOV Map below can
  // filter this popup's own model list with the same semantics as the
  // Product Selector page's Filters panel: a PTZ's "coverable" angle is the
  // full 360° it can pan across, not just its optical zoom width.
  // ---------------------------------------------------------------------
  const FOVS = (typeof FOV_DATA !== "undefined" && FOV_DATA.fov) || {};
  let fovIndex = new Map();
  let sortedFovKeys = [];
  (function rebuildFovIndex() {
    for (const key of Object.keys(FOVS)) {
      fovIndex.set(normalizeBare(key), FOVS[key]);
    }
    sortedFovKeys = Array.from(fovIndex.keys()).sort((a, b) => b.length - a.length);
  })();

  function lookupFov(norm) {
    if (fovIndex.has(norm)) return fovIndex.get(norm);
    for (const key of sortedFovKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return fovIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedFovKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    return bestKey ? fovIndex.get(bestKey) : null;
  }

  function displayNameFor(it) {
    return it.variant ? it.model + " " + it.variant : it.model;
  }

  function fovFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupFov(norm);
    if (direct) return direct;
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupFov(demarined) : null;
  }

  function cameraClassOf(section, fov) {
    if (fov && fov.min === 360 && fov.max === 360) return "panoramic";
    if (/pan\/tilt\/zoom/i.test(section || "")) return "ptz";
    if (/panoramic/i.test(section || "")) return "panoramic";
    if (fov && fov.max >= 180) return "panoramic";
    return "fixed";
  }

  function coverableAngle(fov, cameraClass) {
    if (!fov) return null;
    return cameraClass === "ptz" ? 360 : fov.max;
  }

  // Required-angle filter state, set by the compact FOV Map panel below (or
  // persisted across popup opens). null = inactive. Fails CLOSED once
  // active - a model with no FOV data simply isn't a match, matching
  // content.js's own mapFilterOk() semantics.
  let mapAngleRequired = null;
  // With no angle set, the effective requirement is 1 degree rather than
  // "no filter". Since this check fails CLOSED on missing FoV data, a 1
  // degree floor is what keeps non-cameras out of the list: clips, cables,
  // licenses, recorders, 2N intercoms and the like have no FoV entry, so
  // they never satisfy even 1 degree.
  //
  // Measured against the current catalog: the floor keeps 204 of 409 SKUs,
  // and every one of the 204 is a camera (the only non-"cameras" sections
  // that survive are the W102/W110/W120 body-worn cameras and one model
  // still sitting in the "New products" bucket). It drops 15 real cameras
  // too - the F-series/FA sensor and main units, whose FoV genuinely
  // depends on the sensor attached, plus P1465-LE-3 Kit, P3265-V,
  // P4705-PLVE and XC1311.
  //
  // The UI still shows 0 degrees at rest - this floor is deliberately
  // invisible, not a value the slider can be dragged to.
  const ANGLE_FLOOR = 1;
  function angleFilterOk(it) {
    const required = mapAngleRequired == null ? ANGLE_FLOOR : mapAngleRequired;
    const fov = fovFor(displayNameFor(it));
    if (!fov) return false;
    const cov = coverableAngle(fov, cameraClassOf(it.section, fov));
    if (cov == null) return false;
    return required <= cov;
  }

  // Adds model keys the current catalog has never seen (see content.js for
  // the full rationale). Unlike content.js/products-content.js/search-content.js,
  // popup.js has no precomputed name index to keep in sync - `flat` (below)
  // is rebuilt fresh from MODELS on every call, so a plain assignment here
  // is enough as long as it runs before buildFlat().
  function registerNewProducts(newProducts) {
    if (!newProducts) return;
    for (const key in newProducts) {
      if (!MODELS[key]) MODELS[key] = newProducts[key];
    }
  }

  // Applies a chrome.storage.local "catalogOverride" record (written by the
  // settings/options page after a monthly .xls drop) onto the bundled
  // catalog in place, keyed by each variant's own part_number. Must run
  // before `flat` is built below, since flat holds spread copies of each
  // variant - mutating MODELS afterwards wouldn't reach it.
  function applyCatalogOverride(override) {
    if (!override) return;
    registerNewProducts(override.newProducts);
    if (!override.overrides) return;
    for (const model in MODELS) {
      for (const v of MODELS[model]) {
        const o = v.part_number && override.overrides[v.part_number];
        if (o) {
          if (o.msrp_eur !== undefined) v.msrp_eur = o.msrp_eur;
          if (o.msrp !== undefined) v.msrp = o.msrp;
          if (o.msrp_display !== undefined) v.msrp_display = o.msrp_display;
          if (o.msrp_exact !== undefined) v.msrp_exact = o.msrp_exact;
          else if (o.msrp !== undefined) v.msrp_exact = false;
        }
      }
    }
  }

  let flat = [];
  function buildFlat() {
    flat = [];
    for (const model in MODELS) {
      for (const v of MODELS[model]) {
        if (v.msrp == null) continue;
        flat.push({ model, ...v });
      }
    }
    const modelCount = Object.keys(MODELS).length;
    document.getElementById("countLabel").textContent = t(
      "countLabel",
      modelCount + " models / " + flat.length + " SKUs loaded",
      modelCount,
      flat.length
    );
  }

  // JPY prices are rounded up to the nearest 1,000 yen and expressed in 万
  // (man, 10,000) units so they read as short numbers instead of long strings
  // of digits - e.g. ¥372,274 -> ¥37.3万.
  function fmtJpyMan(n) {
    const rounded = Math.ceil(n / 1000) * 1000;
    let man = (rounded / 10000).toFixed(1);
    if (man.endsWith(".0")) man = man.slice(0, -2);
    return "¥" + man + "万";
  }

  // EUR is the "final" defined list price; USD/GBP/JPY are always FX-derived
  // approximations, rounded to whole units.
  function fmt(n, currency, exact, approx) {
    const prefix = approx ? "~" : "";
    if (currency === "JPY") return prefix + fmtJpyMan(n);
    if (currency === "USD") {
      const digits = Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
      return prefix + "$" + digits;
    }
    if (currency === "GBP") {
      const digits = Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
      return prefix + "£" + digits;
    }
    return prefix + "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const resultsEl = document.getElementById("results");
  const searchEl = document.getElementById("search");

  // ---------------------------------------------------------------------
  // Favorites - a lightweight "♡ -> 🧡" per-model marker, shared via
  // chrome.storage.local ("axisFavorites", an array of normalizeBare(model)
  // keys) with content.js (on the live Product Selector page) and its
  // Filters panel, so favoriting a camera anywhere shows it favorited
  // everywhere. Favorited models sort to the top of this list.
  // ---------------------------------------------------------------------
  const FAVORITES_KEY = "axisFavorites";
  let favorites = new Set();

  function isFav(model) {
    return favorites.has(normalizeBare(model));
  }

  function saveFavorites() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [FAVORITES_KEY]: Array.from(favorites) });
    }
  }

  function toggleFav(model) {
    const key = normalizeBare(model);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveFavorites();
    render(search(searchEl.value));
  }

  let currentCurrency = "EUR";
  let fxRates = null; // { usd, jpy, gbp, date } - populated from chrome.storage.local, used for the live JPY/GBP conversion
  // "OFF" hides every price across the whole extension while leaving chipset
  // info and FOV filtering untouched - for people speccing cameras who don't
  // deal with pricing at all.
  const pricesHidden = () => currentCurrency === "OFF";

  // Refreshes the header's sub-line ("N models / M SKUs loaded") to also
  // show how many currently match the FOV Map's required-angle filter, when
  // that filter is active - the same "N / total shown" pattern content.js's
  // Filters panel uses on the Product Selector page.
  function updateMatchCount(shownCount) {
    const countLabelEl = document.getElementById("countLabel");
    if (!countLabelEl) return;
    const modelCount = Object.keys(MODELS).length;
    const base = t("countLabel", modelCount + " models / " + flat.length + " SKUs loaded", modelCount, flat.length);
    if (mapAngleRequired != null) {
      const deg = Math.round(mapAngleRequired);
      countLabelEl.textContent = base + " — " + t("angleMatchSuffix", shownCount + " match ≥" + deg + "°", shownCount, deg);
    } else {
      countLabelEl.textContent = base;
    }
  }

  // The price string for one catalog row in the currently selected currency,
  // or null when prices are hidden. Pulled out of render() so the FoV Map
  // tab's own results list (renderFovMapResults) shows exactly the same
  // numbers, with the same "~" approximation flags, as this list does.
  function priceTextFor(it) {
    if (pricesHidden()) return null;
    if (currentCurrency === "EUR") {
      if (it.msrp_eur != null) return fmt(it.msrp_eur, "EUR", true, false);
      // No real EUR list price for this SKU (mostly US/Canada-only and
      // 2N-branded products) - estimate it from USD rather than show
      // nothing, flagged with a "~" so it reads as approximate.
      if (it.msrp != null && fxRates && typeof fxRates.usd === "number") {
        return fmt(it.msrp / fxRates.usd, "EUR", false, true);
      }
      return t("noEurData", "— (no EUR data)");
    }
    if (currentCurrency === "JPY") {
      return it.msrp != null && fxRates && typeof fxRates.jpy === "number" && typeof fxRates.usd === "number"
        ? fmt(it.msrp * (fxRates.jpy / fxRates.usd), "JPY", false, true)
        : t("noRateYet", "— (no rate yet)");
    }
    if (currentCurrency === "GBP") {
      return it.msrp != null && fxRates && typeof fxRates.gbp === "number" && typeof fxRates.usd === "number"
        ? fmt(it.msrp * (fxRates.gbp / fxRates.usd), "GBP", false, true)
        : t("noRateYet", "— (no rate yet)");
    }
    return fmt(it.msrp, "USD", it.msrp_exact);
  }

  function escAttr(v) {
    return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // The pasteable Product Number for one catalog row, or null when there
  // isn't one. 15 multipack rows carry the pack size inside the part number
  // ("02858-021 (10 pcs)"), which is not something you can paste into an
  // order - the row still SHOWS the catalog string, only the clipboard
  // payload is normalized, and the title spells out what that payload is.
  // The "-" / empty guard is defensive: the only such rows in the catalog
  // today are the two software entries, which buildFlat() already drops for
  // having no MSRP, so they never reach a list.
  function skuOf(it) {
    const pn = (it.part_number || "").replace(/\s*\(\s*\d+\s*pcs\s*\)\s*$/i, "").trim();
    return pn && pn !== "-" ? pn : null;
  }

  // Click-to-copy field: each one copies its own value (model name, Product
  // Number, camera type), same data-copy convention as find-cams.js. With no
  // payload it degrades to plain text and gets no copy affordance.
  function copySpan(text, payload, extraClass) {
    const cls = (payload ? "copy" : "") + (extraClass ? (payload ? " " : "") + extraClass : "");
    if (!cls) return text;
    return '<span class="' + cls + '"' +
      (payload
        ? ' data-copy="' + escAttr(payload) + '" title="' +
          escAttr(t("copyHint", "Click to copy") + " " + payload) + '"'
        : "") +
      '>' + text + '</span>';
  }

  // Chipset pill markup, shared with the FoV Map tab's list.
  function chipsetBadgeHtml(model) {
    const chipset = chipsetFor(model);
    if (!chipset) return "";
    return '<span class="chipset">' + chipset +
      (CAMSTREAMER_ACAPS_PRESET.includes(chipset) ? " \u2705" : "") + '</span>';
  }

  function render(items) {
    resultsEl.innerHTML = "";
    updateMatchCount(items.length);
    if (!items.length) {
      resultsEl.innerHTML = '<div class="empty">' + t("noMatches", "No matches.") + '</div>';
      renderFovMapResults();
      return;
    }
    const frag = document.createDocumentFragment();
    items.slice(0, 60).forEach((it) => {
      const row = document.createElement("div");
      const fav = isFav(it.model);
      row.className = fav ? "row favorited" : "row";
      row.dataset.favModel = it.model;
      const priceText = priceTextFor(it);
      row.innerHTML =
        '<span class="fav" title="' +
        t("favToggleTitle", "Favorite this camera - favorites sort to the top") +
        '">' + (fav ? "🧡" : "♡") + '</span>' +
        (priceText !== null ? '<span class="price">' + priceText + '</span>' : '') +
        chipsetBadgeHtml(it.model) +
        '<div class="model">' + copySpan(it.model, it.model) +
        (it.variant ? " — " + it.variant : "") + '</div>' +
        '<div class="meta">' + (it.part_number ? copySpan(it.part_number, skuOf(it)) : "") +
        (it.section ? (it.part_number ? " · " : "") + copySpan(it.section, it.section) : "") + '</div>';
      frag.appendChild(row);
    });
    resultsEl.appendChild(frag);
    renderFovMapResults();
  }

  // ---------------------------------------------------------------------
  // FoV Map tab's own results list, under the map. The whole point of this
  // tab is seeing the map, the cone and the cameras that fit it at once -
  // before this, drawing a cone only set the Required FoV over in the
  // Chipset & MSRP tab, so you had to switch tabs to find out what matched.
  //
  // Deliberately a much thinner row than render()'s: model, chipset, price
  // and the favorite heart, no part number or section line - that's what the
  // Chipset & MSRP tab (and the full-page tool) are for.
  //
  // Ranking: favorites first (they're the shortlist you're speccing from),
  // then tightest FoV fit - the model whose lens is closest to the angle you
  // drew, i.e. least overkill - with price breaking ties. A PTZ that only
  // reaches the angle by panning sorts below everything that covers the cone
  // outright, since it watches one direction at a time (same rule as
  // fov-map.js).
  // ---------------------------------------------------------------------
  const fovMapResultsEl = document.getElementById("fovMapResults");
  const fovMapResultsCountEl = document.getElementById("fovMapResultsCount");

  function renderFovMapResults() {
    if (!fovMapResultsEl) return;
    if (mapAngleRequired == null) {
      fovMapResultsCountEl.textContent = "";
      fovMapResultsEl.innerHTML =
        '<div class="empty">' +
        t("fovMapResultsIdle", "Draw a cone on the map to see the cameras that cover it.") +
        "</div>";
      return;
    }
    const angle = mapAngleRequired;
    const matches = flat.filter(angleFilterOk).filter(chipsetFilterOk);

    const priceOf = (it) => it.msrp_eur ?? it.msrp ?? Infinity;
    // Measured against the model's own widest lens, not the 360 pan range
    // that got a PTZ into the list - otherwise every PTZ would look
    // maximally over-provisioned and sink regardless of how well it fits.
    const excessOf = (it) => {
      const fov = fovFor(displayNameFor(it));
      return fov ? Math.max(0, fov.max - angle) : Infinity;
    };
    const panOnlyOf = (it) => {
      const fov = fovFor(displayNameFor(it));
      return fov && cameraClassOf(it.section, fov) === "ptz" && fov.max < angle ? 1 : 0;
    };
    // Favorites-first and the explicit price/FoV modes live in applySort;
    // the pan-then-excess-then-price ranking below is this list's "fit"
    // fallback, used only when sortMode is "fit".
    applySort(matches, (a, b) => {
      const panDiff = panOnlyOf(a) - panOnlyOf(b);
      if (panDiff) return panDiff;
      const excessDiff = excessOf(a) - excessOf(b);
      if (excessDiff) return excessDiff;
      return priceOf(a) - priceOf(b);
    });

    fovMapResultsCountEl.textContent = t(
      "angleMatchSuffix",
      matches.length + " match ≥" + Math.round(angle) + "°",
      matches.length,
      Math.round(angle)
    );

    if (!matches.length) {
      fovMapResultsEl.innerHTML = '<div class="empty">' + t("noMatches", "No matches.") + "</div>";
      return;
    }

    const frag = document.createDocumentFragment();
    matches.slice(0, 60).forEach((it) => {
      const fav = isFav(it.model);
      const row = document.createElement("div");
      row.className = fav ? "row favorited" : "row";
      row.dataset.favModel = it.model;
      const priceText = priceTextFor(it);
      row.innerHTML =
        '<span class="fav" title="' +
        t("favToggleTitle", "Favorite this camera - favorites sort to the top") +
        '">' + (fav ? "🧡" : "♡") + "</span>" +
        (priceText !== null ? '<span class="price">' + priceText + "</span>" : "") +
        chipsetBadgeHtml(it.model) +
        '<div class="model">' + copySpan(it.model, it.model) +
        (it.variant ? " — " + it.variant : "") +
        (it.part_number ? " " + copySpan(it.part_number, skuOf(it), "sku") : "") +
        "</div>";
      frag.appendChild(row);
    });
    fovMapResultsEl.innerHTML = "";
    fovMapResultsEl.appendChild(frag);
    fovMapResultsEl.scrollTop = 0; // a new cone should start from the best match
  }

  // Copy what you click: each text field in a row copies its own value.
  // Favoriting is the heart itself - the model/part-number/type fields are
  // full-width block boxes covering the whole row, so there is no whole-row
  // click left to give it (it used to toggle the favorite; sales and techs
  // need the Product Number on the clipboard far more often).
  function onListClick(e) {
    const copyEl = e.target.closest(".copy");
    if (copyEl && copyEl.dataset.copy) {
      navigator.clipboard?.writeText(copyEl.dataset.copy);
      copyEl.classList.add("copied"); // CSS-only checkmark, no text to translate
      setTimeout(() => copyEl.classList.remove("copied"), 900);
      return;
    }
    const row = e.target.closest(".fav") && e.target.closest(".row");
    if (row && row.dataset.favModel) toggleFav(row.dataset.favModel);
  }

  fovMapResultsEl.addEventListener("click", onListClick);

  resultsEl.addEventListener("click", onListClick);

  // ---------------------------------------------------------------------
  // Category quick links.
  //
  // Filled from axisFavoriteCategories, which products-content.js writes
  // when a category tile is hearted on axis.com/products. Capped at 4 by
  // the writer (first four hearted win); this side just renders whatever
  // is stored, sliced to the same cap defensively.
  //
  // Labels come from this table rather than the site, so they're stable
  // and short enough to sit four-up in a 420px popup. English-only, same
  // as the Selector/Products/My Axis row above.
  // ---------------------------------------------------------------------
  const CATEGORIES_KEY = "axisFavoriteCategories";
  const MAX_FAVORITE_CATEGORIES = 4;
  // "Extras" and "Ex-proof" are deliberately shorter than Axis's own
  // "Accessories" / "Explosion-protected devices": four-up in a 420px popup
  // leaves ~80px per button, and a 12px icon plus its gap takes 16 of that,
  // so the label gets 64px. Those two measured 71px and 73px at 11.5px Arial
  // bold and were the only two that clipped. The other ten are unchanged.
  const CATEGORY_LABELS = {
    "network-cameras": "Cameras",
    "network-intercoms": "Intercoms",
    "video-analytics": "Analytics",
    "management-software": "Software",
    "radar-devices": "Radar",
    "accessories": "Extras",
    "access-control": "Access",
    "network-audio": "Audio",
    "body-worn": "Body worn",
    "storage-and-recorders": "Storage",
    "system-devices": "System",
    "explosion-protected-devices": "Ex-proof",
  };
  // 24-grid stroke icons, same construction as the tab icons. Rendered at
  // 12px in the category row.
  const CATEGORY_ICONS = {
    "network-cameras":
      '<rect x="3" y="7.5" width="13" height="8.5" rx="2"/><path d="M16 10.5h3.2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H16"/><path d="M9.5 16v3.5M6 20.5h7"/>',
    "network-intercoms":
      '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M9.5 7.5h5M9.5 10.5h5"/><circle cx="12" cy="16" r="2"/>',
    "video-analytics":
      '<path d="M4 8.5V4.5h4M16 4.5h4v4M20 15.5v4h-4M8 19.5H4v-4"/><circle cx="12" cy="10" r="2.2"/><path d="M8.4 17.2a3.6 3.6 0 0 1 7.2 0"/>',
    "management-software":
      '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8.4h18"/><path d="M12 17v4M8.5 21h7"/>',
    "radar-devices":
      '<path d="M4.5 14a7.5 7.5 0 0 1 15 0"/><path d="M8.9 14a3.1 3.1 0 0 1 6.2 0"/><path d="M12 14v6.3M9 20.3h6"/>',
    "accessories":
      '<path d="M17.6 4.6a4.6 4.6 0 0 0-5.8 5.8L4.5 17.7V20h2.3l7.3-7.3a4.6 4.6 0 0 0 5.8-5.8l-2.6 2.6-2.3-2.3z"/>',
    "access-control":
      '<rect x="3" y="5" width="11" height="14" rx="2"/><rect x="5.6" y="8" width="3.6" height="3" rx="0.6"/><path d="M17.6 9.2a4.2 4.2 0 0 1 0 5.6M20.4 6.6a8 8 0 0 1 0 10.8"/>',
    "network-audio":
      '<path d="M3.5 9.5h3L11 6v12L6.5 14.5h-3z"/><path d="M14.6 9.4a4 4 0 0 1 0 5.2M17.4 6.8a7.8 7.8 0 0 1 0 10.4"/>',
    "body-worn":
      '<rect x="5.5" y="3.5" width="11" height="17" rx="2.5"/><circle cx="11" cy="10" r="3"/><path d="M19 7.5h0.5v6H19"/>',
    "storage-and-recorders":
      '<rect x="3" y="5" width="18" height="5.5" rx="1.5"/><rect x="3" y="13.5" width="18" height="5.5" rx="1.5"/><path d="M15 7.75h3M15 16.25h3"/><circle cx="6.6" cy="7.75" r="1" fill="currentColor" stroke="none"/><circle cx="6.6" cy="16.25" r="1" fill="currentColor" stroke="none"/>',
    "system-devices":
      '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><path d="M12 14.6V20M6.5 6.5l3.7 3.7M17.5 6.5l-3.7 3.7"/><circle cx="12" cy="20" r="1.6"/>',
    "explosion-protected-devices":
      '<path d="M12 3l7.6 4.4v8.8L12 20.6 4.4 16.2V7.4z"/><path d="M12 9c1.7 1.8 2.7 3 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-.9.4-1.7 1.1-2.5"/>',
  };

  const catRowEl = document.getElementById("catRow");
  let favoriteCategories = [];

  function renderCategoryRow() {
    if (!catRowEl) return;
    const slugs = favoriteCategories
      .filter((sl) => CATEGORY_LABELS[sl])
      .slice(0, MAX_FAVORITE_CATEGORIES);
    catRowEl.innerHTML = "";
    catRowEl.hidden = slugs.length === 0;
    // The body class is what trades 28px of list area for the row - see
    // .axis-has-categories in popup.html.
    document.body.classList.toggle("axis-has-categories", slugs.length > 0);
    slugs.forEach((slug) => {
      const a = document.createElement("a");
      a.href = "https://www.axis.com/products/" + slug;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = t("categoryLinkTitle", "Open this Axis product category");
      // Icon + label, matching the quick-link row above. Both pieces are
      // our own constants, never anything a page supplied.
      a.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        (CATEGORY_ICONS[slug] || "") + "</svg>";
      const label = document.createElement("span");
      label.textContent = CATEGORY_LABELS[slug];
      a.appendChild(label);
      catRowEl.appendChild(a);
    });
    syncCatPickBtn();
  }

  // ---------------------------------------------------------------------
  // Category picker ("+" at the end of the quick-link row).
  //
  // Until now the only way to fill the category row was to heart a tile on
  // axis.com/products; this is the same list, editable from the popup. Same
  // CATEGORIES_KEY and same array shape, so the two writers are
  // interchangeable and chrome.storage.onChanged keeps both in sync.
  //
  // The panel reuses .filter-pop's fixed positioning: opening it must not
  // change the popup's height, which only ever has the two values the
  // .axis-has-categories rule allows.
  // ---------------------------------------------------------------------
  const catPickBtn = document.getElementById("catPickBtn");
  const catPickPop = document.getElementById("catPickPop");
  let catPickOpen = false;

  function syncCatPickBtn() {
    if (!catPickBtn) return;
    const title = t("catPickEdit", "Choose category shortcuts");
    catPickBtn.title = title;
    catPickBtn.setAttribute("aria-label", title);
  }

  function buildCatPickPop() {
    catPickPop.innerHTML = "";
    const head = document.createElement("div");
    head.className = "filter-sec";
    head.textContent = t("catPickHeading", "Shortcuts");
    catPickPop.appendChild(head);

    const chosen = favoriteCategories.filter((sl) => CATEGORY_LABELS[sl]);
    const full = chosen.length >= MAX_FAVORITE_CATEGORIES;

    Object.keys(CATEGORY_LABELS)
      .sort((a, b) => CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]))
      .forEach((slug) => {
        const row = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = chosen.indexOf(slug) >= 0;
        // The cap is enforced here, at the writer, exactly as it is on
        // axis.com/products - four fit on one line and a fifth would
        // squeeze every label to an ellipsis.
        cb.disabled = full && !cb.checked;
        if (cb.disabled) row.className = "disabled";
        cb.addEventListener("change", () => {
          const i = favoriteCategories.indexOf(slug);
          if (cb.checked && i < 0) favoriteCategories.push(slug);
          else if (!cb.checked && i >= 0) favoriteCategories.splice(i, 1);
          favoriteCategories = favoriteCategories.slice(0, MAX_FAVORITE_CATEGORIES);
          chrome.storage.local.set({ [CATEGORIES_KEY]: favoriteCategories.slice() });
          renderCategoryRow();
          buildCatPickPop();
        });
        const span = document.createElement("span");
        span.textContent = CATEGORY_LABELS[slug];
        row.appendChild(cb);
        row.appendChild(span);
        catPickPop.appendChild(row);
      });

    const note = document.createElement("div");
    note.className = "cat-pick-note";
    note.textContent = t("catPickNote", "Up to 4 fit in one row.");
    catPickPop.appendChild(note);
  }

  function positionCatPickPop() {
    const r = catPickBtn.getBoundingClientRect();
    catPickPop.style.top = "0px";
    catPickPop.style.left = "0px";
    const h = catPickPop.offsetHeight;
    const w = catPickPop.offsetWidth;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 6) top = Math.max(6, r.top - h - 4);
    let left = r.right - w;
    if (left < 6) left = 6;
    catPickPop.style.top = top + "px";
    catPickPop.style.left = left + "px";
  }

  function closeCatPickPop() {
    if (!catPickPop) return;
    catPickPop.hidden = true;
    catPickOpen = false;
    if (catPickBtn) catPickBtn.setAttribute("aria-expanded", "false");
  }

  if (catPickBtn && catPickPop) {
    catPickBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (catPickOpen) return closeCatPickPop();
      buildCatPickPop();
      catPickPop.hidden = false;
      catPickOpen = true;
      catPickBtn.setAttribute("aria-expanded", "true");
      positionCatPickPop();
    });
    catPickPop.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
      if (catPickOpen) closeCatPickPop();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && catPickOpen) closeCatPickPop();
    });
  }

  // ---------------------------------------------------------------------
  // Filter/sort popover UI. One panel element (#filterPop, a direct body
  // child) shared by both buttons - it's position:fixed because every
  // container it could otherwise live in is overflow:hidden and would clip
  // it. Coordinates come from whichever button opened it.
  // ---------------------------------------------------------------------
  const filterPop = document.getElementById("filterPop");
  const filterButtons = [
    document.getElementById("filterBtnCatalog"),
    document.getElementById("filterBtnFov"),
  ].filter(Boolean);
  let filterPopOpen = false;
  let filterPopAnchor = null;

  function saveFilterState() {
    try {
      chrome.storage.local.set({
        axisPopupChipsetFilter: Array.from(chipsetChecked),
        axisPopupSortMode: sortMode,
      });
    } catch (e) {
      /* storage unavailable - the filter just won't persist */
    }
  }

  // Re-renders both lists. render() already calls renderFovMapResults() at
  // its tail, so one call covers the pair.
  function applyFilterChange() {
    saveFilterState();
    updateFilterButtons();
    render(search(searchEl.value));
  }

  function updateFilterButtons() {
    const activeGroups = FILTER_GROUPS.filter((g) => g.members.every((m) => chipsetChecked.has(m))).length;
    const narrowed = chipsetChecked.size > 0;
    filterButtons.forEach((btn) => {
      btn.classList.toggle("active", narrowed || sortMode !== "fit");
      const label = btn.querySelector(".filter-btn-label");
      if (label) label.textContent = t("filterBtnText", "Filter");
      let countEl = btn.querySelector(".filter-count");
      if (narrowed) {
        if (!countEl) {
          countEl = document.createElement("span");
          countEl.className = "filter-count";
          btn.appendChild(countEl);
        }
        countEl.textContent = String(activeGroups || chipsetChecked.size);
      } else if (countEl) {
        countEl.remove();
      }
      btn.title = t("filterBtnTitle", "Filter by chipset and change the sort order");
    });
  }

  const SORT_LABELS = {
    fit: ["sortModeFit", "Best fit"],
    priceAsc: ["sortModePriceAsc", "Price — low to high"],
    priceDesc: ["sortModePriceDesc", "Price — high to low"],
    fovDesc: ["sortModeFovDesc", "FoV — widest first"],
  };

  function buildFilterPop() {
    filterPop.innerHTML = "";
    const sortHead = document.createElement("div");
    sortHead.className = "filter-sec";
    sortHead.textContent = t("filterSortHeading", "Sort by");
    filterPop.appendChild(sortHead);

    SORT_MODES.forEach((mode) => {
      const row = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "axisSortMode";
      input.checked = sortMode === mode;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        sortMode = mode;
        applyFilterChange();
      });
      const span = document.createElement("span");
      span.textContent = t(SORT_LABELS[mode][0], SORT_LABELS[mode][1]);
      row.appendChild(input);
      row.appendChild(span);
      filterPop.appendChild(row);
    });

    filterPop.appendChild(document.createElement("hr"));

    const chipHead = document.createElement("div");
    chipHead.className = "filter-sec";
    chipHead.textContent = t("filterChipsetHeading", "Chipset");
    filterPop.appendChild(chipHead);

    const boxes = [];
    FILTER_GROUPS.forEach((group) => {
      const row = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = group.members.every((m) => chipsetChecked.has(m));
      input.addEventListener("change", () => {
        group.members.forEach((m) => {
          if (input.checked) chipsetChecked.add(m);
          else chipsetChecked.delete(m);
        });
        applyFilterChange();
      });
      const span = document.createElement("span");
      span.textContent = group.label;
      row.appendChild(input);
      row.appendChild(span);
      filterPop.appendChild(row);
      boxes.push({ input, group });
    });

    const foot = document.createElement("div");
    foot.className = "filter-foot";
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.textContent = t("filterSelectAll", "Select all");
    allBtn.addEventListener("click", () => {
      FILTER_GROUPS.forEach((g) => g.members.forEach((m) => chipsetChecked.add(m)));
      boxes.forEach((b) => (b.input.checked = true));
      applyFilterChange();
    });
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.textContent = t("filterClear", "Clear");
    clearBtn.addEventListener("click", () => {
      chipsetChecked.clear();
      boxes.forEach((b) => (b.input.checked = false));
      applyFilterChange();
    });
    foot.appendChild(allBtn);
    foot.appendChild(clearBtn);
    filterPop.appendChild(foot);
  }

  function positionFilterPop(btn) {
    const r = btn.getBoundingClientRect();
    // Measure first, then clamp into the popup viewport - the panel is
    // taller than the space under the FoV results header, so it often has
    // to be pushed up rather than dropped down.
    filterPop.style.top = "0px";
    filterPop.style.left = "0px";
    const h = filterPop.offsetHeight;
    const w = filterPop.offsetWidth;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 6) top = Math.max(6, r.top - h - 4);
    let left = r.right - w;
    if (left < 6) left = 6;
    filterPop.style.top = top + "px";
    filterPop.style.left = left + "px";
  }

  function openFilterPop(btn) {
    filterPopAnchor = btn;
    buildFilterPop();
    filterPop.hidden = false;
    filterPopOpen = true;
    positionFilterPop(btn);
  }

  function closeFilterPop() {
    filterPop.hidden = true;
    filterPopOpen = false;
    filterPopAnchor = null;
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (filterPopOpen && filterPopAnchor === btn) closeFilterPop();
      else openFilterPop(btn);
    });
  });

  // Click-away / Esc to dismiss. Clicks inside the panel must not close it,
  // since every control in there is meant to be used in sequence.
  filterPop.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    if (filterPopOpen) closeFilterPop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && filterPopOpen) closeFilterPop();
  });

  // ---------------------------------------------------------------------
  // Shared chipset filter + sort order (BOTH lists).
  //
  // One state, two entry points: the Filter button in the Chipset & MSRP
  // search row and the one in the FoV Map results header open the same
  // #filterPop and write the same two values, so narrowing to ARTPEC-8 in
  // one tab is already narrowed in the other. Pavel's explicit pick over
  // per-list state.
  //
  // Grouping mirrors content.js's FILTER_GROUPS on the Product Selector
  // overlay - one checkbox per group, with the underlying exact canonical
  // labels stored - so the two surfaces offer the same five choices.
  // ---------------------------------------------------------------------
  const FILTER_GROUPS = [
    { label: "ARTPEC-9", members: ["ARTPEC-9"] },
    { label: "ARTPEC-8", members: ["ARTPEC-8"] },
    { label: "ARTPEC-6/7", members: ["ARTPEC-6/7"] },
    { label: "ARTPEC-3/4/5", members: ["ARTPEC-5", "ARTPEC-4", "ARTPEC-3"] },
    {
      label: "Ambarella",
      members: ["Ambarella CV75", "Ambarella CV25", "Ambarella S3L", "Ambarella S2L", "Ambarella S2E", "Ambarella A5S"],
    },
  ];
  const SORT_MODES = ["fit", "priceAsc", "priceDesc", "fovDesc"];

  // Empty set = no chipset filter at all (show everything), NOT "hide
  // everything" - so the default state needs no checkboxes ticked.
  let chipsetChecked = new Set();
  // "fit" = each list's own existing default: best-fit ranking for the FoV
  // results, catalog order for the Chipset & MSRP list.
  let sortMode = "fit";

  function chipsetFilterOk(it) {
    if (!chipsetChecked.size) return true;
    const c = chipsetFor(it.model);
    // Fails CLOSED, same as content.js's card matching and angleFilterOk
    // above: a model with no chipset data isn't a match once a specific
    // chipset has been asked for.
    return c ? chipsetChecked.has(c) : false;
  }

  function sortPriceOf(it) {
    return it.msrp_eur ?? it.msrp ?? Infinity;
  }
  // Widest lens the model itself has. PTZ pan range is deliberately NOT
  // used here (unlike coverableAngle) - "widest FoV" means the optics, and
  // mixing in a 360 pan would put every PTZ on top regardless of lens.
  function sortFovOf(it) {
    const fov = fovFor(displayNameFor(it));
    return fov ? fov.max : -Infinity;
  }

  // Applies the chosen sort with favorites always pinned to the top
  // (Pavel's pick: the shortlist you're speccing from stays the shortlist,
  // and the chosen order applies within each block). `fallback` is the
  // list's own "fit" ordering, run only when sortMode is "fit".
  function applySort(list, fallback) {
    return list.sort((a, b) => {
      const favDiff = (isFav(b.model) ? 1 : 0) - (isFav(a.model) ? 1 : 0);
      if (favDiff) return favDiff;
      if (sortMode === "priceAsc") return sortPriceOf(a) - sortPriceOf(b);
      if (sortMode === "priceDesc") return sortPriceOf(b) - sortPriceOf(a);
      if (sortMode === "fovDesc") return sortFovOf(b) - sortFovOf(a);
      return fallback ? fallback(a, b) : 0;
    });
  }

  function search(q) {
    q = q.trim().toUpperCase();
    const base = !q
      ? flat
      : flat.filter(
          (it) =>
            it.model.toUpperCase().includes(q) ||
            (it.part_number && it.part_number.toUpperCase().includes(q)) ||
            (it.variant && it.variant.toUpperCase().includes(q))
        );
    // The FOV Map's required-angle filter (if active) applies on top of the
    // text search, same as content.js's chipset/angle filters being ANDed
    // together on the Product Selector page. render() still caps the actual
    // list at 60 rows - filtering here first (rather than slicing before
    // filtering, as the old no-query branch used to) means the angle filter
    // narrows the full catalog, not just whatever the first 60 happened to be.
    // Favorited models are stably sorted to the front of whatever matched,
    // so favoriting always surfaces a camera at the top of the list.
    // Chipset filter ANDs on top of both the text query and the angle
    // filter. applySort keeps favorites first in every mode; with sortMode
    // "fit" that is exactly the old favorites-first-on-catalog-order.
    return applySort(base.filter(angleFilterOk).filter(chipsetFilterOk), null);
  }

  searchEl.addEventListener("input", () => render(search(searchEl.value)));

  // ---- Currency toggle (EUR default / USD / GBP / JPY / OFF = prices hidden) ----
  const usdBtn = document.getElementById("currencyUSD");
  const eurBtn = document.getElementById("currencyEUR");
  const gbpBtn = document.getElementById("currencyGBP");
  const jpyBtn = document.getElementById("currencyJPY");
  const offBtn = document.getElementById("currencyOFF");
  const fxSectionEl = document.getElementById("fxSection");
  const chipsetSectionEl = document.getElementById("chipsetSection");
  const footerSectionEl = document.getElementById("footerSection");
  const currencySectionEl = document.getElementById("currencySection");
  const monthlySectionEl = document.getElementById("monthlySection");
  const languageSectionEl = document.getElementById("languageSection");
  const footerTextEl = document.getElementById("footerText");

  // ---- Advanced/info drawer: Currency, FX rates, the chipset-data update
  // row, the monthly price-override link, and the footer disclaimer are all
  // collapsed by default (see the body:not(.axis-advanced-visible) base CSS)
  // and only shown once #advancedBtn is toggled on, so the popup opens
  // compact and quick to scan. ----
  const advancedBtn = document.getElementById("advancedBtn");
  let advancedVisible = false;
  function applyAdvancedVisibility() {
    document.body.classList.toggle("axis-advanced-visible", advancedVisible);
    if (chipsetSectionEl) chipsetSectionEl.style.display = "";
    if (footerSectionEl) footerSectionEl.style.display = "";
    if (currencySectionEl) currencySectionEl.style.display = "";
    if (monthlySectionEl) monthlySectionEl.style.display = "";
    if (languageSectionEl) languageSectionEl.style.display = "";
    // The FX row stays hidden even in advanced mode once prices are off -
    // it only exists to explain a EUR->USD/GBP/JPY conversion that isn't shown.
    // Explicitly forcing "none" here (rather than leaving it to the base
    // CSS) is what actually hides it in that case, since the base rule only
    // fires while .axis-advanced-visible is absent.
    if (fxSectionEl) fxSectionEl.style.display = advancedVisible && pricesHidden() ? "none" : "";
    if (advancedBtn) advancedBtn.classList.toggle("active", advancedVisible);
  }
  advancedBtn.addEventListener("click", () => {
    advancedVisible = !advancedVisible;
    applyAdvancedVisibility();
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ axisPopupAdvancedVisible: advancedVisible });
    }
  });
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("axisPopupAdvancedVisible", (r) => {
      advancedVisible = !!r.axisPopupAdvancedVisible;
      applyAdvancedVisibility();
    });
  }

  // Static labels/placeholders/tooltips that don't depend on any live data -
  // applied once at startup and again whenever the language flag picker
  // changes (see setLanguage()).
  function applyStaticI18nLabels() {
    const languageLabelEl = document.getElementById("languageLabel");
    if (languageLabelEl) languageLabelEl.textContent = t("languageLabel", "Language");
    document.getElementById("currencyLabel").textContent = t("currencyLabel", "Currency");
    document.getElementById("fxLabel").textContent = t("fxLabel", "FX rates (EUR→USD/GBP/JPY)");
    document.getElementById("chipsetLabel").textContent = t("chipsetLabel", "Chipset data (CamStreamer)");
    document.getElementById("monthlyLabel").textContent = t("monthlyLabel", "UPLOAD .XLS PRICELIST");
    searchEl.placeholder = t("searchPlaceholder", "Search model or part number…");
    document.getElementById("fovMapBtn").title = t("fovMapBtnTitle", "Open the full-screen FOV Map tool");
    document.getElementById("fovMapBtn").textContent = t("fovMapBtnText", "⛶ Full Screen");
    // Tab labels live in .tab-label spans (the buttons also carry an inline
    // SVG icon), so only the text is swapped here. "MSRP" and "IP Utility"
    // stay untranslated on purpose: MSRP is the industry acronym everyone in
    // this audience uses, and IP Utility is the name of the Axis tool this
    // tab replaces; "FoV" follows Axis's own casing.
    // Each label is two lines ("\n" + white-space: pre-line on .tab-label).
    document.getElementById("catalogTabLabel").textContent = t("catalogTabBtnText", "Chipset &\nMSRP");
    document.getElementById("fovMapToggleLabel").textContent = t("fovMapToggleBtnText", "FoV Map\nTool");
    document.getElementById("findCamsLabel").textContent = t("findCamsBtnText", "IP Utility\nScanner");
    document.getElementById("findCamsBtn").title = t("findCamsBtnTitle", "Scan your local network for Axis cameras (model, serial, firmware, chipset)");
    document.getElementById("findCamsHeading").textContent = t("findCamsHeading", "Axis cameras on this network");
    document.getElementById("angleFieldLabel").textContent = t("angleFieldLabel", "Required FoV");
    document.getElementById("fovMapResultsHeading").textContent = t("fovMapResultsHeading", "Matching models");
    document.getElementById("angleSlider").title = t(
      "angleSliderTitle",
      "Only show cameras that can cover at least this many degrees - a PTZ's full pan range counts, not just its lens width. Same requirement drawing a cone on the map to the left sets."
    );
    document.getElementById("advancedBtn").title = t("advancedBtnTitle", "Show/hide currency, FX rates, chipset update info, monthly price updates, and the price disclaimer");
    document.getElementById("settingsBtn").title = t("settingsBtnTitle", "Update monthly prices");
    document.getElementById("themeToggle").title = t("themeToggleTitle", "Toggle light/dark theme");
    document.getElementById("kofiBtn").title = t("kofiBtnTitle", "Buy Pavel a coffee — support this extension");
    offBtn.title = t("currencyOffTitle", "Hide all prices — keep chipset info and FOV filtering");
    // Idle-state button labels only - don't clobber "Updating…" mid-request.
    if (!refreshBtn.disabled) refreshBtn.textContent = t("update", "Update");
    if (!refreshFxBtn.disabled) refreshFxBtn.textContent = t("update", "Update");
    // Both Filter buttons' label + title; the popover itself is rebuilt
    // from scratch on every open, so it always picks the new language up.
    updateFilterButtons();
  }

  // Footer disclaimer text follows the picked language (see the flag row
  // below), independent of currency - it's one <span> whose textContent is
  // set directly rather than one static span per language.
  function applyFooterText() {
    if (footerTextEl) footerTextEl.textContent = t("footerDisclaimer", FOOTER_EN);
  }

  // ---- Language picker (flags) - independent of currency: picking a
  // language never touches currentCurrency, and switching currency never
  // touches currentLang. Defaults to a navigator.language match (English if
  // none of the supported codes match), then a stored explicit pick (if any)
  // takes over for good. ----
  const languageFlagsEl = document.getElementById("languageFlags");
  function renderLanguageButtons() {
    if (!languageFlagsEl) return;
    languageFlagsEl.innerHTML = "";
    LANGS.forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = l.flag;
      b.title = l.name;
      b.classList.toggle("active", currentLang === l.code);
      b.addEventListener("click", () => setLanguage(l.code, true));
      languageFlagsEl.appendChild(b);
    });
  }
  function setLanguage(code, persist) {
    currentLang = LANGS.some((l) => l.code === code) ? code : "en";
    renderLanguageButtons();
    applyStaticI18nLabels();
    applyFooterText();
    renderChipsetStatus();
    renderFxStatus();
    render(search(searchEl.value));
    if (persist && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ axisPopupLang: currentLang });
    }
  }

  function setCurrency(next, persist) {
    currentCurrency = next === "USD" || next === "GBP" || next === "JPY" || next === "OFF" ? next : "EUR";
    usdBtn.classList.toggle("active", currentCurrency === "USD");
    eurBtn.classList.toggle("active", currentCurrency === "EUR");
    gbpBtn.classList.toggle("active", currentCurrency === "GBP");
    jpyBtn.classList.toggle("active", currentCurrency === "JPY");
    offBtn.classList.toggle("active", currentCurrency === "OFF");
    // The FX-rate row only exists to explain the EUR→USD/GBP/JPY conversion,
    // so it's noise once prices are hidden - applyAdvancedVisibility() folds
    // that check in alongside the advanced-drawer open/closed state. Currency
    // never touches language (footer text, labels, etc.) - the two are
    // independent settings.
    applyAdvancedVisibility();
    render(search(searchEl.value));
    if (persist && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ axisCurrency: currentCurrency });
    }
  }
  usdBtn.addEventListener("click", () => setCurrency("USD", true));
  eurBtn.addEventListener("click", () => setCurrency("EUR", true));
  gbpBtn.addEventListener("click", () => setCurrency("GBP", true));
  jpyBtn.addEventListener("click", () => setCurrency("JPY", true));
  offBtn.addEventListener("click", () => setCurrency("OFF", true));

  // ---- Startup: apply any stored monthly price override before building the
  // searchable list, then read the saved currency choice, then do the first render.
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["catalogOverride", "axisCurrency", "chipsetData", "fxRates", FAVORITES_KEY, "axisPopupChipsetFilter", "axisPopupSortMode", CATEGORIES_KEY], (r) => {
      applyCatalogOverride(r.catalogOverride);
      buildFlat();
      if (r.chipsetData && Object.keys(r.chipsetData).length > 0) {
        CHIPSETS = r.chipsetData;
        rebuildChipsetIndex();
      }
      if (r.fxRates) fxRates = r.fxRates;
      if (Array.isArray(r[FAVORITES_KEY])) favorites = new Set(r[FAVORITES_KEY]);
      // Chipset filter / sort order survive a popup close, like the active
      // tab and currency do - reopening to an unexplained short list would
      // be worse than reopening to a visibly active Filter button.
      if (Array.isArray(r.axisPopupChipsetFilter)) chipsetChecked = new Set(r.axisPopupChipsetFilter);
      if (SORT_MODES.includes(r.axisPopupSortMode)) sortMode = r.axisPopupSortMode;
      if (Array.isArray(r[CATEGORIES_KEY])) favoriteCategories = r[CATEGORIES_KEY];
      renderCategoryRow();
      updateFilterButtons();
      if (r.axisCurrency === "USD" || r.axisCurrency === "GBP" || r.axisCurrency === "JPY" || r.axisCurrency === "EUR" || r.axisCurrency === "OFF") {
        // User has picked (or a previous session already defaulted) a
        // currency before - respect it, and don't touch storage.
        setCurrency(r.axisCurrency, false);
      } else {
        // Never explicitly set - infer a sensible default from the
        // browser's locale and persist it, so it sticks and the popup/
        // content scripts on axis.com agree on the same starting point.
        setCurrency(localeDefaultCurrency(), true);
      }
      render(search(""));
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.catalogOverride) {
        applyCatalogOverride(changes.catalogOverride.newValue);
        buildFlat();
        render(search(searchEl.value));
      }
      if (changes.chipsetData) {
        CHIPSETS = changes.chipsetData.newValue || {};
        rebuildChipsetIndex();
        render(search(searchEl.value));
      }
      if (changes.fxRates) {
        fxRates = changes.fxRates.newValue || null;
        if (currentCurrency === "JPY" || currentCurrency === "GBP") render(search(searchEl.value));
      }
      if (changes[CATEGORIES_KEY]) {
        // Picks up a category hearted on axis.com/products while the popup
        // happens to be open (rare, but the popup also reopens fast enough
        // after a scan that it's worth keeping in sync).
        favoriteCategories = Array.isArray(changes[CATEGORIES_KEY].newValue) ? changes[CATEGORIES_KEY].newValue : [];
        renderCategoryRow();
        if (catPickOpen) buildCatPickPop();
      }
      if (changes[FAVORITES_KEY]) {
        // Picks up favorites toggled on the live Product Selector page (or
        // its Filters panel) while this popup happens to be open.
        favorites = new Set(Array.isArray(changes[FAVORITES_KEY].newValue) ? changes[FAVORITES_KEY].newValue : []);
        render(search(searchEl.value));
      }
    });
  } else {
    buildFlat();
    renderCategoryRow();
    updateFilterButtons();
    render(search(""));
  }

  // ---- Settings (gear) button - opens the monthly price-update page ----
  const settingsBtn = document.getElementById("settingsBtn");
  settingsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
  });

  // ---------------------------------------------------------------------
  // Compact FOV Map - same click-drag cone-drawing tool as content.js's
  // Filters-panel map column, ported here so it's reachable right inside the
  // popup instead of only via the full fov-map.html page. Laid out the same
  // way as that panel too: pressing the big yellow "FOV Map" button widens
  // the whole popup to the left to reveal a map column (#fovMapColumn),
  // rather than stacking the map above everything else. The small 🗺 header
  // icon is separate and always opens the full-page fov-map.html tool.
  // Drawing (or resetting) a cone, or moving the Required angle slider,
  // sets mapAngleRequired and re-filters the results list below via
  // angleFilterOk(), same as content.js's mapFilterOk().
  // ---------------------------------------------------------------------
  const fovMapBtn = document.getElementById("fovMapBtn");
  fovMapBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("fov-map.html") });
  });
  // Catalogue / FOV Map / Find Camera are single-column views switched via
  // .view-tabs (see showView() below) instead of side columns that used to
  // widen the popup - Chrome's extension-popup window auto-grows to fit new
  // content just fine, but has a longstanding, verified-unfixable-from-here
  // bug where it never shrinks itself back down afterward. A fixed-size
  // popup that never asks Chrome to resize it sidesteps that entirely.
  const viewButtons = {
    catalog: document.getElementById("catalogTabBtn"),
    fovmap: document.getElementById("fovMapToggleBtn"),
    findcams: document.getElementById("findCamsBtn"),
  };
  const viewPanels = {
    catalog: document.getElementById("catalogView"),
    fovmap: document.getElementById("fovMapView"),
    findcams: document.getElementById("findCamsView"),
  };
  function showView(name) {
    Object.keys(viewPanels).forEach((key) => {
      viewButtons[key].classList.toggle("active", key === name);
      viewPanels[key].classList.toggle("active", key === name);
    });
    // Remembered on the next popup open (see the restore block at the end
    // of this file) - e.g. following a Find Camera result's IP out to its
    // own tab and reopening the popup lands back on Find Camera instead of
    // always resetting to Catalogue.
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ axisPopupActiveView: name });
    }
  }
  viewButtons.catalog.addEventListener("click", () => showView("catalog"));

  // Find Cams: shared module is mounted on first open with the popup's own
  // live chipset lookup. ⛶ opens the same tool full-page.
  const findCamsBtn = viewButtons.findcams;
  let findCamsMounted = false;
  function ensureFindCamsMounted() {
    if (!findCamsMounted) {
      findCamsMounted = true;
      AxisFindCams.mount(document.getElementById("findCamsMount"), { chipsetFor });
    }
  }
  findCamsBtn.addEventListener("click", () => {
    showView("findcams");
    ensureFindCamsMounted();
  });
  document.getElementById("findCamsPageBtn").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("find-cams.html") });
  });

  // Ko-fi header icon - opens the support page in a new tab. Deliberately
  // just a link-out; no tracking, no in-popup iframe, nothing that touches
  // pricing/catalog state.
  const kofiBtn = document.getElementById("kofiBtn");
  kofiBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://ko-fi.com/K3K6RR4LY" });
  });

  const fovMapToggleBtn = viewButtons.fovmap;
  const fovMapCanvasEl = document.getElementById("fovMapCanvas");
  const fovMapStepTextEl = document.getElementById("fovMapStepText");
  const fovMapResetBtn = document.getElementById("fovMapResetBtn");
  const angleSliderEl = document.getElementById("angleSlider");
  const angleValueInputEl = document.getElementById("angleValueInput");

  // Lets the map's own cone-drawing keep the slider/number input in sync,
  // and vice versa - set inside initFovMap() once the map exists, called
  // from commitRequiredAngle() below whenever the slider/input changes.
  let applyRequiredAngleToMap = null;

  function renderRequiredAngleUI(angle) {
    const a = angle == null ? 0 : angle;
    const rounded = Math.round(Math.min(360, Math.max(0, a)));
    angleSliderEl.value = String(rounded);
    angleValueInputEl.value = String(rounded);
  }

  function commitRequiredAngle(v) {
    mapAngleRequired = v > 0 ? v : null;
    renderRequiredAngleUI(v);
    render(search(searchEl.value));
    if (applyRequiredAngleToMap) applyRequiredAngleToMap(v);
  }
  angleSliderEl.addEventListener("input", () => {
    commitRequiredAngle(parseFloat(angleSliderEl.value) || 0);
  });
  angleValueInputEl.addEventListener("input", () => {
    commitRequiredAngle(Math.min(360, Math.max(0, parseFloat(angleValueInputEl.value) || 0)));
  });
  angleValueInputEl.addEventListener("blur", () => renderRequiredAngleUI(mapAngleRequired));

  let fovMapInitialized = false;
  let fovMap = null;

  function ensureFovMapInitialized() {
    if (!fovMapInitialized) {
      fovMapInitialized = true;
      initFovMap();
    }
    // The view is toggled via display:none -> flex (see .view.active), not
    // a width/slide animation any more, so a single resize() once
    // the browser has laid out the now-visible box is enough - no
    // transitionend handshake needed. A short setTimeout backs up the
    // requestAnimationFrame in case the box isn't painted yet on the first tick.
    requestAnimationFrame(() => {
      if (fovMap) fovMap.resize();
    });
    setTimeout(() => fovMap && fovMap.resize(), 150);
  }

  function initFovMap() {
    if (typeof AxisMap === "undefined") return; // axis-map.js/maplibre failed to load - don't break the rest of the popup

    fovMap = AxisMap.create(fovMapCanvasEl, {
      center: { lat: 50.0755, lng: 14.4378 }, // Prague default; replaced below by IP geolocation if it resolves
      zoom: 10,
      theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
      noteText: t("mapTilesUnavailable", "Map tiles unavailable — the coverage tool still works."),
    });
    setTimeout(() => fovMap.resize(), 0);

    // IP-based (not GPS/permission-based) geolocation, purely to roughly
    // center the map on load - see content.js for the same approach/rationale.
    fetch("https://get.geojs.io/v1/ip/geo.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        if (!isNaN(lat) && !isNaN(lon)) fovMap.setView([lat, lon], 10);
      })
      .catch(() => {
        /* offline / blocked - keep the default view */
      });

    const STEP = { CAMERA: 0, EDGE1: 1, EDGE2: 2, DONE: 3 };
    let step = STEP.CAMERA;
    let cameraLatLng = null;
    let edge1LatLng = null;
    let edge2LatLng = null;
    let cameraMarker = null;
    let edge1Marker = null;
    let edge2Marker = null;
    let edge1Line = null;
    let edge2Line = null;
    let draftLine = null;
    let conePolygon = null;
    let dragging = false;
    let coneCentre = 0;
    let manualAngle = null;
    let manualRange = null;

    const EDGE_HANDLE = { className: "axis-fovmap-edge-handle", draggable: true };
    const CAMERA_ICON = { className: "axis-fovmap-camera-icon", html: "📷", draggable: true };

    function setStepText() {
      if (step === STEP.CAMERA) fovMapStepTextEl.textContent = t("fovMapStepCamera", "Click the map to drop the camera location.");
      else if (step === STEP.EDGE1) fovMapStepTextEl.textContent = t("fovMapStepEdge1", "Click-drag from the camera to set one edge of the required coverage.");
      else if (step === STEP.EDGE2) fovMapStepTextEl.textContent = t("fovMapStepEdge2", "Click-drag again to set the other edge of the cone.");
      else fovMapStepTextEl.textContent = t("fovMapStepDone", "Drag the pin or either yellow handle to reshape - keep dragging outward to open past 180° up to a full circle.");
    }
    setStepText();

    function bearingDeg(a, b) {
      const phi1 = (a.lat * Math.PI) / 180;
      const phi2 = (b.lat * Math.PI) / 180;
      const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
      const y = Math.sin(dLambda) * Math.cos(phi2);
      const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
      return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    }

    function destPoint(start, bearing, distanceM) {
      const R = 6371000;
      const delta = distanceM / R;
      const theta = (bearing * Math.PI) / 180;
      const phi1 = (start.lat * Math.PI) / 180;
      const lambda1 = (start.lng * Math.PI) / 180;
      const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
      const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
      return { lat: (phi2 * 180) / Math.PI, lng: (lambda2 * 180) / Math.PI };
    }

    function angleDiff(a, b) {
      let d = (b - a) % 360;
      if (d > 180) d -= 360;
      if (d <= -180) d += 360;
      return d;
    }

    // Of the two possible sectors described by the two edge bearings, pick
    // whichever keeps the cone's centre nearest its current centre - see
    // content.js/fov-map.js for the full rationale.
    function computeConeFromEdges(currentCentre) {
      const b1 = bearingDeg(cameraLatLng, edge1LatLng);
      const b2 = bearingDeg(cameraLatLng, edge2LatLng);
      const d1 = fovMap.distance(cameraLatLng, edge1LatLng);
      const d2 = fovMap.distance(cameraLatLng, edge2LatLng);

      const minor = angleDiff(b1, b2);
      const major = minor === 0 ? 360 : minor - Math.sign(minor) * 360;

      let sweep = minor;
      if (typeof currentCentre === "number") {
        const centreOf = (s) => (b1 + s / 2 + 360) % 360;
        const offBy = (s) => Math.abs(angleDiff(currentCentre, centreOf(s)));
        if (offBy(major) < offBy(minor)) sweep = major;
      }
      return {
        centre: (b1 + sweep / 2 + 360) % 360,
        angle: Math.abs(sweep),
        range: Math.max(d1, d2),
      };
    }

    function drawCone(centre, angle, range) {
      // One persistent GeoJSON source, re-fed on every redraw.
      const steps = Math.max(24, Math.ceil(angle / 4));
      const start = centre - angle / 2;
      const pts = [];
      if (angle < 359.9) pts.push(cameraLatLng);
      for (let i = 0; i <= steps; i++) {
        pts.push(destPoint(cameraLatLng, start + (angle * i) / steps, range));
      }
      if (angle < 359.9) pts.push(cameraLatLng);
      if (conePolygon) conePolygon.setLatLngs(pts);
        else conePolygon = fovMap.cone("axis-popup-cone", pts);
    }

    function applyMapMatch() {
      mapAngleRequired = manualAngle;
      renderRequiredAngleUI(manualAngle); // keep the Required angle slider/input in sync
      render(search(searchEl.value));
    }

    // Lets the Required angle slider/input reshape an already-drawn cone so
    // the two controls stay visually consistent, not just consistent in the
    // resulting filter - mirrors content.js's own applyRequiredAngleToMap.
    applyRequiredAngleToMap = function (angle) {
      if (step !== STEP.DONE || !cameraLatLng) return;
      manualAngle = angle > 0 ? angle : 0.1;
      drawCone(coneCentre, manualAngle, manualRange);
    };

    function updateFromGeometry(hint) {
      const cone = computeConeFromEdges(hint);
      manualAngle = Math.round(cone.angle * 10) / 10;
      manualRange = Math.round(cone.range);
      coneCentre = cone.centre;
      drawCone(coneCentre, manualAngle, manualRange);
      applyMapMatch();
    }

    function updateFromDrag() {
      updateFromGeometry(coneCentre);
    }

    function finalizeCone() {
      step = STEP.DONE;
      setStepText();
      updateFromGeometry(); // no hint - first draw takes the minor sector
    }

    function makeCameraDraggable() {
      cameraMarker.setDraggable(true);
      cameraMarker.on("drag", (e) => {
        cameraLatLng = e.target.getLatLng();
        if (edge1LatLng) edge1Line.setLatLngs([cameraLatLng, edge1LatLng]);
        if (edge2LatLng) edge2Line.setLatLngs([cameraLatLng, edge2LatLng]);
        if (step === STEP.DONE) updateFromDrag();
      });
    }

    fovMap.on("click", (e) => {
      if (step === STEP.CAMERA) {
        cameraLatLng = e.latlng;
        cameraMarker = fovMap.marker(cameraLatLng, CAMERA_ICON);
        makeCameraDraggable();
        step = STEP.EDGE1;
        setStepText();
      }
    });

    fovMap.on("mousedown", (e) => {
      if (step !== STEP.EDGE1 && step !== STEP.EDGE2) return;
      dragging = true;
      fovMap.setDragEnabled(false);
      draftLine = fovMap.line("axis-popup-draft", [cameraLatLng, e.latlng], { dashed: true });
    });
    fovMap.on("mousemove", (e) => {
      if (!dragging || !draftLine) return;
      draftLine.setLatLngs([cameraLatLng, e.latlng]);
    });
    fovMap.on("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      fovMap.setDragEnabled(true);
      if (draftLine) {
        draftLine.remove();
        draftLine = null;
      }
      if (step === STEP.EDGE1) {
        edge1LatLng = e.latlng;
        edge1Line = fovMap.line("axis-popup-edge1", [cameraLatLng, edge1LatLng]);
        edge1Marker = fovMap.marker(edge1LatLng, EDGE_HANDLE);
        edge1Marker.on("drag", (ev) => {
          edge1LatLng = ev.target.getLatLng();
          edge1Line.setLatLngs([cameraLatLng, edge1LatLng]);
          if (step === STEP.DONE) updateFromDrag();
        });
        step = STEP.EDGE2;
        setStepText();
      } else if (step === STEP.EDGE2) {
        edge2LatLng = e.latlng;
        edge2Line = fovMap.line("axis-popup-edge2", [cameraLatLng, edge2LatLng]);
        edge2Marker = fovMap.marker(edge2LatLng, EDGE_HANDLE);
        edge2Marker.on("drag", (ev) => {
          edge2LatLng = ev.target.getLatLng();
          edge2Line.setLatLngs([cameraLatLng, edge2LatLng]);
          if (step === STEP.DONE) updateFromDrag();
        });
        finalizeCone();
      }
    });

    fovMapResetBtn.addEventListener("click", () => {
      step = STEP.CAMERA;
      cameraLatLng = edge1LatLng = edge2LatLng = null;
      [cameraMarker, edge1Marker, edge2Marker, edge1Line, edge2Line, draftLine, conePolygon].forEach(
        (l) => l && l.remove()
      );
      cameraMarker = edge1Marker = edge2Marker = edge1Line = edge2Line = draftLine = conePolygon = null;
      manualAngle = manualRange = null;
      mapAngleRequired = null;
      renderRequiredAngleUI(0);
      render(search(searchEl.value));
      setStepText();
    });
  }

  fovMapToggleBtn.addEventListener("click", () => {
    showView("fovmap");
    ensureFovMapInitialized();
  });

  const themeBtn = document.getElementById("themeToggle");
  chrome.storage && chrome.storage.local
    ? chrome.storage.local.get("axisMsrpTheme", (r) => {
        if (r.axisMsrpTheme) document.documentElement.setAttribute("data-theme", r.axisMsrpTheme);
      })
    : null;
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    if (next === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    if (chrome.storage && chrome.storage.local) chrome.storage.local.set({ axisMsrpTheme: next });
  });

  // ---- Chipset data status / manual refresh ----
  const chipsetStatusEl = document.getElementById("chipsetStatus");
  const refreshBtn = document.getElementById("refreshChipsets");

  function fmtWhen(ts) {
    if (!ts) return t("never", "never");
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if (diffMin < 1) return t("justNow", "just now");
    if (diffMin < 60) return t("minAgo", diffMin + " min ago", diffMin);
    const diffH = Math.round(diffMin / 60);
    if (diffH < 48) return t("hAgo", diffH + " h ago", diffH);
    const days = Math.round(diffH / 24);
    return t("daysAgo", days + " days ago", days);
  }

  function renderChipsetStatus() {
    if (!chrome.storage || !chrome.storage.local) {
      chipsetStatusEl.textContent = t("unavailable", "unavailable");
      return;
    }
    chrome.storage.local.get(
      ["chipsetModelCount", "chipsetUpdatedAt", "chipsetLastError"],
      (r) => {
        if (r.chipsetLastError) {
          chipsetStatusEl.textContent = t("lastUpdateFailed", "Last update failed: " + r.chipsetLastError, r.chipsetLastError);
          chipsetStatusEl.classList.add("error");
        } else {
          chipsetStatusEl.classList.remove("error");
          const count = r.chipsetModelCount || 0;
          const when = fmtWhen(r.chipsetUpdatedAt);
          chipsetStatusEl.textContent = t(
            "chipsetStatusOk",
            count + " models · updated " + when,
            count,
            when
          );
        }
      }
    );
  }
  renderChipsetStatus();

  refreshBtn.addEventListener("click", () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = t("updating", "Updating…");
    chrome.runtime.sendMessage({ type: "REFRESH_CHIPSETS" }, (resp) => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = t("update", "Update");
      if (chrome.runtime.lastError) {
        chipsetStatusEl.textContent = t(
          "updateFailed",
          "Update failed: " + chrome.runtime.lastError.message,
          chrome.runtime.lastError.message
        );
        chipsetStatusEl.classList.add("error");
        return;
      }
      renderChipsetStatus();
    });
  });

  // ---- FX rate status / manual refresh (EUR/USD/GBP/JPY, powers the JPY/GBP/USD
  // toggle) - background.js normally fetches this weekly, but the first
  // fetch after install can fail silently (offline, endpoint hiccup) with
  // nothing else surfacing it, leaving JPY/USD stuck on "no rate yet"
  // forever until this button is used. ----
  const fxStatusEl = document.getElementById("fxStatus");
  const refreshFxBtn = document.getElementById("refreshFx");

  function renderFxStatus() {
    if (!chrome.storage || !chrome.storage.local) {
      fxStatusEl.textContent = t("unavailable", "unavailable");
      return;
    }
    chrome.storage.local.get(["fxRates", "fxUpdatedAt", "fxLastError"], (r) => {
      if (r.fxLastError && !r.fxRates) {
        fxStatusEl.textContent = t("lastUpdateFailed", "Last update failed: " + r.fxLastError, r.fxLastError);
        fxStatusEl.classList.add("error");
      } else if (r.fxRates) {
        fxStatusEl.classList.remove("error");
        const when = fmtWhen(r.fxUpdatedAt);
        const gbpPart = typeof r.fxRates.gbp === "number" ? " / £" + r.fxRates.gbp : "";
        fxStatusEl.textContent = t(
          "fxStatusOk",
          "1 EUR ≈ $" + r.fxRates.usd + gbpPart + " / ¥" + r.fxRates.jpy + " · updated " + when,
          r.fxRates.usd,
          r.fxRates.jpy,
          when
        );
      } else {
        fxStatusEl.textContent = t("notFetchedYet", "not fetched yet");
      }
    });
  }
  renderFxStatus();

  refreshFxBtn.addEventListener("click", () => {
    refreshFxBtn.disabled = true;
    refreshFxBtn.textContent = t("updating", "Updating…");
    chrome.runtime.sendMessage({ type: "REFRESH_FX" }, (resp) => {
      refreshFxBtn.disabled = false;
      refreshFxBtn.textContent = t("update", "Update");
      if (chrome.runtime.lastError) {
        fxStatusEl.textContent = t(
          "updateFailed",
          "Update failed: " + chrome.runtime.lastError.message,
          chrome.runtime.lastError.message
        );
        fxStatusEl.classList.add("error");
        return;
      }
      renderFxStatus();
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get("fxRates", (r) => {
          if (r.fxRates) fxRates = r.fxRates;
          if (currentCurrency === "JPY" || currentCurrency === "USD" || currentCurrency === "GBP") render(search(searchEl.value));
        });
      }
    });
  });

  // Language: auto-detect from navigator.language first (English if no
  // supported code matches), apply it immediately so the popup never
  // flashes English before a stored pick loads, then let an explicit stored
  // pick override it once storage resolves. Independent of currency - see
  // the flag row's own comment above for why those two settings don't touch
  // each other. It DOES feed AxisI18N (i18n.js), though: picking 日本語 here
  // also flips AxisI18N.isJapanese, which is what drives the older
  // Japanese-only strings in find-cams.js/fov-map.js/options.js and the
  // axis.com content scripts - otherwise those panels stayed in English
  // even with 日本語 selected up here.
  currentLang = detectLangCode();
  renderLanguageButtons();
  applyStaticI18nLabels();
  applyFooterText();
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("axisPopupLang", (r) => {
      if (r.axisPopupLang && LANGS.some((l) => l.code === r.axisPopupLang)) {
        setLanguage(r.axisPopupLang, false);
      }
    });
  }

  // Restore whichever of the three top tabs (Catalogue / FOV Map / Find
  // Camera) was active when the popup last closed - see showView() above,
  // which persists it on every switch. Catalogue is the HTML's own default
  // (see popup.html's #catalogView.active), so only fovmap/findcams need
  // any action here.
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("axisPopupActiveView", (r) => {
      if (r.axisPopupActiveView === "fovmap") {
        showView("fovmap");
        ensureFovMapInitialized();
      } else if (r.axisPopupActiveView === "findcams") {
        showView("findcams");
        ensureFindCamsMounted();
      }
    });
  }
})();
