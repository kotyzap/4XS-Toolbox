// Auto-generated. Do not edit by hand.
//
// Primary source is Axis's own Product selector feed
// (https://www.axis.com/app/tim/ps/products.json), field
// properties.analyticsComputeCapability. It is a structured per-model value
// straight from Axis, it covers every ACTIVE product, and it is what the
// Product selector itself renders as "Compute capabilities".
//
// It replaced the Q4 2026 comparison table as the primary source because
// that table prints "-" in the Compute capabilities row for MLPU devices as
// well as for devices with no compute unit at all: AXIS Q6225-LE is "-"
// there and MLPU in both its datasheet and this feed.
//
// Two cautions carried over from that lesson:
//   1. A MISSING field in the feed is not proof of "no compute unit". Two
//      models are known to be absent from it and still carry a DLPU, each
//      confirmed by its own datasheet AND by both the Q3 and Q4 2026
//      comparison tables:
//        AXIS P3945-R       - "Deep learning processing unit (DLPU)", CV75
//        AXIS Q8752-E Mk II - "Deep learning processing unit (DLPU)", ARTPEC-7
//      Do not confuse the Q8752-E Mk II with the older Q8752-E, whose
//      datasheet genuinely has no compute line - they are different products.
//      Where the feed and a comparison table disagree, the model's own
//      datasheet decides.
//   2. Chipset generation is never a shortcut. ARTPEC-7 spans all three
//      verdicts: Q6225-LE/P5655-E/P5676-LE (MLPU), Q1715/M4308-PLE (DLPU),
//      M5000/M5074/M5075 (none).
//
// d = DLPU, m = MLPU, n = no compute unit.
// Products whose family carries no "Compute capabilities" row in ANY edition
// of the comparison tables (Q3 and Q4 2026 both checked) are left out of this
// file entirely rather than recorded as "n". For those the feed's missing
// field is the only evidence, and the feed is known to miss a DLPU twice over
// - so "no badge" is the honest answer, not "NO DLPU". Left out on that basis:
//   D2110-VE (its overview claims deep-learning analytics, but no spec)
const COMPUTE_DATA = {"source":"Axis Product selector feed (properties.analyticsComputeCapability), snapshot 2026-11-07; datasheets for the models it misses","generated":"2026-11-07","counts":{"n":22,"d":148,"m":8},"models":{"A8207-VE Mk II":"n","D2122-VE":"d","D2123-VE":"d","D2124-VE":"d","F9104-B Mk II":"d","F9111-R Mk II":"d","F9114-B Mk II":"d","F9114-R Mk II":"d","FA51":"n","FA51-B":"n","FA54":"n","I7010-VE":"n","I7020":"n","I8016-LVE":"n","I8116-E":"d","I8307-VE":"d","M1055-L":"d","M1075-L Mk II":"d","M1135 Mk II":"m","M1135-E Mk II":"m","M1137 Mk II":"m","M1137-E Mk II":"m","M2035-LE":"d","M2036-LE":"d","M2048-LE":"d","M3057-PLR Mk II":"n","M3077-PLVE":"n","M3085-V":"d","M3086-V":"d","M3088-V":"d","M3098-H":"d","M3098-LV":"d","M3098-V":"d","M3125-LVE":"d","M3126-LVE":"d","M3128-LVE":"d","M3138-LVE":"d","M3215-LVE":"d","M3216-LVE":"d","M3905-R":"n","M3945-R":"d","M4215-LV":"d","M4215-V":"d","M4216-LV":"d","M4216-V":"d","M4218-LV":"d","M4218-V":"d","M4225-LVE":"d","M4227-LVE":"d","M4228-LVE":"d","M4308-PLE":"d","M4317-PLR":"d","M4317-PLVE":"d","M4318-PLR":"d","M4318-PLVE":"d","M4327-P":"d","M4328-P":"d","M4337-PLVE":"d","M4337-SPLVE":"d","M4338-PLVE":"d","M4347-PLVE":"d","M4348-PLVE":"d","M5000":"n","M5000-G":"n","M5074":"n","M5075":"n","M5075-G":"n","M5526-E":"d","P1245 Mk II":"d","P1265 Mk II":"d","P1275 Mk II":"d","P1385":"d","P1385-B":"d","P1385-BE":"d","P1385-E":"d","P1387":"d","P1387-B":"d","P1387-BE":"d","P1387-LE":"d","P1388":"d","P1388-B":"d","P1388-BE":"d","P1388-LE":"d","P1468-XLE":"d","P1475-LE":"d","P1485-LE":"d","P1486-LE":"d","P1487-LE":"d","P1488-LE":"d","P1518-E":"d","P1518-LE":"d","P3268-SLVE":"d","P3275-LV":"d","P3275-LVE":"d","P3275-V":"d","P3277-LV":"d","P3277-LVE":"d","P3278-LV":"d","P3278-LVE":"d","P3285-LV":"d","P3285-LVE":"d","P3287-LV":"d","P3287-LVE":"d","P3288-LV":"d","P3288-LVE":"d","P3407-VE":"d","P3408-VE":"d","P3735-PLE":"d","P3737-PLE":"d","P3738-PLE":"d","P3747-PLVE":"d","P3748-PLVE":"d","P3818-PVE":"n","P3827-PVE":"d","P3905-R Mk III":"n","P3925-LRE":"n","P3925-R":"n","P3935-LR":"n","P3945-R":"d","P3947-R":"d","P4705-PLVE":"d","P4707-PLVE":"d","P4708-PLVE":"d","P5654-E Mk II":"m","P5655-E":"m","P5676-LE":"m","P9117-PV":"d","Q1656":"d","Q1656-B":"d","Q1656-BE":"d","Q1656-BLE":"d","Q1656-DLE":"d","Q1656-LE":"d","Q1686-DLE":"d","Q1715":"d","Q1726":"d","Q1726-LE":"d","Q1728":"d","Q1728-LE":"d","Q1800-LE":"d","Q1800-LE-3":"d","Q1805-LE":"d","Q1806-LE":"d","Q1808-LE":"d","Q1809-LE":"d","Q1961-TE":"d","Q1961-XTE":"d","Q1971-E":"d","Q1972-E":"d","Q2101-TE":"d","Q2111-E":"d","Q2112-E":"d","Q2802-E":"d","Q3538-SLVE":"d","Q3546-LVE":"d","Q3548-LVE":"d","Q3556-LVE":"d","Q3558-LVE":"d","Q3626-VE":"d","Q3628-VE":"d","Q3839-PVE":"d","Q3839-SPVE":"d","Q4809-PVE":"d","Q6020-E":"d","Q6086-E":"d","Q6088-E":"d","Q6225-LE":"m","Q6300-E":"d","Q6325-LE":"d","Q6355-LE":"d","Q6358-LE":"d","Q6411-LE":"d","Q8752-E Mk II":"d","Q9227-SLV":"d","Q9307-LV":"d","V5925":"n","V5938":"n","XFQ1656":"d"}};
