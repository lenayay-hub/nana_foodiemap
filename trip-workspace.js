/* ==========================================================================
   檔案名稱：trip-workspace.js (React 18 行程工作台完整正式版)
   更新重點：
   1. 頂部極簡純圖示導覽列：左邊「<」返回，右邊「紙飛機 (匯出PDF/長圖)」與「鉛筆 (修改標題/日期/旅伴)」，不加多餘文字。
   2. 保留深綠色大色塊，移除內部多餘的修改小鉛筆文字。
   3. 底線式三大分頁：「行程」｜「旅行帳單」｜「行李清單」（純文字，不顯示旁邊的金額與數字）。
   4. 旅行帳單：自動整合「行程內景點花費+車資」與「手動新增額外開銷」，支援方案A (平均分攤) + 方案B (誰先墊錢、誰該給誰錢)。
   5. 行李清單：分為「📋 行前準備待辦」與「🧳 行李必備打包」2 大區塊，支援打勾、新增、刪除與一鍵帶入範本。
   6. iPhone 16 Pro 嚴格三欄網格對齊、備註自動換行延展不破版、真實全球座標搜尋與自動補座標。
   ========================================================================== */

const { useState, useEffect, useMemo, useRef } = React;

const CATEGORY_META = {
  spot:    { label: '景點', icon: '📸', badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  food:    { label: '餐廳', icon: '🍽️', badgeCls: 'bg-orange-50 text-orange-700 border-orange-200' },
  hotel:   { label: '住宿', icon: '🏨', badgeCls: 'bg-purple-50 text-purple-700 border-purple-200' },
  airport: { label: '機場', icon: '✈️', badgeCls: 'bg-sky-50 text-sky-700 border-sky-200' }
};

const TRANSIT_META = {
  taxi:    { label: '計程車 / Grab', icon: '🚕' },
  walk:    { label: '走路散步',      icon: '🚶' },
  public:  { label: '大眾運輸',      icon: '🚌' },
  scooter: { label: '機車 / 租車',   icon: '🛵' },
  flight:  { label: '航廈動線',      icon: '🛫' }
};

// 預設行前待辦與行李範本（當舊行程尚未建立清單時可一鍵帶入或初始化）
const DEFAULT_TODO_LIST = [
  { id: 'td_1', text: '確認護照效期滿 6 個月以上 & 辦理簽證', done: false },
  { id: 'td_2', text: '購買網卡 eSIM / 開通原號漫遊', done: false },
  { id: 'td_3', text: '兌換外幣現鈔 & 準備海外高回饋信用卡', done: false },
  { id: 'td_4', text: '預訂機場接送 / 下載當地叫車 App (如 Grab)', done: false }
];

const DEFAULT_PACKING_LIST = [
  { id: 'pk_1', text: '護照正本、身分證、機票與飯店憑證截圖', done: false },
  { id: 'pk_2', text: '行動電源（須隨身攜帶不可託運）＆ 充電線、萬國轉接頭', done: false },
  { id: 'pk_3', text: '個人常備藥（腸胃藥、止痛藥、OK繃、防蚊液）', done: false },
  { id: 'pk_4', text: '換洗衣物、晴雨兩用摺疊傘、薄外套', done: false }
];

// 常見機場與熱門旅遊地標精準座標庫
const QUICK_GEO_DICT = [
  { kw: '小港', lat: 22.5771, lng: 120.3498, cat: 'airport', addr: '高雄市小港區中山四路2號' },
  { kw: '桃園國際機場', lat: 25.0797, lng: 121.2342, cat: 'airport', addr: '桃園市大園區航站南路9號' },
  { kw: '內排', lat: 21.2187, lng: 105.8042, cat: 'airport', addr: 'Phú Minh, Sóc Sơn, Hà Nội, Vietnam' },
  { kw: '成田', lat: 35.7720, lng: 140.3929, cat: 'airport', addr: 'Narita, Chiba, Japan' },
  { kw: '羽田', lat: 35.5494, lng: 139.7798, cat: 'airport', addr: 'Ota City, Tokyo, Japan' },
  { kw: '關西國際機場', lat: 34.4320, lng: 135.2304, cat: 'airport', addr: 'Izumisano, Osaka, Japan' },
  { kw: '還劍湖', lat: 21.0287, lng: 105.8523, cat: 'spot', addr: 'Hoàn Kiếm, Hà Nội, Vietnam' },
  { kw: '河內老城區', lat: 21.0341, lng: 105.8506, cat: 'spot', addr: 'Old Quarter, Hoàn Kiếm, Hà Nội, Vietnam' },
  { kw: '三十六古街', lat: 21.0341, lng: 105.8506, cat: 'spot', addr: 'Old Quarter, Hoàn Kiếm, Hà Nội, Vietnam' },
  { kw: '河內大教堂', lat: 21.0288, lng: 105.8489, cat: 'spot', addr: '40 Nhà Chung, Hoàn Kiếm, Hà Nội' },
  { kw: '聖約瑟夫天主堂', lat: 21.0288, lng: 105.8489, cat: 'spot', addr: '40 Nhà Chung, Hoàn Kiếm, Hà Nội' },
  { kw: 'Acoustic Hotel', lat: 21.0298, lng: 105.8461, cat: 'hotel', addr: '39 Thợ Nhuộm, Cửa Nam, Hoàn Kiếm, Hà Nội' },
  { kw: 'Phở 10', lat: 21.0305, lng: 105.8492, cat: 'food', addr: '10 Lý Quốc Sư, Hàng Trống, Hoàn Kiếm, Hà Nội' },
  { kw: 'Pho 10', lat: 21.0305, lng: 105.8492, cat: 'food', addr: '10 Lý Quốc Sư, Hàng Trống, Hoàn Kiếm, Hà Nội' },
  { kw: '樂天', lat: 21.0322, lng: 105.8126, cat: 'hotel', addr: '54 Liễu Giai, Ba Đình, Hà Nội' },
  { kw: '4P', lat: 21.0245, lng: 105.8562, cat: 'food', addr: '43 Tràng Tiền, Hoàn Kiếm, Hà Nội' }
];

// 🌐 真實全球地理座標查詢器
async function geocodePlaceByName(queryStr) {
  const q = (queryStr || '').trim();
  if (!q) return null;

  const dictHit = QUICK_GEO_DICT.find(g => q.toLowerCase().includes(g.kw.toLowerCase()));
  if (dictHit) {
    return {
      lat: dictHit.lat,
      lng: dictHit.lng,
      address: dictHit.addr,
      displayName: q
    };
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh,en' } });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: data[0].display_name || '',
        displayName: (data[0].name || q),
        rawList: data.map(item => ({
          name: item.name || item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          source: '🌐 全球地圖座標'
        }))
      };
    }
  } catch (e) {}

  try {
    const res2 = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);
    const data2 = await res2.json();
    if (data2?.features?.length > 0) {
      const f = data2.features[0];
      const [lng, lat] = f.geometry.coordinates;
      const addrParts = [f.properties.street, f.properties.city, f.properties.country].filter(Boolean).join(', ');
      return {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: addrParts || f.properties.name || '',
        displayName: f.properties.name || q,
        rawList: data2.features.map(ft => ({
          name: ft.properties.name || q,
          address: [ft.properties.street, ft.properties.city, ft.properties.country].filter(Boolean).join(', '),
          lat: parseFloat(ft.geometry.coordinates[1]),
          lng: parseFloat(ft.geometry.coordinates[0]),
          source: '🌐 全球地圖座標'
        }))
      };
    }
  } catch (e) {}

  return null;
}

