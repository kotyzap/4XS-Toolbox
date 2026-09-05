// Find Cams - sweeps one /24 subnet for Axis devices via the unauthenticated
// VAPIX basicdeviceinfo.cgi endpoint (getAllUnrestrictedProperties, AXIS OS 10+)
// and shows model, serial, firmware and chipset (CamStreamer compatibility list).
// Extensions cannot do multicast discovery (Bonjour/ONVIF), so this is a plain
// HTTP sweep: same subnet, HTTP enabled on the camera.
//
// Shared module: popup.js mounts it into the popup's side column, and
// find-cams.html mounts the same thing full-page. Host permission is requested
// at scan time for the 254 specific addresses of the chosen subnet only (match
// patterns cannot express "192.168.1.*", so manifest.json declares optional
// "http://*/*" and we ask for the narrow per-IP subset here - nothing is
// granted at install time).
//
// Results and the scanned subnet persist in chrome.storage.local
// (findCamsCache) so reopening the popup shows the last list instantly
// instead of a blank panel. If permission for that subnet was already
// granted, mount() also silently re-scans in the background (no permission
// prompt possible without a user gesture, so this only fires when Chrome
// already considers the subnet approved) - the cached list stays on screen
// and updates live as fresher results come in.
//
//   AxisFindCams.mount(rootElement, { chipsetFor(name) -> string|null })
(function (global) {
  "use strict";

  const STRINGS = {
    cs: {
      scan: "Skenovat", rescan: "Znovu skenovat", stop: "Zastavit", csv: "CSV",
      idle: "Zadejte podsíť, ve které je váš Mac/PC, a stiskněte Skenovat.",
      scanning: (done, total, found) => `Skenuji… ${done}/${total} (nalezeno ${found})`,
      doneMsg: (found, secs) => `Nalezeno ${found} zařízení Axis za ${secs} s`,
      cachedMsg: (found, when) => `Nalezeno ${found} · skenováno ${when}`,
      autoUpdating: "Automatická aktualizace na pozadí…",
      denied: "Nelze skenovat: přístup k místní síti nebyl povolen.",
      badSubnet: "Podsíť musí být tři čísla, např. 192.168.1",
      none: "Žádné zařízení Axis neodpovědělo. Zkontrolujte podsíť a zda mají kamery povoleno HTTP.",
      hint: "Dotazuje každou adresu v podsíti na veřejné informace o zařízení (VAPIX basicdeviceinfo - u AXIS OS 10+ není potřeba heslo). Odpoví jen kamery ve stejné podsíti s povoleným HTTP. Nic neopouští váš počítač.",
      factoryDefault: "tovární výchozí .90", copied: "Zkopírováno", unknownChipset: "čipset neznámý",
      pageHeading: "Najít kamery Axis v této síti",
      justNow: "právě teď", minAgo: (n) => `před ${n} min`, hAgo: (n) => `před ${n} h`, daysAgo: (n) => `před ${n} dny`,
    },
    ja: {
      scan: "スキャン", rescan: "再スキャン", stop: "停止", csv: "CSV",
      idle: "お使いのPC/Macと同じサブネットを入力してスキャンを押してください。",
      scanning: (done, total, found) => `スキャン中… ${done}/${total}(${found} 台検出)`,
      doneMsg: (found, secs) => `${found} 台のAxisデバイスを検出(${secs} 秒)`,
      cachedMsg: (found, when) => `${found} 台検出 · ${when}にスキャン`,
      autoUpdating: "バックグラウンドで自動更新中…",
      denied: "ローカルネットワークへのアクセスが許可されていないためスキャンできません。",
      badSubnet: "サブネットは 192.168.1 のように3つの数字で入力してください。",
      none: "Axisデバイスが見つかりませんでした。サブネットを確認するか、カメラのHTTPが有効か確認してください。",
      hint: "各アドレスに公開デバイス情報(VAPIX basicdeviceinfo、AXIS OS 10+ではパスワード不要)を問い合わせてカメラを検出します。同じサブネット上でHTTPが有効なカメラのみ応答します。データは外部に送信されません。",
      factoryDefault: "工場出荷時 .90", copied: "コピーしました", unknownChipset: "チップセット不明",
      pageHeading: "このネットワーク上のAxisカメラを検索",
      justNow: "たった今", minAgo: (n) => `${n}分前`, hAgo: (n) => `${n}時間前`, daysAgo: (n) => `${n}日前`,
    },
    es: {
      scan: "Escanear", rescan: "Re-escanear", stop: "Detener", csv: "CSV",
      idle: "Introduce la subred de tu Mac/PC y pulsa Escanear.",
      scanning: (done, total, found) => `Escaneando… ${done}/${total} (${found} encontrados)`,
      doneMsg: (found, secs) => `${found} dispositivo(s) Axis encontrados en ${secs} s`,
      cachedMsg: (found, when) => `${found} encontrados · escaneado ${when}`,
      autoUpdating: "Actualizando automáticamente en segundo plano…",
      denied: "No se puede escanear: no se concedió acceso a la red local.",
      badSubnet: "La subred debe ser tres números, p. ej. 192.168.1",
      none: "Ningún dispositivo Axis respondió. Comprueba la subred y que el HTTP esté habilitado en las cámaras.",
      hint: "Consulta cada dirección de la subred para obtener su información pública de dispositivo (VAPIX basicdeviceinfo - sin contraseña en AXIS OS 10+). Solo responden las cámaras de la misma subred con HTTP habilitado. Nada sale de tu ordenador.",
      factoryDefault: "valor de fábrica .90", copied: "Copiado", unknownChipset: "chipset no disponible",
      pageHeading: "Buscar cámaras Axis en esta red",
      justNow: "ahora mismo", minAgo: (n) => `hace ${n} min`, hAgo: (n) => `hace ${n} h`, daysAgo: (n) => `hace ${n} días`,
    },
    de: {
      scan: "Scannen", rescan: "Erneut scannen", stop: "Stopp", csv: "CSV",
      idle: "Geben Sie das Subnetz Ihres Mac/PC ein und klicken Sie auf Scannen.",
      scanning: (done, total, found) => `Scanne… ${done}/${total} (${found} gefunden)`,
      doneMsg: (found, secs) => `${found} Axis-Gerät(e) in ${secs} s gefunden`,
      cachedMsg: (found, when) => `${found} gefunden · gescannt ${when}`,
      autoUpdating: "Automatische Aktualisierung im Hintergrund…",
      denied: "Scan nicht möglich: Zugriff auf das lokale Netzwerk wurde nicht gewährt.",
      badSubnet: "Das Subnetz muss aus drei Zahlen bestehen, z. B. 192.168.1",
      none: "Kein Axis-Gerät hat geantwortet. Prüfen Sie das Subnetz und ob HTTP auf den Kameras aktiviert ist.",
      hint: "Fragt jede Adresse im Subnetz nach öffentlichen Geräteinformationen ab (VAPIX basicdeviceinfo - kein Passwort bei AXIS OS 10+ nötig). Es antworten nur Kameras im selben Subnetz mit aktiviertem HTTP. Nichts verlässt Ihren Computer.",
      factoryDefault: "Werkseinstellung .90", copied: "Kopiert", unknownChipset: "Chipsatz unbekannt",
      pageHeading: "Axis-Kameras in diesem Netzwerk suchen",
      justNow: "gerade eben", minAgo: (n) => `vor ${n} Min.`, hAgo: (n) => `vor ${n} Std.`, daysAgo: (n) => `vor ${n} Tagen`,
    },
    fr: {
      scan: "Scanner", rescan: "Rescanner", stop: "Arrêter", csv: "CSV",
      idle: "Saisissez le sous-réseau de votre Mac/PC et appuyez sur Scanner.",
      scanning: (done, total, found) => `Analyse… ${done}/${total} (${found} trouvé(s))`,
      doneMsg: (found, secs) => `${found} appareil(s) Axis trouvé(s) en ${secs} s`,
      cachedMsg: (found, when) => `${found} trouvé(s) · analysé ${when}`,
      autoUpdating: "Mise à jour automatique en arrière-plan…",
      denied: "Analyse impossible : l'accès au réseau local n'a pas été accordé.",
      badSubnet: "Le sous-réseau doit être trois nombres, p. ex. 192.168.1",
      none: "Aucun appareil Axis n'a répondu. Vérifiez le sous-réseau et que le HTTP est activé sur les caméras.",
      hint: "Interroge chaque adresse du sous-réseau pour ses informations publiques d'appareil (VAPIX basicdeviceinfo - aucun mot de passe requis sous AXIS OS 10+). Seules les caméras du même sous-réseau avec HTTP activé répondent. Rien ne quitte votre ordinateur.",
      factoryDefault: "réglage d'usine .90", copied: "Copié", unknownChipset: "chipset non disponible",
      pageHeading: "Rechercher les caméras Axis sur ce réseau",
      justNow: "à l'instant", minAgo: (n) => `il y a ${n} min`, hAgo: (n) => `il y a ${n} h`, daysAgo: (n) => `il y a ${n} jours`,
    },
    ko: {
      scan: "스캔", rescan: "다시 스캔", stop: "중지", csv: "CSV",
      idle: "Mac/PC와 같은 서브넷을 입력하고 스캔을 누르세요.",
      scanning: (done, total, found) => `스캔 중… ${done}/${total} (${found}개 발견)`,
      doneMsg: (found, secs) => `${secs}초 만에 Axis 기기 ${found}개 발견`,
      cachedMsg: (found, when) => `${found}개 발견 · ${when} 스캔`,
      autoUpdating: "백그라운드에서 자동 업데이트 중…",
      denied: "스캔할 수 없습니다: 로컬 네트워크 접근 권한이 허용되지 않았습니다.",
      badSubnet: "서브넷은 192.168.1과 같이 세 개의 숫자로 입력하세요.",
      none: "응답한 Axis 기기가 없습니다. 서브넷을 확인하고 카메라에서 HTTP가 활성화되어 있는지 확인하세요.",
      hint: "서브넷의 모든 주소에 공개 기기 정보(VAPIX basicdeviceinfo - AXIS OS 10+에서는 비밀번호 불필요)를 요청합니다. 같은 서브넷에서 HTTP가 활성화된 카메라만 응답합니다. 데이터는 컴퓨터 밖으로 나가지 않습니다.",
      factoryDefault: "공장 기본값 .90", copied: "복사됨", unknownChipset: "칩셋 정보 없음",
      pageHeading: "이 네트워크에서 Axis 카메라 찾기",
      justNow: "방금 전", minAgo: (n) => `${n}분 전`, hAgo: (n) => `${n}시간 전`, daysAgo: (n) => `${n}일 전`,
    },
    zh: {
      scan: "扫描", rescan: "重新扫描", stop: "停止", csv: "CSV",
      idle: "输入您Mac/PC所在的子网,然后点击扫描。",
      scanning: (done, total, found) => `扫描中… ${done}/${total}(已发现 ${found} 台)`,
      doneMsg: (found, secs) => `${secs} 秒内发现 ${found} 台Axis设备`,
      cachedMsg: (found, when) => `发现 ${found} 台 · ${when}扫描`,
      autoUpdating: "正在后台自动更新…",
      denied: "无法扫描:未获得本地网络访问权限。",
      badSubnet: "子网必须是三个数字,例如 192.168.1",
      none: "没有Axis设备响应。请检查子网,并确认摄像机已启用HTTP。",
      hint: "向子网中的每个地址查询其公开设备信息(VAPIX basicdeviceinfo - AXIS OS 10+无需密码)。仅同一子网内已启用HTTP的摄像机会响应。数据不会离开您的电脑。",
      factoryDefault: "出厂默认 .90", copied: "已复制", unknownChipset: "芯片组未知",
      pageHeading: "在此网络中查找Axis摄像机",
      justNow: "刚刚", minAgo: (n) => `${n} 分钟前`, hAgo: (n) => `${n} 小时前`, daysAgo: (n) => `${n} 天前`,
    },
    sv: {
      scan: "Skanna", rescan: "Skanna igen", stop: "Stoppa", csv: "CSV",
      idle: "Ange subnätet din Mac/PC är på och tryck på Skanna.",
      scanning: (done, total, found) => `Skannar… ${done}/${total} (${found} hittade)`,
      doneMsg: (found, secs) => `${found} Axis-enhet(er) hittades på ${secs} s`,
      cachedMsg: (found, when) => `${found} hittade · skannat ${when}`,
      autoUpdating: "Uppdaterar automatiskt i bakgrunden…",
      denied: "Kan inte skanna: åtkomst till det lokala nätverket beviljades inte.",
      badSubnet: "Subnätet måste vara tre siffror, t.ex. 192.168.1",
      none: "Ingen Axis-enhet svarade. Kontrollera subnätet och att HTTP är aktiverat på kamerorna.",
      hint: "Frågar varje adress i subnätet efter dess publika enhetsinformation (VAPIX basicdeviceinfo - inget lösenord behövs på AXIS OS 10+). Endast kameror på samma subnät med HTTP aktiverat svarar. Inget lämnar din dator.",
      factoryDefault: "fabriksinställning .90", copied: "Kopierat", unknownChipset: "chipset okänt",
      pageHeading: "Hitta Axis-kameror på det här nätverket",
      justNow: "just nu", minAgo: (n) => `${n} min sedan`, hAgo: (n) => `${n} tim sedan`, daysAgo: (n) => `${n} dagar sedan`,
    },
    uk: {
      scan: "Сканувати", rescan: "Сканувати знову", stop: "Зупинити", csv: "CSV",
      idle: "Введіть підмережу, у якій перебуває ваш Mac/ПК, і натисніть «Сканувати».",
      scanning: (done, total, found) => `Сканування… ${done}/${total} (знайдено ${found})`,
      doneMsg: (found, secs) => `Знайдено ${found} пристрій(їв) Axis за ${secs} с`,
      cachedMsg: (found, when) => `Знайдено ${found} · скановано ${when}`,
      autoUpdating: "Автоматичне оновлення у фоновому режимі…",
      denied: "Неможливо сканувати: доступ до локальної мережі не надано.",
      badSubnet: "Підмережа має складатися з трьох чисел, напр. 192.168.1",
      none: "Жоден пристрій Axis не відповів. Перевірте підмережу та чи увімкнено HTTP на камерах.",
      hint: "Запитує в кожної адреси підмережі публічну інформацію про пристрій (VAPIX basicdeviceinfo - пароль не потрібен на AXIS OS 10+). Відповідають лише камери в тій самій підмережі з увімкненим HTTP. Нічого не залишає ваш комп'ютер.",
      factoryDefault: "заводське значення .90", copied: "Скопійовано", unknownChipset: "чипсет невідомий",
      pageHeading: "Знайти камери Axis у цій мережі",
      justNow: "щойно", minAgo: (n) => `${n} хв тому`, hAgo: (n) => `${n} год тому`, daysAgo: (n) => `${n} дн тому`,
    },
    ar: {
      scan: "مسح", rescan: "إعادة المسح", stop: "إيقاف", csv: "CSV",
      idle: "أدخل الشبكة الفرعية التي يتصل بها جهاز Mac/PC واضغط مسح.",
      scanning: (done, total, found) => `جارٍ المسح… ${done}/${total} (تم العثور على ${found})`,
      doneMsg: (found, secs) => `تم العثور على ${found} جهاز Axis خلال ${secs} ثانية`,
      cachedMsg: (found, when) => `تم العثور على ${found} · تم المسح ${when}`,
      autoUpdating: "جارٍ التحديث تلقائيًا في الخلفية…",
      denied: "تعذّر المسح: لم يُمنح الوصول إلى الشبكة المحلية.",
      badSubnet: "يجب أن تتكوّن الشبكة الفرعية من ثلاثة أرقام، مثل 192.168.1",
      none: "لم يستجب أي جهاز Axis. تحقق من الشبكة الفرعية ومن تفعيل HTTP على الكاميرات.",
      hint: "يستعلم عن معلومات الجهاز العامة لكل عنوان في الشبكة الفرعية (VAPIX basicdeviceinfo - لا حاجة لكلمة مرور في AXIS OS 10+). تستجيب فقط الكاميرات الموجودة في نفس الشبكة الفرعية مع تفعيل HTTP. لا تغادر أي بيانات جهازك.",
      factoryDefault: "الإعداد الافتراضي .90", copied: "تم النسخ", unknownChipset: "الشريحة غير معروفة",
      pageHeading: "البحث عن كاميرات Axis في هذه الشبكة",
      justNow: "الآن", minAgo: (n) => `قبل ${n} دقيقة`, hAgo: (n) => `قبل ${n} ساعة`, daysAgo: (n) => `قبل ${n} يوم`,
    },
    nl: {
      scan: "Scannen", rescan: "Opnieuw scannen", stop: "Stoppen", csv: "CSV",
      idle: "Voer het subnet in waarop je Mac/pc zich bevindt en klik op Scannen.",
      scanning: (done, total, found) => `Scannen… ${done}/${total} (${found} gevonden)`,
      doneMsg: (found, secs) => `${found} Axis-apparaat/apparaten gevonden in ${secs} s`,
      cachedMsg: (found, when) => `${found} gevonden · gescand ${when}`,
      autoUpdating: "Wordt automatisch bijgewerkt op de achtergrond…",
      denied: "Kan niet scannen: toegang tot het lokale netwerk is niet verleend.",
      badSubnet: "Het subnet moet uit drie getallen bestaan, bijv. 192.168.1",
      none: "Geen Axis-apparaten hebben gereageerd. Controleer het subnet en of HTTP op de camera's is ingeschakeld.",
      hint: "Vraagt elk adres in het subnet om openbare apparaatinformatie (VAPIX basicdeviceinfo - geen wachtwoord nodig bij AXIS OS 10+). Alleen camera's op hetzelfde subnet met HTTP ingeschakeld reageren. Er verlaat niets je computer.",
      factoryDefault: "fabrieksinstelling .90", copied: "Gekopieerd", unknownChipset: "chipset onbekend",
      pageHeading: "Axis-camera's zoeken op dit netwerk",
      justNow: "zojuist", minAgo: (n) => `${n} min geleden`, hAgo: (n) => `${n} u geleden`, daysAgo: (n) => `${n} dagen geleden`,
    },
  };
  const langCode = () => (typeof AxisI18N !== "undefined" && AxisI18N.langCode) || "en";
  const t = (key, en, ...args) => {
    const dict = STRINGS[langCode()];
    const v = dict && dict[key];
    return v === undefined ? en : typeof v === "function" ? v(...args) : v;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ipNum = (ip) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);
  const relTime = (ts) => {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return t("justNow", "just now");
    if (mins < 60) return t("minAgo", `${mins} min ago`, mins);
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return t("hAgo", `${hrs} h ago`, hrs);
    return t("daysAgo", `${Math.round(hrs / 24)} d ago`, Math.round(hrs / 24));
  };

  // Fallback chipset lookup for pages without popup.js's chipsetFor(): bundled
  // CHIPSET_DATA, overridden by the weekly-refreshed chipsetData in storage.
  function defaultChipsetFor() {
    let map = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};
    chrome.storage?.local.get(["chipsetData"], (r) => { if (r.chipsetData) map = r.chipsetData; });
    const norm = (s) => (s || "").toUpperCase().replace(/^AXIS\s+/, "").trim();
    return (name) => {
      const n = norm(name);
      return map[n] || map[n.replace(/-S([A-Z]+)\b/, "-$1")] || null;
    };
  }

  async function probe(ip, signal) {
    const ctl = new AbortController();
    const onAbort = () => ctl.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctl.abort(), 1500);
    try {
      const res = await fetch(`http://${ip}/axis-cgi/basicdeviceinfo.cgi`, {
        method: "POST", signal: ctl.signal, cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiVersion: "1.0", method: "getAllUnrestrictedProperties" }),
      });
      if (!res.ok) return null;
      const p = (await res.json())?.data?.propertyList;
      return p?.SerialNumber ? p : null;
    } catch { return null; } finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
  }

  function mount(root, opts = {}) {
    const chipsetFor = opts.chipsetFor || defaultChipsetFor();
    root.classList.add("fc");
    root.innerHTML = `
      <div class="fc-controls">
        <input type="text" class="fc-subnet" placeholder="192.168.1" spellcheck="false" autocomplete="off" title=".1 – .254">
        <button type="button" class="fc-btn primary fc-scan"></button>
        <button type="button" class="fc-btn fc-csv" disabled></button>
        <div class="fc-chips">
          <button type="button" class="fc-btn fc-chip" data-subnet="192.168.0">192.168.0</button>
          <button type="button" class="fc-btn fc-chip" data-subnet="192.168.1">192.168.1</button>
          <button type="button" class="fc-btn fc-chip" data-subnet="10.0.0">10.0.0</button>
          <button type="button" class="fc-btn fc-chip fc-default" data-subnet="192.168.0" data-only="90" title="Axis factory default address 192.168.0.90"></button>
        </div>
      </div>
      <progress class="fc-progress" value="0" max="254" hidden></progress>
      <div class="fc-status"></div>
      <div class="fc-list"></div>
      <p class="fc-hint"></p>`;
    const q = (sel) => root.querySelector(sel);
    const subnetEl = q(".fc-subnet"), scanBtn = q(".fc-scan"), csvBtn = q(".fc-csv"), statusEl = q(".fc-status"), listEl = q(".fc-list"), progressEl = q(".fc-progress");

    let scanning = false, autoUpdating = false, abort = null, results = [], finishedAt = null, scannedSubnet = null;

    function applyStrings() {
      scanBtn.textContent = scanning ? t("stop", "Stop") : finishedAt ? t("rescan", "Re-Scan") : t("scan", "Scan");
      csvBtn.textContent = t("csv", "CSV");
      q(".fc-default").textContent = t("factoryDefault", "factory default .90");
      q(".fc-hint").textContent = t("hint", "Asks every address on the subnet for its public device info (VAPIX basicdeviceinfo - no password needed on AXIS OS 10+). Only cameras on the same subnet with HTTP enabled answer. Nothing leaves your computer.");
      if (!scanning && !finishedAt) statusEl.textContent = t("idle", "Enter the subnet your Mac/PC is on and press Scan.");
      else if (!scanning && finishedAt) statusEl.textContent = t("cachedMsg", `${results.length} found · scanned ${relTime(finishedAt)}`, results.length, relTime(finishedAt));
    }
    if (typeof AxisI18N !== "undefined") AxisI18N.onLanguageChange(() => { applyStrings(); render(); });

    // ---- persistence: restore the last scan instantly, then (only if this
    // subnet's permission is already granted - no gesture available here)
    // quietly refresh it in the background. ----
    chrome.storage?.local.get(["findCamsCache"], (r) => {
      const cache = r.findCamsCache;
      subnetEl.value = cache?.subnet || "192.168.1";
      if (cache?.devices?.length) {
        results = cache.devices; finishedAt = cache.scannedAt; scannedSubnet = cache.subnet;
        render(); applyStrings();
      }
      trySilentAutoscan();
    });

    function trySilentAutoscan() {
      const prefix = subnetEl.value.trim().replace(/\.$/, "");
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(prefix)) return;
      const origins = Array.from({ length: 254 }, (_, i) => `http://${prefix}.${i + 1}/*`);
      chrome.permissions?.contains({ origins }, (granted) => {
        if (granted && !scanning) runScan(prefix, Array.from({ length: 254 }, (_, i) => i + 1), { silent: true });
      });
    }

    root.querySelectorAll(".fc-chip").forEach((b) => b.addEventListener("click", () => {
      subnetEl.value = b.dataset.subnet;
      startScan(b.dataset.only ? [Number(b.dataset.only)] : undefined);
    }));

    async function startScan(hostsOverride) {
      if (scanning) { abort?.abort(); return; }
      const prefix = subnetEl.value.trim().replace(/\.$/, "");
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(prefix) || prefix.split(".").some((o) => Number(o) > 255)) {
        statusEl.textContent = t("badSubnet", "Subnet must be three numbers, e.g. 192.168.1"); return;
      }
      const hosts = hostsOverride || Array.from({ length: 254 }, (_, i) => i + 1);
      const origins = hosts.map((h) => `http://${prefix}.${h}/*`);
      const ok = await new Promise((res) => chrome.permissions.request({ origins }, (g) => res(!!g)));
      if (!ok) { statusEl.textContent = t("denied", "Cannot scan: access to the local network was not granted."); return; }
      runScan(prefix, hosts, { silent: false });
    }

    async function runScan(prefix, hosts, { silent }) {
      if (scanning) return;
      scanning = true; autoUpdating = silent; abort = new AbortController();
      if (!silent) { results = []; finishedAt = null; }
      chrome.storage?.local.set({ findCamsSubnet: prefix });
      applyStrings(); csvBtn.disabled = true;
      progressEl.hidden = false; progressEl.max = hosts.length; progressEl.value = 0;
      // Shown immediately rather than waiting for the first 8 probes (see the
      // loop below) - matters most right after the popup reopens itself
      // post-permission-grant (see background.js), when this is the first
      // thing the user sees and needs to read as "yes, it's scanning."
      statusEl.textContent = t("scanning", `Scanning… 0/${hosts.length} (${results.length} found)`, 0, hosts.length, results.length);
      if (!silent) render();
      const t0 = Date.now(); let done = 0;
      const found = silent ? [...results] : [];
      const queue = [...hosts];
      const worker = async () => {
        while (queue.length && !abort.signal.aborted) {
          const ip = `${prefix}.${queue.shift()}`;
          const info = await probe(ip, abort.signal);
          if (info) {
            const idx = found.findIndex((d) => d.ip === ip);
            const rec = { ip, ...info };
            if (idx >= 0) found[idx] = rec; else found.push(rec);
            found.sort((a, b) => ipNum(a.ip) - ipNum(b.ip));
            results = found; render();
          }
          done++; progressEl.value = done;
          if (!silent || done % 8 === 0) statusEl.textContent = t("scanning", `Scanning… ${done}/${hosts.length} (${results.length} found)`, done, hosts.length, results.length);
        }
      };
      await Promise.all(Array.from({ length: 32 }, worker));
      scanning = false; autoUpdating = false; finishedAt = Date.now(); scannedSubnet = prefix;
      chrome.storage?.local.set({ findCamsCache: { subnet: prefix, devices: results, scannedAt: finishedAt } });
      const secs = ((finishedAt - t0) / 1000).toFixed(1);
      statusEl.textContent = t("doneMsg", `${results.length} Axis device(s) found in ${secs} s`, results.length, secs);
      applyStrings(); csvBtn.disabled = !results.length; progressEl.hidden = true;
      render();
    }

    const chipsetOf = (d) => chipsetFor(d.ProdShortName || "AXIS " + (d.ProdNbr || "")) || chipsetFor("AXIS " + (d.ProdNbr || "")) || null;

    function render() {
      if (!results.length) {
        listEl.innerHTML = finishedAt ? `<div class="fc-empty">${esc(t("none", "No Axis devices answered. Check the subnet, and that HTTP is enabled on the cameras."))}</div>` : "";
        return;
      }
      listEl.innerHTML = results.map((d) => {
        const chip = chipsetOf(d);
        const model = d.ProdNbr || d.ProdShortName || "";
        return `<div class="fc-card">
          <div class="fc-model fc-copy" data-copy="${esc(model)}" title="Click to copy">${esc(model)}${d.ProdType ? `<span class="fc-full">${esc(d.ProdType)}</span>` : ""}</div>
          <a class="fc-ip" href="http://${esc(d.ip)}/" target="_blank" rel="noopener">${esc(d.ip)}</a>
          <span class="fc-chipset${chip ? "" : " unknown"}">${esc(chip || t("unknownChipset", "chipset n/a"))}</span>
          <div class="fc-meta">
            <span class="fc-copy" data-copy="${esc(d.SerialNumber)}" title="Click to copy">SN ${esc(d.SerialNumber)}</span>
            <span class="fc-copy" data-copy="${esc(d.Version || "")}" title="Click to copy">FW ${esc(d.Version || "?")}</span>
          </div>
        </div>`;
      }).join("");
    }
    listEl.addEventListener("click", (e) => {
      const el = e.target.closest(".fc-copy");
      if (el?.dataset.copy) { navigator.clipboard?.writeText(el.dataset.copy); el.title = t("copied", "Copied"); }
    });

    csvBtn.addEventListener("click", () => {
      const cols = ["ip", "ProdNbr", "ProdFullName", "ProdType", "SerialNumber", "Version", "chipset"];
      const qq = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
      const lines = [cols.join(","), ...results.map((d) => cols.map((c) => qq(c === "chipset" ? chipsetOf(d) || "" : d[c] ?? "")).join(","))];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = `axis-cameras-${(scannedSubnet || subnetEl.value).trim()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    });

    scanBtn.addEventListener("click", () => startScan());
    subnetEl.addEventListener("keydown", (e) => { if (e.key === "Enter") startScan(); });
    applyStrings();
    return { render };
  }

  global.AxisFindCams = { mount, t };
})(typeof globalThis !== "undefined" ? globalThis : window);