function formatDayDateLabel(startDateStr, dayNum) {
  if (!startDateStr) return `Day ${dayNum}`;
  const d = new Date(startDateStr);
  if (isNaN(d.getTime())) return `Day ${dayNum}`;
  d.setDate(d.getDate() + (dayNum - 1));
  const m = d.getMonth() + 1;
  const date = d.getDate();
  const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${m}/${date} (${wk})`;
}

window.TripWorkspace = function TripWorkspace({
  trip,
  allSavedPlaces = [],
  onUpdateTrip,
  onBack,
  onJumpToSaved,
  showToast
}) {
  const [currentDay, setCurrentDay] = useState(Number(trip?.day) || 1);
  // 🔥 底線式三大分頁：'itinerary' (行程) | 'bill' (旅行帳單) | 'checklist' (行李清單)
  const [subTab, setSubTab] = useState('itinerary');

  // 彈出視窗控制狀態
  const [showAddHubModal, setShowAddHubModal] = useState(false);
  const [addHubTab, setAddHubTab] = useState('google'); // 'google' | 'saved' | 'flight'

  const membersList = useMemo(() => {
    return Array.isArray(trip?.members) && trip.members.length > 0 ? trip.members : ['娜娜'];
  }, [trip?.members]);

  // 1) Google 搜尋新增表單狀態
  const [gTime, setGTime] = useState('12:00');
  const [gCat, setGCat] = useState('spot');
  const [gName, setGName] = useState('');
  const [gAddr, setGAddr] = useState('');
  const [gCost, setGCost] = useState('');
  const [gPayer, setGPayer] = useState(membersList[0]);
  const [gNote, setGNote] = useState('');
  const [gPickedCoords, setGPickedCoords] = useState(null);
  const [onlineSuggestions, setOnlineSuggestions] = useState([]);
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);

  // 2) 從收藏庫挑選表單狀態
  const [favTime, setFavTime] = useState('14:00');
  const [favSearch, setFavSearch] = useState('');
  const [favCatFilter, setFavCatFilter] = useState('all');

  // 3) 插入航班表單狀態
  const [flDepTime, setFlDepTime] = useState('14:00');
  const [flArrTime, setFlArrTime] = useState('16:00');
  const [flFrom, setFlFrom] = useState('小港機場 (KHH)');
  const [flTo, setFlTo] = useState('內排機場 (HAN)');
  const [flCode, setFlCode] = useState('VN587 / CI9023');
  const [flCost, setFlCost] = useState('');
  const [flPayer, setFlPayer] = useState(membersList[0]);
  const [flNote, setFlNote] = useState('');

  // 小鉛筆編輯單一項目視窗狀態
  const [editingEvent, setEditingEvent] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 編輯景點間交通方式視窗狀態
  const [editingTransitEv, setEditingTransitEv] = useState(null);

  // 右上角鉛筆：自訂旅程標題、出發日期、天數、當日副標題與旅伴名單
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [editMainTitle, setEditMainTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editTotalDays, setEditTotalDays] = useState(3);
  const [editDaySubtitle, setEditDaySubtitle] = useState('');
  const [editMembersText, setEditMembersText] = useState('');

  // 💰 旅行帳單：新增額外開銷視窗與表單
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({
    title: '',
    category: '餐飲/點心',
    amount: '',
    currency: 'TWD',
    payer: membersList[0],
    splitAmong: [...membersList]
  });

  // 🧳 行李清單：新增輸入框
  const [newTodoText, setNewTodoText] = useState('');
  const [newPackText, setNewPackText] = useState('');

  // ✨ 右上角紙飛機：匯出漂亮行程表視窗狀態
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('all'); // 'all' | 'day'
  const [exportShowCost, setExportShowCost] = useState(true);
  const [exportShowNote, setExportShowNote] = useState(true);
  const [isExportingImg, setIsExportingImg] = useState(false);

  // Leaflet 地圖與匯出畫布 Ref
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const exportCardRef = useRef(null);

  const totalDays = Math.max(Number(trip?.days) || 1, 1);
  const dayNumbers = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);

  // 建立 placeId -> place 物件索引
  const placeMap = useMemo(() => {
    const map = {};
    (trip?.places || []).forEach(p => { map[p.id] = p; });
    return map;
  }, [trip?.places]);

  // 取得指定天數的排序後行程項目
  const getEventsForDay = (dayNum) => {
    const list = (trip?.events || []).filter(ev => Number(ev.day || 1) === Number(dayNum));
    return [...list].sort((a, b) => {
      const tA = a.kind === 'flight' ? (a.depTime || '00:00') : (a.time || '00:00');
      const tB = b.kind === 'flight' ? (b.depTime || '00:00') : (b.time || '00:00');
      return tA.localeCompare(tB);
    });
  };

  const currentDayEvents = useMemo(() => getEventsForDay(currentDay), [trip?.events, currentDay]);

  // 計算單日總花費 (景點花費 + 交通車資)
  const calcDayTotalCost = (dayNum) => {
    const evs = getEventsForDay(dayNum);
    return evs.reduce((sum, ev) => {
      const p = placeMap[ev.placeId];
      const itemCost = Number(ev.cost ?? p?.cost ?? 0) || 0;
      const trCost = Number(ev.transitToNext?.cost || 0) || 0;
      return sum + itemCost + trCost;
    }, 0);
  };

  const currentDaySubtitle = (trip?.dayTitles && trip.dayTitles[currentDay]) || `Day ${currentDay} 精彩行程`;

  // 💰 整合計算「旅行帳單」（自動合併：時間軸景點/航班花費 + 交通車資 + 手動新增額外開銷，並執行 A+B 分攤與結算）
  const billSummary = useMemo(() => {
    const members = membersList;
    const allRecords = [];

    // 1. 收集行程時間軸上的景點/航班花費與交通車資
    (trip?.events || []).forEach(ev => {
      const p = placeMap[ev.placeId] || {};
      const itemCost = Number(ev.cost ?? p.cost ?? 0) || 0;
      const itemName = ev.kind === 'flight'
        ? `✈️ ${ev.fromAirport || '出發'} ➔ ${ev.toAirport || '抵達'}`
        : (ev.name || p.name || '行程項目');

      if (itemCost > 0) {
        allRecords.push({
          id: `tl_${ev.id}`,
          source: 'itinerary',
          rawEventId: ev.id,
          dayLabel: `D-${ev.day || 1}`,
          title: itemName,
          category: ev.kind === 'flight' ? '機票航班' : (CATEGORY_META[ev.category || p.category]?.label || '行程花費'),
          twd: itemCost,
          payer: ev.payer || p.payer || members[0],
          splitAmong: members
        });
      }

      const trCost = Number(ev.transitToNext?.cost || 0) || 0;
      if (trCost > 0) {
        const tm = TRANSIT_META[ev.transitToNext?.mode] || TRANSIT_META.taxi;
        allRecords.push({
          id: `tr_${ev.id}`,
          source: 'transit',
          rawEventId: ev.id,
          dayLabel: `D-${ev.day || 1}`,
          title: `${tm.icon} ${tm.label} (${itemName} 出發)`,
          category: '交通車資',
          twd: trCost,
          payer: ev.transitToNext?.payer || ev.payer || members[0],
          splitAmong: members
        });
      }
    });

    // 2. 收集手動新增的額外開銷 (相容 trip.expenses 與 trip.extraExpenses)
    const manualList = Array.isArray(trip?.expenses) ? trip.expenses : [];
    manualList.forEach(ex => {
      const twdVal = Number(ex.twd ?? ex.amount ?? 0) || 0;
      if (twdVal > 0) {
        allRecords.push({
          id: ex.id || `exp_${Math.random()}`,
          source: 'extra',
          dayLabel: ex.date || '額外開銷',
          title: ex.title || ex.note || '其他支出',
          category: ex.category || '額外開銷',
          twd: twdVal,
          currency: ex.currency || 'TWD',
          originalAmount: ex.amount || twdVal,
          payer: ex.payer || members[0],
          splitAmong: Array.isArray(ex.splitAmong) && ex.splitAmong.length > 0 ? ex.splitAmong : members
        });
      }
    });

    const totalTwd = allRecords.reduce((s, r) => s + r.twd, 0);
    const avgPerPerson = members.length > 0 ? Math.round(totalTwd / members.length) : totalTwd;

    // 計算每位旅伴「已先墊付金額」、「應分攤金額」與「淨結算差額」
    const memberStats = {};
    members.forEach(m => {
      memberStats[m] = { paid: 0, shouldPay: 0, net: 0 };
    });

    allRecords.forEach(r => {
      const payer = memberStats[r.payer] !== undefined ? r.payer : members[0];
      if (memberStats[payer]) {
        memberStats[payer].paid += r.twd;
      }
      const validTargets = (r.splitAmong || []).filter(m => memberStats[m] !== undefined);
      const targets = validTargets.length > 0 ? validTargets : members;
      const shareAmt = r.twd / (targets.length || 1);
      targets.forEach(m => {
        if (memberStats[m]) {
          memberStats[m].shouldPay += shareAmt;
        }
      });
    });

    Object.keys(memberStats).forEach(m => {
      memberStats[m].net = Math.round(memberStats[m].paid - memberStats[m].shouldPay);
    });

    // 計算「誰應該給誰多少錢」最簡結算清單 (方案 B)
    const debtors = [];
    const creditors = [];
    Object.entries(memberStats).forEach(([name, st]) => {
      if (st.net < -1) debtors.push({ name, amount: -st.net });
      else if (st.net > 1) creditors.push({ name, amount: st.net });
    });

    const settlements = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const payAmt = Math.min(debtors[i].amount, creditors[j].amount);
      if (payAmt > 0) {
        settlements.push({
          from: debtors[i].name,
          to: creditors[j].name,
          amount: Math.round(payAmt)
        });
      }
      debtors[i].amount -= payAmt;
      creditors[j].amount -= payAmt;
      if (debtors[i].amount <= 1) i++;
      if (creditors[j].amount <= 1) j++;
    }

    return { allRecords, totalTwd, avgPerPerson, memberStats, settlements };
  }, [trip?.events, trip?.expenses, placeMap, membersList]);

  // 🧳 取得行前待辦與行李清單（若該行程尚無清單，預設提供實用範本）
  const checklists = useMemo(() => {
    const raw = trip?.checklists || {};
    return {
      todo: Array.isArray(raw.todo) ? raw.todo : DEFAULT_TODO_LIST,
      packing: Array.isArray(raw.packing) ? raw.packing : DEFAULT_PACKING_LIST
    };
  }, [trip?.checklists]);

  // 注入手機版防破版、iOS 表單對齊與列印專用 CSS
  useEffect(() => {
    if (!document.getElementById('tw-mobile-and-print-style')) {
      const st = document.createElement('style');
      st.id = 'tw-mobile-and-print-style';
      st.innerHTML = `
        html, body {
          overflow-x: hidden !important;
          max-width: 100vw !important;
        }
        input[type="time"], input[type="date"], select {
          -webkit-appearance: none;
          appearance: none;
          text-align: left !important;
          min-height: 44px;
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media print {
          body * { visibility: hidden !important; }
          #tw-printable-area, #tw-printable-area * { visibility: visible !important; }
          #tw-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `;
      document.head.appendChild(st);
    }
  }, []);

  // 當使用者在「Google 搜尋景點」打字時，即時查全球真實地圖座標建議
  useEffect(() => {
    const kw = gName.trim();
    if (!kw || kw.length < 2) {
      setOnlineSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingGeo(true);
      const geoRes = await geocodePlaceByName(kw);
      setIsSearchingGeo(false);
      if (geoRes && Array.isArray(geoRes.rawList)) {
        setOnlineSuggestions(geoRes.rawList);
      } else {
        setOnlineSuggestions([]);
      }
    }, 420);
    return () => clearTimeout(timer);
  }, [gName]);

  // 自動背景修復缺漏座標的景點
  useEffect(() => {
    let isCancelled = false;
    async function autoHealMissingCoords() {
      const missingEvs = currentDayEvents.filter(ev => {
        if (ev.kind === 'flight') return false;
        const p = placeMap[ev.placeId] || {};
        const lat = Number(ev.lat || p.lat);
        const lng = Number(ev.lng || p.lng);
        return !lat || !lng;
      });

      if (missingEvs.length === 0) return;

      let updatedAny = false;
      const nextEvents = [...(trip.events || [])];
      const nextPlaces = [...(trip.places || [])];

      for (const ev of missingEvs) {
        if (isCancelled) return;
        const p = placeMap[ev.placeId] || {};
        const targetName = ev.name || p.name;
        if (!targetName) continue;

        const geo = await geocodePlaceByName(targetName);
        if (geo && geo.lat && geo.lng) {
          updatedAny = true;
          const evIdx = nextEvents.findIndex(x => x.id === ev.id);
          if (evIdx !== -1) {
            nextEvents[evIdx] = {
              ...nextEvents[evIdx],
              lat: geo.lat,
              lng: geo.lng,
              address: nextEvents[evIdx].address || geo.address || ''
            };
          }
          const pIdx = nextPlaces.findIndex(x => x.id === ev.placeId);
          if (pIdx !== -1) {
            nextPlaces[pIdx] = {
              ...nextPlaces[pIdx],
              lat: geo.lat,
              lng: geo.lng,
              address: nextPlaces[pIdx].address || geo.address || ''
            };
          }
        }
      }

      if (updatedAny && !isCancelled) {
        onUpdateTrip({
          ...trip,
          places: nextPlaces,
          events: nextEvents
        });
      }
    }

    autoHealMissingCoords();
    return () => { isCancelled = true; };
  }, [currentDay, currentDayEvents.length]);

  // 當日 Google 路線圖渲染 (僅在 subTab === 'itinerary' 時繪製與重新計算尺寸)
  useEffect(() => {
    if (subTab !== 'itinerary' || !window.L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapContainerRef.current).setView([21.0285, 105.8542], 13);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;
    map.eachLayer(layer => {
      if (layer instanceof window.L.Marker || layer instanceof window.L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const pts = [];
    let stopIndex = 0;

    currentDayEvents.forEach((ev) => {
      if (ev.kind === 'flight') return;
      const p = placeMap[ev.placeId] || {};
      const name = ev.name || p.name || '未命名景點';
      let lat = Number(ev.lat || p.lat);
      let lng = Number(ev.lng || p.lng);

      if (!lat || !lng) {
        const matchedGeo = QUICK_GEO_DICT.find(g => name.toLowerCase().includes(g.kw.toLowerCase()));
        if (matchedGeo) {
          lat = matchedGeo.lat;
          lng = matchedGeo.lng;
        }
      }

      stopIndex += 1;
      if (lat && lng) {
        pts.push({ lat, lng, name, time: ev.time || '--:--', idx: stopIndex });

        const icon = window.L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:999px;background:#102d32;color:#fff;border:3px solid #167568;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 4px 10px rgba(0,0,0,0.25);">${stopIndex}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        window.L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${stopIndex}. ${name}</strong><br/><span style="font-size:11px;color:#666;">🕒 ${ev.time || ''}</span>`);
      }
    });

    if (pts.length >= 2) {
      const latlngs = pts.map(p => [p.lat, p.lng]);
      window.L.polyline(latlngs, { color: '#167568', weight: 4, dashArray: '7, 7' }).addTo(map);
    }

    if (pts.length > 0) {
      const bounds = pts.map(p => [p.lat, p.lng]);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
    setTimeout(() => map.invalidateSize(), 180);
  }, [subTab, currentDayEvents, placeMap, currentDay]);

  // 當切換分頁回到「行程」時，若地圖實例因 DOM 重建而失效則重置
  useEffect(() => {
    if (subTab !== 'itinerary') {
      mapInstanceRef.current = null;
    }
  }, [subTab]);

  // 產生當天 Google Maps 一鍵多點導航網址
  const googleMapsDayRouteUrl = useMemo(() => {
    const validStops = currentDayEvents
      .filter(ev => ev.kind !== 'flight')
      .map(ev => {
        const p = placeMap[ev.placeId] || {};
        return (ev.name || p.name || '').trim();
      })
      .filter(Boolean);

    if (validStops.length >= 2) {
      const origin = encodeURIComponent(validStops[0]);
      const destination = encodeURIComponent(validStops[validStops.length - 1]);
      const waypoints = validStops.slice(1, -1).map(n => encodeURIComponent(n)).join('|');
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
    }
    if (validStops.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(validStops[0])}`;
    }
    return 'https://www.google.com/maps';
  }, [currentDayEvents, placeMap]);

  // ==================== 互動操作函式 ====================

  const handleSelectDay = (d) => {
    setCurrentDay(d);
  };

  const handleAddOneDay = () => {
    const nextDays = totalDays + 1;
    const nextTitles = { ...(trip.dayTitles || {}), [nextDays]: `Day ${nextDays} 自由探索` };
    onUpdateTrip({
      ...trip,
      days: nextDays,
      day: nextDays,
      dayTitles: nextTitles
    });
    setCurrentDay(nextDays);
    if (showToast) showToast(`🎉 已新增 D-${nextDays}！`);
  };

  // 右上角鉛筆圖示：開啟標題、出發日期、天數、當日主題與旅伴設定
  const handleOpenTitleModal = () => {
    setEditMainTitle(trip.title || '');
    setEditStartDate(trip.start || '');
    setEditTotalDays(totalDays);
    setEditDaySubtitle(currentDaySubtitle);
    setEditMembersText(membersList.join('\n'));
    setShowTitleModal(true);
  };

  const handleSaveTitleModal = (e) => {
    e.preventDefault();
    if (!editMainTitle.trim()) return;
    const parsedMembers = [...new Set(editMembersText.split('\n').map(s => s.trim()).filter(Boolean))];
    const nextDayTitles = {
      ...(trip.dayTitles || {}),
      [currentDay]: editDaySubtitle.trim() || `Day ${currentDay} 精彩行程`
    };
    onUpdateTrip({
      ...trip,
      title: editMainTitle.trim(),
      start: editStartDate,
      days: Math.max(1, Number(editTotalDays) || 1),
      members: parsedMembers.length > 0 ? parsedMembers : ['娜娜'],
      dayTitles: nextDayTitles
    });
    setShowTitleModal(false);
    if (showToast) showToast('✅ 已更新行程標題、日期、當日主題與旅伴名單！');
  };

  // 1) 從「🔍 Google 搜尋」新增景點進時間軸
  const handleAddGooglePlace = async (e) => {
    e.preventDefault();
    if (!gName.trim()) {
      if (showToast) showToast('請輸入要加入的景點、餐廳、飯店或機場名稱');
      return;
    }
    const cleanName = gName.trim();
    const matchedSaved = allSavedPlaces.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    const savedCoords = matchedSaved ? window.parseCoordsFromUrl(matchedSaved.mapUrl) : {};

    let finalLat = gPickedCoords?.lat || savedCoords.lat || null;
    let finalLng = gPickedCoords?.lng || savedCoords.lng || null;
    let finalAddr = gAddr.trim() || matchedSaved?.address || '';

    if (!finalLat || !finalLng) {
      setIsSearchingGeo(true);
      const geo = await geocodePlaceByName(cleanName);
      setIsSearchingGeo(false);
      if (geo) {
        finalLat = geo.lat;
        finalLng = geo.lng;
        if (!finalAddr && geo.address) finalAddr = geo.address;
      }
    }

    const pid = 'p_' + Date.now();
    const newPlace = {
      id: pid,
      savedUid: matchedSaved ? matchedSaved.uid : '',
      name: cleanName,
      category: gCat,
      city: matchedSaved?.city || '',
      address: finalAddr,
      url: matchedSaved?.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}`,
      note: gNote.trim() || matchedSaved?.combinedNote || '',
      cost: Number(gCost) || 0,
      payer: gPayer || membersList[0],
      lat: finalLat,
      lng: finalLng
    };

    const newEv = {
      id: 'ev_' + Date.now(),
      kind: 'place',
      placeId: pid,
      name: cleanName,
      day: currentDay,
      time: gTime || '12:00',
      category: gCat,
      address: finalAddr,
      note: newPlace.note,
      cost: Number(gCost) || 0,
      payer: gPayer || membersList[0],
      lat: finalLat,
      lng: finalLng,
      savedUid: newPlace.savedUid,
      transitToNext: { mode: 'taxi', duration: '車程約 15 分鐘', cost: 0, note: '' }
    };

    onUpdateTrip({
      ...trip,
      places: [...(trip.places || []), newPlace],
      events: [...(trip.events || []), newEv]
    });

    setGName('');
    setGAddr('');
    setGCost('');
    setGNote('');
    setGPickedCoords(null);
    setShowAddHubModal(false);
    if (showToast) showToast(`📍 已將「${cleanName}」排入 D-${currentDay}！`);
  };

  // 2) 從「⭐ 娜娜的收藏庫」挑選加入時間軸
  const handlePickSavedPlace = async (colItem) => {
    const coords = window.parseCoordsFromUrl(colItem.mapUrl);
    let lat = coords.lat;
    let lng = coords.lng;
    if (!lat || !lng) {
      const geo = await geocodePlaceByName(colItem.name);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const cat = colItem.sourceTab === 'food' ? 'food' : 'spot';
    const pid = 'p_' + Date.now();

    const newPlace = {
      id: pid,
      savedUid: colItem.uid,
      name: colItem.name,
      category: cat,
      city: colItem.city || '',
      address: colItem.address || '',
      url: colItem.mapUrl || '',
      note: colItem.combinedNote || '',
      cost: 0,
      payer: membersList[0],
      lat,
      lng
    };

    const newEv = {
      id: 'ev_' + Date.now(),
      kind: 'place',
      placeId: pid,
      name: colItem.name,
      day: currentDay,
      time: favTime || '14:00',
      category: cat,
      address: colItem.address || '',
      note: colItem.combinedNote || '',
      cost: 0,
      payer: membersList[0],
      lat,
      lng,
      savedUid: colItem.uid,
      transitToNext: { mode: 'taxi', duration: '車程約 15 分鐘', cost: 0, note: '' }
    };

    onUpdateTrip({
      ...trip,
      places: [...(trip.places || []), newPlace],
      events: [...(trip.events || []), newEv]
    });

    setShowAddHubModal(false);
    if (showToast) showToast(`⭐ 已從收藏庫將「${colItem.name}」加入 D-${currentDay}！`);
  };

  // 3) 插入「✈️ 航班起飛 / 降落資訊卡」
  const handleAddFlightCard = (e) => {
    e.preventDefault();
    const newEv = {
      id: 'ev_fl_' + Date.now(),
      kind: 'flight',
      day: currentDay,
      time: flDepTime || '14:00',
      depTime: flDepTime || '14:00',
      arrTime: flArrTime || '16:00',
      fromAirport: flFrom.trim() || '出發機場',
      toAirport: flTo.trim() || '抵達機場',
      flightCode: flCode.trim() || '航班資訊',
      cost: Number(flCost) || 0,
      payer: flPayer || membersList[0],
      note: flNote.trim() || '',
      transitToNext: { mode: 'walk', duration: '入境與領行李約 30 分鐘', cost: 0, note: '' }
    };

    onUpdateTrip({
      ...trip,
      events: [...(trip.events || []), newEv]
    });

    setShowAddHubModal(false);
    if (showToast) showToast(`✈️ 已插入 ${flFrom} ➔ ${flTo} 航班資訊！`);
  };

  // 小鉛筆：開啟編輯視窗
  const handleOpenEditModal = (ev) => {
    const p = placeMap[ev.placeId] || {};
    setEditingEvent({
      ...ev,
      name: ev.name || p.name || '',
      category: ev.category || p.category || 'spot',
      address: ev.address || p.address || '',
      note: ev.note ?? p.note ?? '',
      cost: ev.cost ?? p.cost ?? 0,
      payer: ev.payer || p.payer || membersList[0],
      lat: ev.lat || p.lat || null,
      lng: ev.lng || p.lng || null
    });
  };

  // 小鉛筆：儲存景點/航班修改
  const handleSaveEditEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;
    setIsSavingEdit(true);

    let nextLat = editingEvent.lat;
    let nextLng = editingEvent.lng;
    let nextAddr = editingEvent.address || '';

    if (editingEvent.kind !== 'flight') {
      const oldP = placeMap[editingEvent.placeId] || {};
      const nameChanged = editingEvent.name && editingEvent.name !== (oldP.name || '');
      if (nameChanged || !nextLat || !nextLng) {
        const geo = await geocodePlaceByName(editingEvent.name);
        if (geo && geo.lat && geo.lng) {
          nextLat = geo.lat;
          nextLng = geo.lng;
          if (!nextAddr && geo.address) nextAddr = geo.address;
        }
      }
    }

    const nextEvents = (trip.events || []).map(ev => {
      if (ev.id !== editingEvent.id) return ev;
      return {
        ...ev,
        ...editingEvent,
        address: nextAddr,
        lat: nextLat,
        lng: nextLng,
        cost: Number(editingEvent.cost) || 0,
        payer: editingEvent.payer || membersList[0]
      };
    });

    const nextPlaces = (trip.places || []).map(p => {
      if (p.id !== editingEvent.placeId) return p;
      return {
        ...p,
        name: editingEvent.name,
        category: editingEvent.category,
        address: nextAddr,
        note: editingEvent.note,
        lat: nextLat,
        lng: nextLng,
        cost: Number(editingEvent.cost) || 0,
        payer: editingEvent.payer || membersList[0]
      };
    });

    onUpdateTrip({
      ...trip,
      places: nextPlaces,
      events: nextEvents
    });

    setIsSavingEdit(false);
    setEditingEvent(null);
    if (showToast) showToast('✅ 景點資訊、備註與花費已更新！');
  };

  const handleDeleteEvent = (evId) => {
    const nextEvents = (trip.events || []).filter(ev => ev.id !== evId);
    onUpdateTrip({
      ...trip,
      events: nextEvents
    });
    setEditingEvent(null);
    if (showToast) showToast('🗑️ 已從時間軸移除該項目');
  };

  const handleSaveTransit = (e) => {
    e.preventDefault();
    if (!editingTransitEv) return;

    const nextEvents = (trip.events || []).map(ev => {
      if (ev.id !== editingTransitEv.id) return ev;
      return {
        ...ev,
        transitToNext: {
          mode: editingTransitEv.mode || 'taxi',
          duration: editingTransitEv.duration || '車程約 15 分鐘',
          cost: Number(editingTransitEv.cost) || 0,
          payer: editingTransitEv.payer || membersList[0],
          note: editingTransitEv.note || ''
        }
      };
    });

    onUpdateTrip({
      ...trip,
      events: nextEvents
    });

    setEditingTransitEv(null);
    if (showToast) showToast('🚕 景點間交通與車資已更新！');
  };

  // 💰 新增不在行程時間軸內的「額外帳單開銷」
  const handleAddExtraExpense = (e) => {
    e.preventDefault();
    if (!expForm.title.trim() || !expForm.amount) return;

    const defaultRates = { TWD: 1, VND: 0.0013, JPY: 0.215, USD: 32.1, KRW: 0.024, EUR: 35 };
    const rateObj = { ...defaultRates, ...(trip?.rates || {}) };
    const rate = Number(rateObj[expForm.currency]) || 1;
    const twd = Math.round(Number(expForm.amount) * rate);

    const newExp = {
      id: 'exp_' + Date.now(),
      title: expForm.title.trim(),
      category: expForm.category || '其他開銷',
      amount: Number(expForm.amount),
      currency: expForm.currency || 'TWD',
      twd,
      payer: expForm.payer || membersList[0],
      splitAmong: expForm.splitAmong && expForm.splitAmong.length > 0 ? expForm.splitAmong : [...membersList],
      date: formatDayDateLabel(trip.start, currentDay)
    };

    const currentExpenses = Array.isArray(trip?.expenses) ? trip.expenses : [];
    onUpdateTrip({
      ...trip,
      expenses: [newExp, ...currentExpenses]
    });

    setExpForm({
      title: '',
      category: '餐飲/點心',
      amount: '',
      currency: 'TWD',
      payer: membersList[0],
      splitAmong: [...membersList]
    });
    setShowAddExpenseModal(false);
    if (showToast) showToast(`💰 已記錄開銷「${newExp.title}」NT$ ${twd.toLocaleString()}`);
  };

  const handleDeleteExtraExpense = (expId) => {
    const currentExpenses = Array.isArray(trip?.expenses) ? trip.expenses : [];
    onUpdateTrip({
      ...trip,
      expenses: currentExpenses.filter(x => x.id !== expId)
    });
    if (showToast) showToast('🗑️ 已刪除此筆額外開銷');
  };

  // 🧳 行李與待辦清單操作：打勾、新增、刪除
  const handleToggleChecklistItem = (groupKey, itemId) => {
    const nextGroup = checklists[groupKey].map(it =>
      it.id === itemId ? { ...it, done: !it.done } : it
    );
    onUpdateTrip({
      ...trip,
      checklists: {
        ...checklists,
        [groupKey]: nextGroup
      }
    });
  };

  const handleAddChecklistItem = (groupKey, text) => {
    const clean = (text || '').trim();
    if (!clean) return;
    const newItem = {
      id: `${groupKey}_${Date.now()}`,
      text: clean,
      done: false
    };
    onUpdateTrip({
      ...trip,
      checklists: {
        ...checklists,
        [groupKey]: [...checklists[groupKey], newItem]
      }
    });
    if (groupKey === 'todo') setNewTodoText('');
    else setNewPackText('');
  };

  const handleDeleteChecklistItem = (groupKey, itemId) => {
    onUpdateTrip({
      ...trip,
      checklists: {
        ...checklists,
        [groupKey]: checklists[groupKey].filter(it => it.id !== itemId)
      }
    });
  };

  // ✨ 匯出：下載高畫質 PNG 長圖
  const handleDownloadPNG = async () => {
    if (!window.html2canvas || !exportCardRef.current) {
      if (showToast) showToast('正在準備圖片轉換器，請再點一次');
      return;
    }
    setIsExportingImg(true);
    try {
      const canvas = await window.html2canvas(exportCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `${trip.title}_行程表.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (showToast) showToast('📸 已下載高畫質行程表長圖 (PNG)！');
    } catch (err) {
      if (showToast) showToast('匯出圖片失敗，建議使用旁邊的「存成 PDF」');
    } finally {
      setIsExportingImg(false);
    }
  };

  // ✨ 匯出：一鍵複製 LINE 排版文字
  const handleCopyLineText = () => {
    const targetDays = exportScope === 'all' ? dayNumbers : [currentDay];
    const lines = [`🌿【${trip.title}】`, `📅 出發日期：${trip.start || '未定'}`];

    targetDays.forEach(dNum => {
      const dTitle = (trip.dayTitles && trip.dayTitles[dNum]) || `Day ${dNum}`;
      lines.push(`\n━━━━━━━━━━━━━━`);
      lines.push(`📍 D-${dNum} (${formatDayDateLabel(trip.start, dNum)}) · ${dTitle}`);
      const evs = getEventsForDay(dNum);
      if (evs.length === 0) {
        lines.push(`   (尚無排程)`);
      } else {
        evs.forEach((ev, idx) => {
          if (ev.kind === 'flight') {
            lines.push(`✈️ ${ev.depTime} 起飛 (${ev.fromAirport}) ➔ ${ev.arrTime} 降落 (${ev.toAirport}) [${ev.flightCode || ''}]`);
            if (exportShowNote && ev.note) lines.push(`   📝 ${ev.note}`);
          } else {
            const p = placeMap[ev.placeId] || {};
            const cat = CATEGORY_META[ev.category || p.category] || CATEGORY_META.spot;
            const name = ev.name || p.name || '景點';
            const costVal = Number(ev.cost ?? p.cost ?? 0);
            const costStr = exportShowCost && costVal > 0 ? ` 💰NT$${costVal}` : '';
            lines.push(`${cat.icon} ${ev.time || '--:--'} ${name}${costStr}`);
            if (exportShowNote && (ev.note || p.note)) {
              lines.push(`   📝 ${ev.note || p.note}`);
            }
          }
          if (idx < evs.length - 1 && ev.transitToNext) {
            const tm = TRANSIT_META[ev.transitToNext.mode] || TRANSIT_META.taxi;
            const trCost = Number(ev.transitToNext.cost || 0);
            lines.push(`   ⇣ ${tm.icon} ${tm.label} (${ev.transitToNext.duration || ''})${exportShowCost && trCost > 0 ? ` · 車資NT$${trCost}` : ''}`);
          }
        });
      }
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      if (showToast) showToast('💬 已複製 LINE 精美排版文字！可直接貼給旅伴！');
    });
  };

  // 結合「收藏庫」+「內建地標」+「全球即時座標 API」的建議清單
  const combinedSearchSuggestions = useMemo(() => {
    const kw = gName.trim().toLowerCase();
    if (!kw) return [];
    const fromSaved = allSavedPlaces
      .filter(p => `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(kw))
      .slice(0, 3)
      .map(p => {
        const c = window.parseCoordsFromUrl(p.mapUrl);
        return {
          name: p.name,
          address: p.address || p.city || '',
          cat: p.sourceTab === 'food' ? 'food' : 'spot',
          note: p.combinedNote || '',
          lat: c.lat,
          lng: c.lng,
          source: '⭐ 你的收藏庫'
        };
      });
    const fromDict = QUICK_GEO_DICT
      .filter(g => g.kw.toLowerCase().includes(kw) || g.addr.toLowerCase().includes(kw))
      .slice(0, 2)
      .map(g => ({
        name: g.kw,
        address: g.addr,
        cat: g.cat,
        note: '',
        lat: g.lat,
        lng: g.lng,
        source: '✈️ 熱門地標'
      }));
    return [...fromSaved, ...fromDict, ...onlineSuggestions].slice(0, 6);
  }, [gName, allSavedPlaces, onlineSuggestions]);

  return (
    <div className="space-y-4 pb-12 w-full max-w-full overflow-x-hidden">
      
      {/* 1️⃣ 極簡純圖示頂部導覽列（左邊 < 返回，右邊 紙飛機匯出 + 鉛筆修改，完全不加文字） */}
      <div className="flex items-center justify-between py-0.5">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white hover:bg-soft border border-line flex items-center justify-center text-deep shadow-sm transition-transform active:scale-95"
          title="返回行程列表"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          {/* 紙飛機圖示：一鍵匯出漂亮行程表 (PDF / 長圖 / LINE) */}
          <button
            onClick={() => setShowExportModal(true)}
            className="w-10 h-10 rounded-full bg-white hover:bg-soft border border-line flex items-center justify-center text-accent shadow-sm transition-transform active:scale-95"
            title="一鍵匯出與分享行程表 (PDF / 長圖)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>

          {/* 鉛筆圖示：修改行程標題、出發日期、當日主題與旅伴 */}
          <button
            onClick={handleOpenTitleModal}
            className="w-10 h-10 rounded-full bg-white hover:bg-soft border border-line flex items-center justify-center text-deep shadow-sm transition-transform active:scale-95"
            title="修改行程主題、出發日期與旅伴"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2️⃣ 保留深綠色大色塊（移除內部多餘的小鉛筆修改文字） */}
      <div className="bg-gradient-to-br from-deep via-[#153d43] to-accent text-white rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[#e3c38f]">
                DAY {currentDay} · {formatDayDateLabel(trip.start, currentDay)}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-[#cde4d7]">
                {totalDays}天{Math.max(1, totalDays - 1)}晚
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight break-words">
              {trip.title}
            </h1>
            <p className="text-xs sm:text-sm text-[#cde4d7] font-medium break-words">
              📍 D-{currentDay} 主題：{currentDaySubtitle}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 sm:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-[#b4d2c7] font-bold block">
              D-{currentDay} 當日預估總花費 (含車資)
            </span>
            <strong className="text-xl sm:text-2xl font-extrabold text-[#e3c38f]">
              NT$ {calcDayTotalCost(currentDay).toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* 3️⃣ 底線式三大分頁切換列：行程 ｜ 旅行帳單 ｜ 行李清單（純文字，不顯示金額與數字） */}
      <div className="border-b border-line flex items-center gap-8 px-2 pt-1">
        {[
          { key: 'itinerary', label: '行程' },
          { key: 'bill',      label: '旅行帳單' },
          { key: 'checklist', label: '行李清單' }
        ].map(tab => {
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`relative pb-3 text-base font-extrabold transition-colors whitespace-nowrap ${
                active ? 'text-deep' : 'text-muted hover:text-ink font-semibold'
              }`}
            >
              <span>{tab.label}</span>
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[3.5px] bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ==========================================================================
          分頁 A：【行程】 (含 D-1/D-2 切換、時間軸、大＋號、底部當日 Google 路線圖)
         ========================================================================== */}
      {subTab === 'itinerary' && (
        <div className="space-y-4 animate-fade-in">
          {/* D-1 / D-2 / D-3 天數切換膠囊列 */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {dayNumbers.map(dNum => {
              const isActive = dNum === currentDay;
              const count = getEventsForDay(dNum).length;
              return (
                <button
                  key={dNum}
                  onClick={() => handleSelectDay(dNum)}
                  className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 border ${
                    isActive
                      ? 'bg-deep text-white border-deep shadow-md'
                      : 'bg-white text-muted border-line hover:border-accent hover:text-deep'
                  }`}
                >
                  <span>D-{dNum}</span>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-[#e3c38f]' : 'text-muted'}`}>
                    {formatDayDateLabel(trip.start, dNum)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-paper text-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              onClick={handleAddOneDay}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-soft hover:bg-accent hover:text-white text-accent border border-dashed border-accent transition-colors shrink-0"
            >
              ＋ 加一天
            </button>
          </div>

          {/* 嚴格三欄對齊時間軸（iPhone 16 Pro 完美對齊不溢出） */}
          <div className="relative pt-1 pb-4 w-full">
            <div className="absolute left-[68px] sm:left-[84px] top-6 bottom-20 w-[2.5px] bg-gradient-to-b from-accent via-line to-accent rounded-full pointer-events-none" />

            {currentDayEvents.length === 0 ? (
              <div className="editorial-card p-8 text-center space-y-2 border-dashed border-2 border-line relative z-10">
                <div className="text-3xl">🌿</div>
                <p className="text-sm font-bold text-deep">D-{currentDay} 目前還沒有排入行程</p>
                <p className="text-xs text-muted">
                  點擊下方的大圓形「＋」號，即可從 Google 搜尋新景點、從收藏庫挑選、或插入起飛降落航班！
                </p>
              </div>
            ) : (
              <div className="space-y-3 relative z-10 w-full">
                {currentDayEvents.map((ev, idx) => {
                  const isLast = idx === currentDayEvents.length - 1;
                  const p = placeMap[ev.placeId] || {};
                  const itemName = ev.name || p.name || '未命名地點';
                  const itemCatKey = ev.category || p.category || 'spot';
                  const catMeta = CATEGORY_META[itemCatKey] || CATEGORY_META.spot;
                  const itemAddress = ev.address || p.address || '';
                  const itemNote = ev.note ?? p.note ?? '';
                  const itemCost = Number(ev.cost ?? p.cost ?? 0);
                  const savedUid = ev.savedUid || p.savedUid || '';

                  const tr = ev.transitToNext || { mode: 'taxi', duration: '車程約 15 分鐘', cost: 0, note: '' };
                  const trMeta = TRANSIT_META[tr.mode] || TRANSIT_META.taxi;

                  return (
                    <React.Fragment key={ev.id}>
                      <div className="grid grid-cols-[52px_16px_minmax(0,1fr)] sm:grid-cols-[68px_16px_minmax(0,1fr)] gap-2 sm:gap-3 items-start w-full">
                        
                        {/* 第 1 欄：時間與分類 */}
                        {ev.kind === 'flight' ? (
                          <div className="text-right pt-3">
                            <div className="text-xs sm:text-sm font-extrabold text-sky-800 leading-tight">{ev.depTime || '14:00'}</div>
                            <div className="text-[10px] font-bold text-sky-400 leading-none my-0.5">↓</div>
                            <div className="text-xs sm:text-sm font-extrabold text-sky-800 leading-tight">{ev.arrTime || '16:00'}</div>
                          </div>
                        ) : (
                          <div className="text-right pt-3.5">
                            <div className="text-xs sm:text-base font-extrabold text-deep leading-tight">{ev.time || '--:--'}</div>
                            <div className="text-[10px] font-bold text-muted mt-0.5">{catMeta.label}</div>
                          </div>
                        )}

                        {/* 第 2 欄：時間軸節點圓圈 */}
                        <div className="flex justify-center pt-4">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border-[3px] border-white shadow ${
                              ev.kind === 'flight' ? 'bg-sky-600 ring-2 ring-sky-500' : 'bg-accent ring-2 ring-accent'
                            }`}
                          />
                        </div>

                        {/* 第 3 欄：行程卡片本體 */}
                        {ev.kind === 'flight' ? (
                          <div className="min-w-0 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-3.5 sm:p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-2 mb-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-600 text-white whitespace-nowrap">
                                  ✈️ 航班起降
                                </span>
                                <strong className="text-xs sm:text-sm font-extrabold text-sky-950 break-words">
                                  {ev.flightCode || '航班資訊'}
                                </strong>
                                {itemCost > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                    💰 NT$ {itemCost.toLocaleString()}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleOpenEditModal(ev)}
                                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-sky-100 text-sky-900 border border-sky-200 whitespace-nowrap"
                                >
                                  ✎ 編輯
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(ev.id)}
                                  className="px-2 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 items-center bg-white/90 rounded-xl p-3 border border-sky-100 gap-1">
                              <div className="min-w-0">
                                <span className="text-[9px] font-extrabold text-sky-600 uppercase block">🛫 起飛</span>
                                <strong className="text-sm sm:text-lg font-extrabold text-deep">{ev.depTime}</strong>
                                <span className="block text-[11px] font-bold text-ink break-words">{ev.fromAirport}</span>
                              </div>
                              <div className="text-center">
                                <span className="text-base sm:text-xl">✈️</span>
                                <span className="block text-[9px] text-muted font-bold">直飛</span>
                              </div>
                              <div className="text-right min-w-0">
                                <span className="text-[9px] font-extrabold text-sky-600 uppercase block">🛬 降落</span>
                                <strong className="text-sm sm:text-lg font-extrabold text-deep">{ev.arrTime}</strong>
                                <span className="block text-[11px] font-bold text-ink break-words">{ev.toAirport}</span>
                              </div>
                            </div>

                            {itemNote && (
                              <div className="mt-2.5 text-xs text-sky-950 bg-white/80 px-3 py-2.5 rounded-xl border border-sky-100 whitespace-pre-wrap break-words leading-relaxed">
                                <strong className="text-sky-700">📝 備註：</strong>{itemNote}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="min-w-0 editorial-card p-3.5 sm:p-5 hover:border-accent transition-all">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border whitespace-nowrap ${catMeta.badgeCls}`}>
                                  {catMeta.icon} {catMeta.label}
                                </span>
                                {itemCost > 0 && (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                                    💰 NT$ {itemCost.toLocaleString()}
                                  </span>
                                )}
                                <button
                                  onClick={() => onJumpToSaved && onJumpToSaved(itemName, savedUid)}
                                  className="text-[11px] font-bold text-accent hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
                                >
                                  ⭐ 收藏頁 ↗
                                </button>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleOpenEditModal(ev)}
                                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-paper hover:bg-soft text-deep border border-line transition-colors whitespace-nowrap"
                                >
                                  ✎ 編輯
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(ev.id)}
                                  className="px-2 py-1 rounded-xl text-[11px] font-bold bg-paper hover:bg-red-50 text-red-600 border border-line transition-colors"
                                  title="刪除"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>

                            <div className="mt-2 min-w-0">
                              <h3
                                onClick={() => onJumpToSaved && onJumpToSaved(itemName, savedUid)}
                                className="text-base sm:text-lg font-extrabold text-deep hover:text-accent cursor-pointer transition-colors break-words leading-snug"
                              >
                                {itemName}
                              </h3>
                              {itemAddress && (
                                <p className="text-[11px] text-muted mt-0.5 break-words leading-normal">
                                  📍 {itemAddress}
                                </p>
                              )}
                            </div>

                            {/* 備註框：自動換行顯示所有文字，字越多框自動加大 */}
                            <div
                              onClick={() => handleOpenEditModal(ev)}
                              className="mt-3 px-3.5 py-2.5 rounded-2xl bg-paper/90 hover:bg-soft/60 border border-line text-xs text-ink cursor-pointer transition-colors w-full"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">
                                  <strong className="text-accent">📝 備註：</strong>
                                  {itemNote ? (
                                    <span className="text-ink">{itemNote}</span>
                                  ) : (
                                    <span className="text-muted">點擊小鉛筆新增必點招牌、門票或花費備註...</span>
                                  )}
                                </div>
                                <span className="text-[11px] font-bold text-accent shrink-0 pt-0.5">✎</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 景點與景點之間的「🚕 交通方式與車資」連接器 */}
                      {!isLast && (
                        <div className="grid grid-cols-[52px_16px_minmax(0,1fr)] sm:grid-cols-[68px_16px_minmax(0,1fr)] gap-2 sm:gap-3 items-center w-full py-0.5">
                          <div />
                          <div />
                          <div className="min-w-0">
                            <button
                              onClick={() => setEditingTransitEv({
                                id: ev.id,
                                mode: tr.mode || 'taxi',
                                duration: tr.duration || '車程約 15 分鐘',
                                cost: tr.cost || 0,
                                payer: tr.payer || ev.payer || membersList[0],
                                note: tr.note || ''
                              })}
                              className="w-full sm:w-auto text-left inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2 rounded-2xl bg-white hover:bg-soft border border-dashed border-accent/60 text-xs font-bold text-ink shadow-sm transition-all"
                            >
                              <span className="whitespace-nowrap">{trMeta.icon} {trMeta.label}</span>
                              <span className="text-muted whitespace-nowrap">· {tr.duration || '設定時間'}</span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] whitespace-nowrap">
                                💰 車資 NT$ {Number(tr.cost || 0).toLocaleString()}
                              </span>
                              {tr.note && <span className="text-muted font-normal break-words">({tr.note})</span>}
                              <span className="text-accent underline text-[11px] whitespace-nowrap ml-auto sm:ml-1">✎ 編輯交通</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* 時間軸底部：大圓形「＋」按鈕 */}
            <div className="mt-6 flex flex-col items-center justify-center relative z-10 px-4 text-center">
              <button
                onClick={() => {
                  setAddHubTab('google');
                  setShowAddHubModal(true);
                }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white hover:bg-accent text-accent hover:text-white border-2 border-dashed border-accent shadow-lg flex items-center justify-center text-3xl font-bold transition-all hover:scale-105 active:scale-95"
              >
                ＋
              </button>
              <span
                onClick={() => {
                  setAddHubTab('google');
                  setShowAddHubModal(true);
                }}
                className="text-xs font-bold text-accent mt-2 cursor-pointer hover:underline leading-relaxed"
              >
                點擊「＋」選擇：Google 搜尋景點 ／ 加入收藏 ／ 插入航班
              </span>
            </div>
          </div>

          {/* 最底部：🗺️ 當天的 Google 路線圖 */}
          <div className="editorial-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗺️</span>
                  <h3 className="text-base font-serif font-bold text-deep">
                    當天的 Google 路線圖 (D-{currentDay})
                  </h3>
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  自動依時間順序串聯 D-{currentDay} 所有地點真實座標，點擊下方按鈕可直接開啟 Google Maps 導航。
                </p>
              </div>

              <a
                href={googleMapsDayRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-deep hover:bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors w-full sm:w-auto"
              >
                🧭 一鍵開啟 Google Maps 當天路線導航 ↗
              </a>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {currentDayEvents.filter(e => e.kind !== 'flight').length === 0 ? (
                <span className="text-muted text-xs">當日尚無地面景點可繪製路線</span>
              ) : (
                currentDayEvents
                  .filter(e => e.kind !== 'flight')
                  .map((ev, i, arr) => {
                    const name = ev.name || placeMap[ev.placeId]?.name || '景點';
                    return (
                      <React.Fragment key={ev.id}>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-paper border border-line font-bold text-deep max-w-full">
                          <span className="w-4 h-4 rounded-full bg-deep text-white text-[10px] grid place-items-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{name}</span>
                        </span>
                        {i < arr.length - 1 && <span className="text-accent font-extrabold">➔</span>}
                      </React.Fragment>
                    );
                  })
              )}
            </div>

            <div
              ref={mapContainerRef}
              className="w-full h-64 sm:h-72 rounded-2xl border border-line overflow-hidden z-0"
            />
          </div>
        </div>
      )}

      {/* ==========================================================================
          分頁 B：【💰 旅行帳單】 (結合方案 A 平均分攤 + 方案 B 墊付結算 + 額外開銷)
         ========================================================================== */}
      {subTab === 'bill' && (
        <div className="space-y-5 animate-fade-in">
          {/* 頂部帳單總覽與每人平均分攤 (方案 A) */}
          <div className="editorial-card p-5 bg-gradient-to-br from-white to-paper space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-accent">TRIP EXPENSE & SPLIT</span>
                <h3 className="text-lg font-serif font-bold text-deep mt-0.5">💰 旅程總支出與分攤計算</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExpForm({
                    title: '',
                    category: '餐飲/點心',
                    amount: '',
                    currency: 'TWD',
                    payer: membersList[0],
                    splitAmong: [...membersList]
                  });
                  setShowAddExpenseModal(true);
                }}
                className="bg-deep hover:bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors flex items-center gap-1.5"
              >
                ＋ 新增額外開銷 (不在行程內)
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-soft/70 border border-[#cde4d7] rounded-2xl p-3.5">
                <span className="text-[11px] text-muted font-bold block">📊 旅程累計總花費</span>
                <strong className="text-xl font-extrabold text-deep mt-1 block">
                  NT$ {billSummary.totalTwd.toLocaleString()}
                </strong>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5">
                <span className="text-[11px] text-amber-900 font-bold block">👥 每人平均分攤 ({membersList.length}人)</span>
                <strong className="text-xl font-extrabold text-amber-800 mt-1 block">
                  NT$ {billSummary.avgPerPerson.toLocaleString()}
                </strong>
              </div>
              <div className="col-span-2 sm:col-span-1 bg-white border border-line rounded-2xl p-3.5">
                <span className="text-[11px] text-muted font-bold block">🧾 帳單總筆數</span>
                <strong className="text-xl font-extrabold text-ink mt-1 block">
                  {billSummary.allRecords.length} <span className="text-xs font-normal text-muted">筆明細</span>
                </strong>
              </div>
            </div>

            {/* 方案 B：誰先墊錢 & 最簡結算建議 */}
            <div className="bg-white rounded-2xl p-4 border border-line space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <strong className="text-xs font-extrabold text-deep">🤝 旅伴墊付與結算建議 (誰該給誰錢)</strong>
                <button
                  type="button"
                  onClick={handleOpenTitleModal}
                  className="text-[11px] text-accent font-bold hover:underline"
                >
                  ✎ 點此增減旅伴名單
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {Object.entries(billSummary.memberStats).map(([name, st]) => (
                  <div key={name} className="p-2.5 rounded-xl bg-paper border border-line flex items-center justify-between">
                    <div>
                      <strong className="text-deep block">{name}</strong>
                      <span className="text-[10px] text-muted">已先付 NT$ {Math.round(st.paid).toLocaleString()}</span>
                    </div>
                    <span className={`font-extrabold ${st.net >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {st.net >= 0 ? `應收 +${st.net.toLocaleString()}` : `應付 ${st.net.toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>

              {billSummary.settlements.length > 0 && (
                <div className="pt-2 border-t border-line space-y-1.5">
                  {billSummary.settlements.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-emerald-50/70 px-3 py-2 rounded-xl border border-emerald-200">
                      <span className="font-bold text-deep">
                        👉 <strong>{s.from}</strong> 應轉帳給 <strong>{s.to}</strong>
                      </span>
                      <strong className="text-emerald-800 font-extrabold">NT$ {s.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 每一筆詳細花費明細（含行程花費、交通車資與額外開銷） */}
          <div className="editorial-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-bold text-base text-deep">📋 每一筆詳細花費明細</h4>
              <span className="text-[11px] text-muted">含行程花費、車資與額外開銷</span>
            </div>

            {billSummary.allRecords.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">
                目前還沒有任何花費紀錄喔！你可以在行程卡片中填寫花費，或點擊上方「＋ 新增額外開銷」。
              </p>
            ) : (
              <div className="divide-y divide-line">
                {billSummary.allRecords.map(rec => (
                  <div key={rec.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.source === 'extra' ? 'bg-amber-100 text-amber-800' : 'bg-soft text-accent'
                        }`}>
                          {rec.dayLabel} · {rec.category}
                        </span>
                        <strong className="text-sm font-bold text-deep break-words">{rec.title}</strong>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">
                        💳 先付：<strong className="text-ink">{rec.payer}</strong> · 分攤：{(rec.splitAmong || []).join('、')}
                      </p>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <strong className="text-sm font-extrabold text-deep block">
                          NT$ {rec.twd.toLocaleString()}
                        </strong>
                        <span className="text-[10px] text-muted">
                          每人約 NT$ {Math.round(rec.twd / ((rec.splitAmong || []).length || 1)).toLocaleString()}
                        </span>
                      </div>
                      {rec.source === 'extra' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExtraExpense(rec.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                          title="刪除此筆額外開銷"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          分頁 C：【🧳 行李清單】 (分成「📋 行前準備待辦」與「🧳 行李必備」2 大區塊)
         ========================================================================== */}
      {subTab === 'checklist' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          {/* 區塊 1：📋 行前準備待辦事項 */}
          <div className="editorial-card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-accent">PRE-TRIP TO-DO</span>
                  <h3 className="text-base font-serif font-bold text-deep">📋 行前準備待辦清單</h3>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-soft text-accent">
                  已完成 {checklists.todo.filter(x => x.done).length} / {checklists.todo.length}
                </span>
              </div>

              <div className="space-y-2">
                {checklists.todo.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklistItem('todo', item.id)}
                    className={`p-3 rounded-2xl border flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                      item.done ? 'bg-paper/60 border-line text-muted line-through' : 'bg-white border-line hover:border-accent text-deep'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-base leading-none pt-0.5">{item.done ? '✅' : '⬜'}</span>
                      <span className="text-xs font-bold break-words leading-relaxed">{item.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChecklistItem('todo', item.id);
                      }}
                      className="text-xs text-muted hover:text-red-500 px-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddChecklistItem('todo', newTodoText);
              }}
              className="flex gap-2 pt-2 border-t border-line"
            >
              <input
                type="text"
                placeholder="＋ 新增行前待辦（如：換越南盾、買網卡）..."
                value={newTodoText}
                onChange={e => setNewTodoText(e.target.value)}
                className="flex-1 bg-paper border border-line rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink"
              />
              <button
                type="submit"
                className="bg-deep hover:bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0"
              >
                新增
              </button>
            </form>
          </div>

          {/* 區塊 2：🧳 行李必備打包清單 */}
          <div className="editorial-card p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold">PACKING LIST</span>
                  <h3 className="text-base font-serif font-bold text-deep">🧳 行李必備打包清單</h3>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800">
                  已打包 {checklists.packing.filter(x => x.done).length} / {checklists.packing.length}
                </span>
              </div>

              <div className="space-y-2">
                {checklists.packing.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklistItem('packing', item.id)}
                    className={`p-3 rounded-2xl border flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                      item.done ? 'bg-paper/60 border-line text-muted line-through' : 'bg-white border-line hover:border-accent text-deep'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-base leading-none pt-0.5">{item.done ? '✅' : '⬜'}</span>
                      <span className="text-xs font-bold break-words leading-relaxed">{item.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChecklistItem('packing', item.id);
                      }}
                      className="text-xs text-muted hover:text-red-500 px-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddChecklistItem('packing', newPackText);
              }}
              className="flex gap-2 pt-2 border-t border-line"
            >
              <input
                type="text"
                placeholder="＋ 新增行李物品（如：護照、行動電源）..."
                value={newPackText}
                onChange={e => setNewPackText(e.target.value)}
                className="flex-1 bg-paper border border-line rounded-xl px-3.5 py-2.5 text-xs font-bold text-ink"
              />
              <button
                type="submit"
                className="bg-deep hover:bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-xl shrink-0"
              >
                新增
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 1：點擊大「＋」號後的三合一選擇器
         ========================================================================== */}
      {showAddHubModal && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-line animate-fade-in">
            <div className="bg-deep text-white px-5 py-4 flex items-center justify-between sticky top-0 z-10">
              <h3 className="font-serif font-bold text-sm sm:text-base">
                ➕ 新增行程至 D-{currentDay} ({formatDayDateLabel(trip.start, currentDay)})
              </h3>
              <button onClick={() => setShowAddHubModal(false)} className="text-white/70 hover:text-white text-lg px-1">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-2 bg-paper border-b border-line text-[11px] sm:text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setAddHubTab('google')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'google' ? 'bg-deep text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                🔍 Google 搜尋
              </button>
              <button
                type="button"
                onClick={() => setAddHubTab('saved')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'saved' ? 'bg-deep text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                ⭐ 從收藏加入 ({allSavedPlaces.length})
              </button>
              <button
                type="button"
                onClick={() => setAddHubTab('flight')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'flight' ? 'bg-sky-600 text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                ✈️ 插入航班
              </button>
            </div>

            {addHubTab === 'google' && (
              <form onSubmit={handleAddGooglePlace} className="p-5 sm:p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">預計時間 *</label>
                    <input
                      type="time"
                      value={gTime}
                      onChange={e => setGTime(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">景點分類 *</label>
                    <select
                      value={gCat}
                      onChange={e => setGCat(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                    >
                      <option value="spot">📸 景點</option>
                      <option value="food">🍽️ 餐廳</option>
                      <option value="hotel">🏨 住宿</option>
                      <option value="airport">✈️ 機場</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-deep">輸入 Google 景點 / 餐廳 / 飯店名稱 *</label>
                    {isSearchingGeo && (
                      <span className="text-[11px] text-accent font-bold">🌐 正在連動地圖座標...</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="例如：Phở 10 Lý Quốc Sư、Acoustic Hotel..."
                    value={gName}
                    onChange={e => {
                      setGName(e.target.value);
                      setGPickedCoords(null);
                    }}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 text-sm font-bold text-ink"
                    required
                  />

                  {gPickedCoords && (
                    <div className="mt-1.5 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      ✅ 已成功綁定真實地圖座標 ({gPickedCoords.lat.toFixed(4)}, {gPickedCoords.lng.toFixed(4)})
                    </div>
                  )}

                  {combinedSearchSuggestions.length > 0 && !gPickedCoords && (
                    <div className="mt-1.5 border border-line rounded-2xl bg-white shadow-lg max-h-44 overflow-y-auto divide-y divide-line">
                      {combinedSearchSuggestions.map((sug, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setGName(sug.name);
                            if (sug.cat) setGCat(sug.cat);
                            if (sug.address) setGAddr(sug.address);
                            if (sug.note) setGNote(sug.note);
                            if (sug.lat && sug.lng) {
                              setGPickedCoords({ lat: sug.lat, lng: sug.lng });
                            }
                          }}
                          className="px-3.5 py-2.5 hover:bg-soft cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <strong className="text-deep block truncate">{sug.name}</strong>
                            <span className="text-[11px] text-muted block truncate">{sug.address}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-paper text-accent shrink-0">
                            {sug.source}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">💰 預估花費 (NT$)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={gCost}
                      onChange={e => setGCost(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 text-ink font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">💳 誰先付錢</label>
                    <select
                      value={gPayer}
                      onChange={e => setGPayer(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                    >
                      {membersList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-deep block mb-1.5">📝 備註（支援多行換行）</label>
                  <textarea
                    rows="3"
                    placeholder="例如：買蠟燭、香氛、看教堂、吃法棍..."
                    value={gNote}
                    onChange={e => setGNote(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl p-3.5 text-ink leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddHubModal(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-muted hover:text-deep"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSearchingGeo}
                    className="px-6 py-2.5 rounded-xl font-bold bg-accent hover:bg-deep text-white shadow transition-colors disabled:opacity-50"
                  >
                    {isSearchingGeo ? '定位座標中...' : `＋ 加入 D-${currentDay} 行程`}
                  </button>
                </div>
              </form>
            )}

            {addHubTab === 'saved' && (
              <div className="p-5 sm:p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">排入時間</label>
                    <input
                      type="time"
                      value={favTime}
                      onChange={e => setFavTime(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-deep block mb-1.5">搜尋你的收藏庫</label>
                    <input
                      type="text"
                      placeholder="🔍 輸入店名、城市或必點備註..."
                      value={favSearch}
                      onChange={e => setFavSearch(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 text-ink"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {[['all', '全部'], ['food', '🍽️ 餐廳'], ['spot', '📸 景點']].map(([k, lb]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFavCatFilter(k)}
                      className={`px-3 py-1.5 rounded-xl font-bold ${favCatFilter === k ? 'bg-deep text-white' : 'bg-paper text-muted'}`}
                    >
                      {lb}
                    </button>
                  ))}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {allSavedPlaces
                    .filter(item => {
                      if (favCatFilter !== 'all' && item.sourceTab !== favCatFilter) return false;
                      if (!favSearch.trim()) return true;
                      const kw = favSearch.toLowerCase();
                      return `${item.name} ${item.city} ${item.combinedNote}`.toLowerCase().includes(kw);
                    })
                    .map(item => (
                      <div
                        key={item.uid}
                        className="p-3 rounded-2xl border border-line hover:border-accent bg-paper/50 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-line">
                              {item.sourceTab === 'food' ? '🍽️ 餐廳' : '📸 景點'}
                            </span>
                            <strong className="text-sm text-deep truncate">{item.name}</strong>
                            <span className="text-muted">({item.city || '未分類'})</span>
                          </div>
                          {item.combinedNote && (
                            <p className="text-[11px] text-muted line-clamp-2 mt-1">{item.combinedNote}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePickSavedPlace(item)}
                          className="shrink-0 bg-deep hover:bg-accent text-white font-bold px-3.5 py-2 rounded-xl transition-colors"
                        >
                          ＋ 排入
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {addHubTab === 'flight' && (
              <form onSubmit={handleAddFlightCard} className="p-5 sm:p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">🛫 起飛時間 *</label>
                    <input
                      type="time"
                      value={flDepTime}
                      onChange={e => setFlDepTime(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">🛬 降落時間 *</label>
                    <input
                      type="time"
                      value={flArrTime}
                      onChange={e => setFlArrTime(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">出發機場 *</label>
                    <input
                      type="text"
                      placeholder="例如：小港機場 (KHH)"
                      value={flFrom}
                      onChange={e => setFlFrom(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">降落機場 *</label>
                    <input
                      type="text"
                      placeholder="例如：內排機場 (HAN)"
                      value={flTo}
                      onChange={e => setFlTo(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1.5">航班代號</label>
                    <input
                      type="text"
                      placeholder="VN587"
                      value={flCode}
                      onChange={e => setFlCode(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3 text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">💰 機票 (NT$)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={flCost}
                      onChange={e => setFlCost(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3 text-ink font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">💳 先付旅伴</label>
                    <select
                      value={flPayer}
                      onChange={e => setFlPayer(e.target.value)}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3 font-bold text-ink"
                    >
                      {membersList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-deep block mb-1.5">📝 航班備註</label>
                  <textarea
                    rows="2"
                    placeholder="例如：T2 航廈報到、含 23kg 託運行李"
                    value={flNote}
                    onChange={e => setFlNote(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl p-3.5 text-ink"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddHubModal(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl font-bold bg-sky-600 hover:bg-sky-700 text-white shadow"
                  >
                    ✈️ 插入航班卡片
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 2：小鉛筆編輯景點 / 備註 / 花費 / 分類 / 付款人
         ========================================================================== */}
      {editingEvent && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveEditEvent}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-deep text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">✎ 編輯行程項目、備註與花費</h3>
              <button type="button" onClick={() => setEditingEvent(null)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs">
              {editingEvent.kind === 'flight' ? (
                <>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="font-bold text-deep block mb-1.5">🛫 起飛時間</label>
                      <input
                        type="time"
                        value={editingEvent.depTime || '14:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, depTime: e.target.value, time: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1.5">🛬 降落時間</label>
                      <input
                        type="time"
                        value={editingEvent.arrTime || '16:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, arrTime: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="font-bold text-deep block mb-1.5">出發機場</label>
                      <input
                        type="text"
                        value={editingEvent.fromAirport || ''}
                        onChange={e => setEditingEvent({ ...editingEvent, fromAirport: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1.5">降落機場</label>
                      <input
                        type="text"
                        value={editingEvent.toAirport || ''}
                        onChange={e => setEditingEvent({ ...editingEvent, toAirport: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1.5">航班代號</label>
                    <input
                      type="text"
                      value={editingEvent.flightCode || ''}
                      onChange={e => setEditingEvent({ ...editingEvent, flightCode: e.target.value })}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="font-bold text-deep block mb-1.5 whitespace-nowrap">時間</label>
                      <input
                        type="time"
                        value={editingEvent.time || '12:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1.5 whitespace-nowrap">景點分類</label>
                      <select
                        value={editingEvent.category || 'spot'}
                        onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })}
                        className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                      >
                        <option value="spot">📸 景點</option>
                        <option value="food">🍽️ 餐廳</option>
                        <option value="hotel">🏨 住宿</option>
                        <option value="airport">✈️ 機場</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-deep block mb-1.5">地點名稱</label>
                    <input
                      type="text"
                      value={editingEvent.name || ''}
                      onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                      className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-sm text-ink"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-deep block mb-1.5">💰 花費金額 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingEvent.cost ?? 0}
                    onChange={e => setEditingEvent({ ...editingEvent, cost: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1.5">💳 誰先付錢</label>
                  <select
                    value={editingEvent.payer || membersList[0]}
                    onChange={e => setEditingEvent({ ...editingEvent, payer: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  >
                    {membersList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-deep block mb-1.5">📝 備註說明（字越多框會自動加大）</label>
                <textarea
                  rows={Math.max(3, (editingEvent.note || '').split('\n').length + Math.ceil((editingEvent.note || '').length / 26))}
                  value={editingEvent.note || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, note: e.target.value })}
                  placeholder="輸入必點美食、預約代號、注意事項..."
                  className="w-full bg-paper border border-line rounded-xl p-3.5 text-ink leading-relaxed resize-y"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  className="px-3.5 py-2.5 rounded-xl font-bold bg-red-50 text-red-600 hover:bg-red-100"
                >
                  🗑️ 刪除此項目
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="px-3.5 py-2.5 rounded-xl font-bold text-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2.5 rounded-xl font-bold bg-deep hover:bg-accent text-white shadow disabled:opacity-50"
                  >
                    {isSavingEdit ? '儲存中...' : '儲存變更'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 3：編輯景點與景點間的交通方式與花費
         ========================================================================== */}
      {editingTransitEv && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveTransit}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-accent text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">🚕 編輯景點間交通方式與花費</h3>
              <button type="button" onClick={() => setEditingTransitEv(null)} className="text-white/80 hover:text-white text-lg">✕</button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-deep block mb-1.5">選擇交通方式</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TRANSIT_META).map(([k, meta]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setEditingTransitEv({ ...editingTransitEv, mode: k })}
                      className={`py-2.5 px-3 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                        editingTransitEv.mode === k
                          ? 'bg-soft border-accent text-deep ring-2 ring-accent/20'
                          : 'bg-paper border-line text-muted'
                      }`}
                    >
                      <span className="text-base">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-deep block mb-1.5">移動時間 / 距離</label>
                  <input
                    type="text"
                    placeholder="例如：車程約 20 分鐘"
                    value={editingTransitEv.duration || ''}
                    onChange={e => setEditingTransitEv({ ...editingTransitEv, duration: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1.5">💰 交通車資 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingTransitEv.cost ?? 0}
                    onChange={e => setEditingTransitEv({ ...editingTransitEv, cost: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-amber-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-deep block mb-1.5">交通備註（選填）</label>
                <input
                  type="text"
                  placeholder="例如：用 Grab 叫車、出站走 3 號出口"
                  value={editingTransitEv.note || ''}
                  onChange={e => setEditingTransitEv({ ...editingTransitEv, note: e.target.value })}
                  className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTransitEv(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-accent hover:bg-deep text-white shadow"
                >
                  儲存交通設定
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 4：右上角鉛筆（修改旅程標題、出發日期、天數、當日副標題與旅伴名單）
         ========================================================================== */}
      {showTitleModal && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleSaveTitleModal}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-deep text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">✎ 修改行程主題、日期與旅伴</h3>
              <button type="button" onClick={() => setShowTitleModal(false)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-deep block mb-1.5">旅程總標題 *</label>
                <input
                  type="text"
                  value={editMainTitle}
                  onChange={e => setEditMainTitle(e.target.value)}
                  className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 text-sm font-bold text-ink"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-deep block mb-1.5">出發日期</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1.5">總天數</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={editTotalDays}
                    onChange={e => setEditTotalDays(e.target.value)}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-deep block mb-1.5">D-{currentDay} 當日副標題 / 主題</label>
                <input
                  type="text"
                  placeholder="例如：Day 1 河內好久不見"
                  value={editDaySubtitle}
                  onChange={e => setEditDaySubtitle(e.target.value)}
                  className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                />
              </div>
              <div>
                <label className="font-bold text-deep block mb-1.5">👥 同行旅伴名單（一行一位，用於帳單分攤）</label>
                <textarea
                  rows="3"
                  value={editMembersText}
                  onChange={e => setEditMembersText(e.target.value)}
                  placeholder="娜娜&#10;旅伴A"
                  className="w-full bg-paper border border-line rounded-xl p-3 font-bold text-ink"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTitleModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-muted">取消</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold bg-deep text-white shadow">儲存設定</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 5：新增額外開銷（旅行帳單專用）
         ========================================================================== */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleAddExtraExpense}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-deep text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">💰 新增額外開銷 (不在時間軸的花費)</h3>
              <button type="button" onClick={() => setShowAddExpenseModal(false)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-deep block mb-1.5">開銷項目名稱 *</label>
                <input
                  type="text"
                  placeholder="例如：伴手禮腰果、簽證費、網卡、按摩小費..."
                  value={expForm.title}
                  onChange={e => setExpForm({ ...expForm, title: e.target.value })}
                  className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-sm text-ink"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-deep block mb-1.5">金額 *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={expForm.amount}
                    onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-amber-800"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1.5">幣別 (自動換算台幣)</label>
                  <select
                    value={expForm.currency}
                    onChange={e => setExpForm({ ...expForm, currency: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  >
                    <option value="TWD">TWD 台幣 (1:1)</option>
                    <option value="VND">VND 越南盾 (×0.0013)</option>
                    <option value="JPY">JPY 日圓 (×0.215)</option>
                    <option value="USD">USD 美金 (×32.1)</option>
                    <option value="KRW">KRW 韓元 (×0.024)</option>
                    <option value="EUR">EUR 歐元 (×35)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="font-bold text-deep block mb-1.5">💳 誰先付錢</label>
                  <select
                    value={expForm.payer}
                    onChange={e => setExpForm({ ...expForm, payer: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  >
                    {membersList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1.5">分類</label>
                  <select
                    value={expForm.category}
                    onChange={e => setExpForm({ ...expForm, category: e.target.value })}
                    className="w-full h-11 bg-paper border border-line rounded-xl px-3.5 font-bold text-ink"
                  >
                    <option value="餐飲/點心">🍽️ 餐飲/點心</option>
                    <option value="購物/伴手禮">🛍️ 購物/伴手禮</option>
                    <option value="網卡/簽證">🛂 網卡/簽證</option>
                    <option value="門票/按摩">💆‍♀️ 門票/按摩</option>
                    <option value="其他開銷">✨ 其他開銷</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-bold text-deep block mb-1.5">👥 參與分攤的旅伴（預設全選平分）</label>
                <div className="flex flex-wrap gap-2">
                  {membersList.map(m => {
                    const checked = expForm.splitAmong.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const next = checked
                            ? expForm.splitAmong.filter(x => x !== m)
                            : [...expForm.splitAmong, m];
                          setExpForm({ ...expForm, splitAmong: next.length ? next : [m] });
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold border transition-colors ${
                          checked ? 'bg-deep text-white border-deep' : 'bg-paper text-muted border-line'
                        }`}
                      >
                        {checked ? '✓ ' : ''}{m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddExpenseModal(false)} className="px-4 py-2.5 rounded-xl font-bold text-muted">取消</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl font-bold bg-accent text-white shadow">＋ 儲存這筆帳單</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 6：右上角紙飛機（一鍵匯出漂亮行程表）
         ========================================================================== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-deep/75 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
          <div className="bg-paper rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-line">
            <div className="no-print bg-deep text-white px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#e3c38f] font-bold block">ITINERARY EXPORT STUDIO</span>
                <h3 className="font-serif font-bold text-sm sm:text-base">✨ 一鍵匯出漂亮行程表</h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  disabled={isExportingImg}
                  className="bg-accent hover:opacity-95 text-white text-xs font-bold px-3 py-2 rounded-xl shadow"
                >
                  {isExportingImg ? '產生中...' : '📸 下載長圖'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-[#e3c38f] hover:opacity-95 text-deep text-xs font-bold px-3 py-2 rounded-xl shadow"
                >
                  🖨️ 存成 PDF
                </button>
                <button
                  type="button"
                  onClick={handleCopyLineText}
                  className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/20"
                >
                  💬 複製 LINE 文字
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="text-white/70 hover:text-white text-lg px-1.5"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="no-print bg-white px-4 sm:px-5 py-2.5 border-b border-line flex flex-wrap items-center gap-3 text-xs font-bold text-ink shrink-0">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="expScope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                />
                全部天數 (D-1~D-{totalDays})
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="expScope"
                  checked={exportScope === 'day'}
                  onChange={() => setExportScope('day')}
                />
                僅當天 (D-{currentDay})
              </label>
              <span className="text-line">|</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportShowCost}
                  onChange={e => setExportShowCost(e.target.checked)}
                />
                💰 花費
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportShowNote}
                  onChange={e => setExportShowNote(e.target.checked)}
                />
                📝 備註
              </label>
            </div>

            <div className="p-3 sm:p-8 overflow-y-auto flex-1 bg-[#e5ece8]">
              <div
                id="tw-printable-area"
                ref={exportCardRef}
                className="bg-white rounded-3xl overflow-hidden shadow-xl border border-line max-w-2xl mx-auto"
              >
                <div className="bg-gradient-to-br from-deep via-[#153d43] to-accent text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#e3c38f] font-extrabold">
                      NANA'S TRAVEL HANDBOOK
                    </p>
                    <h2 className="text-xl sm:text-3xl font-serif font-bold mt-1 break-words">{trip.title}</h2>
                    <p className="text-xs text-[#cde4d7] mt-1.5">
                      📅 出發日期：{trip.start} · 共 {totalDays} 天 · 👥 旅伴：{membersList.join('、')}
                    </p>
                  </div>
                  {exportShowCost && (
                    <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 sm:text-right shrink-0">
                      <span className="text-[10px] text-[#cde4d7] block font-bold">旅程總預算 (含帳單開銷)</span>
                      <strong className="text-xl font-extrabold text-[#e3c38f]">
                        NT$ {(exportScope === 'all' ? billSummary.totalTwd : calcDayTotalCost(currentDay)).toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="p-5 sm:p-8 space-y-8">
                  {(exportScope === 'all' ? dayNumbers : [currentDay]).map(dNum => {
                    const evs = getEventsForDay(dNum);
                    const dSub = (trip.dayTitles && trip.dayTitles[dNum]) || `Day ${dNum} 精彩行程`;
                    return (
                      <div key={dNum} className="space-y-3">
                        <div className="flex items-center justify-between border-b-2 border-deep pb-2 gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="bg-deep text-[#e3c38f] text-xs font-extrabold px-2.5 py-1 rounded-xl">
                              DAY {dNum}
                            </span>
                            <strong className="text-sm sm:text-base font-serif font-bold text-deep">
                              {formatDayDateLabel(trip.start, dNum)} · {dSub}
                            </strong>
                          </div>
                          {exportShowCost && (
                            <span className="text-xs font-extrabold text-accent">
                              小計 NT$ {calcDayTotalCost(dNum).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {evs.length === 0 ? (
                          <p className="text-xs text-muted py-2">尚無排程項目</p>
                        ) : (
                          <div className="space-y-2 pt-1">
                            {evs.map((ev, idx) => {
                              const isLast = idx === evs.length - 1;
                              const p = placeMap[ev.placeId] || {};
                              const name = ev.name || p.name || '未命名地點';
                              const cat = CATEGORY_META[ev.category || p.category] || CATEGORY_META.spot;
                              const note = ev.note ?? p.note ?? '';
                              const cost = Number(ev.cost ?? p.cost ?? 0);
                              const tr = ev.transitToNext;

                              return (
                                <React.Fragment key={ev.id}>
                                  {ev.kind === 'flight' ? (
                                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-extrabold text-sky-900 break-words">
                                          ✈️ {ev.depTime} 起飛 ({ev.fromAirport}) ➔ {ev.arrTime} 降落 ({ev.toAirport})
                                          {ev.flightCode && <span className="ml-1 text-sky-700">[{ev.flightCode}]</span>}
                                        </div>
                                        {exportShowNote && note && (
                                          <p className="text-[11px] text-sky-800 mt-1 whitespace-pre-wrap break-words">📝 {note}</p>
                                        )}
                                      </div>
                                      {exportShowCost && cost > 0 && (
                                        <span className="text-xs font-extrabold text-amber-800 shrink-0">
                                          NT$ {cost.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="bg-paper/70 border border-line rounded-2xl p-3.5 flex items-start justify-between gap-3">
                                      <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-extrabold text-accent">{ev.time || '--:--'}</span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.badgeCls}`}>
                                            {cat.icon} {cat.label}
                                          </span>
                                          <strong className="text-sm font-bold text-deep break-words">{name}</strong>
                                        </div>
                                        {exportShowNote && note && (
                                          <p className="text-[11px] text-muted whitespace-pre-wrap break-words leading-relaxed pt-0.5">
                                            📝 {note}
                                          </p>
                                        )}
                                      </div>
                                      {exportShowCost && cost > 0 && (
                                        <span className="text-xs font-extrabold text-amber-800 shrink-0">
                                          NT$ {cost.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {!isLast && tr && (
                                    <div className="pl-6 text-[11px] font-bold text-muted flex flex-wrap items-center gap-1.5">
                                      <span>⇣ {(TRANSIT_META[tr.mode] || TRANSIT_META.taxi).icon} {(TRANSIT_META[tr.mode] || TRANSIT_META.taxi).label}</span>
                                      <span>· {tr.duration || ''}</span>
                                      {exportShowCost && Number(tr.cost) > 0 && (
                                        <span className="text-amber-700">· 車資 NT$ {Number(tr.cost).toLocaleString()}</span>
                                      )}
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="bg-paper px-8 py-4 border-t border-line text-center text-[11px] text-muted font-semibold">
                  Created with Nana's Life & Travel Journal ✧
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
