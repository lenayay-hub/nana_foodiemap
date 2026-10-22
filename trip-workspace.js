/* ==========================================================================
   檔案名稱：trip-workspace.js (React 18 行程工作台完整升級版)
   包含功能：
   1. 頂部旅程大標題、出發日期、當日主題自訂編輯 (✎) + D-1 / D-2 天數切換與新增天數
   2. 時間軸行程卡片：
      - 支援 4 大分類標籤：📸 景點、🍽️ 餐廳、🏨 住宿、✈️ 機場
      - 支援「✈️ 航班起飛 / 降落資訊卡」(如 14:00-16:00 小港機場 ➔ 內排機場)
      - 景點旁有小鉛筆「✎ 編輯」(修改時間、分類、備註、花費) 與「🗑️ 刪除」
      - 直接點擊畫面上景點名稱 ➔ 立即跳轉至「⭐ 收藏」分頁並定位該景點
   3. 景點與景點間的交通小圖示：可點擊編輯計程車 🚕、走路 🚶、大眾運輸 🚌、機車 🛵 與車資花費
   4. 時間軸底部固定顯示大圓形「＋」號按鈕：
      - 點開可選擇：【🔍 在 Google 尋找新景點】、【⭐ 加入我收藏的景點】、【✈️ 插入航班資訊】
   5. 最底部預備「🗺️ 當天的 Google 路線圖」(Leaflet 路線標記 + 一鍵開啟 Google Maps 多點導航)
   6. 右上角「✨ 一鍵匯出漂亮行程表」(支援下載高畫質 PNG 長圖、列印精美 PDF、複製 LINE 文字版)
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

// 常見機場與熱門座標快速字典（當使用者從 Google 搜尋輸入時可自動賦予精準地圖座標）
const QUICK_GEO_DICT = [
  { kw: '小港', lat: 22.5771, lng: 120.3498, cat: 'airport', addr: '高雄市小港區中山四路2號' },
  { kw: '桃園國際機場', lat: 25.0797, lng: 121.2342, cat: 'airport', addr: '桃園市大園區航站南路9號' },
  { kw: '內排', lat: 21.2187, lng: 105.8042, cat: 'airport', addr: 'Phú Minh, Sóc Sơn, Hà Nội, Vietnam' },
  { kw: '成田', lat: 35.7720, lng: 140.3929, cat: 'airport', addr: 'Narita, Chiba, Japan' },
  { kw: '羽田', lat: 35.5494, lng: 139.7798, cat: 'airport', addr: 'Ota City, Tokyo, Japan' },
  { kw: '還劍湖', lat: 21.0287, lng: 105.8523, cat: 'spot', addr: 'Hoàn Kiếm, Hà Nội, Vietnam' },
  { kw: '河內大教堂', lat: 21.0288, lng: 105.8489, cat: 'spot', addr: '40 Nhà Chung, Hoàn Kiếm, Hà Nội' },
  { kw: '樂天', lat: 21.0322, lng: 105.8126, cat: 'hotel', addr: '54 Liễu Giai, Ba Đình, Hà Nội' },
  { kw: '4P', lat: 21.0245, lng: 105.8562, cat: 'food', addr: '43 Tràng Tiền, Hoàn Kiếm, Hà Nội' }
];

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

  // 彈出視窗控制狀態
  const [showAddHubModal, setShowAddHubModal] = useState(false);
  const [addHubTab, setAddHubTab] = useState('google'); // 'google' | 'saved' | 'flight'

  // 1) Google 搜尋新增表單狀態
  const [gTime, setGTime] = useState('12:00');
  const [gCat, setGCat] = useState('spot');
  const [gName, setGName] = useState('');
  const [gAddr, setGAddr] = useState('');
  const [gCost, setGCost] = useState('');
  const [gNote, setGNote] = useState('');

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
  const [flNote, setFlNote] = useState('');

  // 小鉛筆編輯單一項目視窗狀態
  const [editingEvent, setEditingEvent] = useState(null);

  // 編輯景點間交通方式視窗狀態
  const [editingTransitEv, setEditingTransitEv] = useState(null);

  // 自訂旅程標題與當日副標題視窗狀態
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [editMainTitle, setEditMainTitle] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editDaySubtitle, setEditDaySubtitle] = useState('');

  // ✨ 匯出漂亮行程表視窗狀態
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState('all'); // 'all' | 'day'
  const [exportShowCost, setExportShowCost] = useState(true);
  const [exportShowNote, setExportShowNote] = useState(true);
  const [isExportingImg, setIsExportingImg] = useState(false);

  // Leaflet 地圖 Ref
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

  const currentDaySubtitle = (trip?.dayTitles && trip.dayTitles[currentDay]) || `Day ${currentDay} 探索行程`;

  // 注入列印專用樣式，確保匯出 PDF 時版面乾淨漂亮
  useEffect(() => {
    if (!document.getElementById('tw-print-style')) {
      const st = document.createElement('style');
      st.id = 'tw-print-style';
      st.innerHTML = `
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

  // 當日 Google 路線圖渲染 (Leaflet + OpenStreetMap)
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapContainerRef.current).setView([22.6273, 120.3014], 12);
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

      // 若該景點尚無精準座標，嘗試從快速字典或預設偏移產生示意點位，確保地圖一定看得到路線
      if (!lat || !lng) {
        const matchedGeo = QUICK_GEO_DICT.find(g => name.includes(g.kw));
        if (matchedGeo) {
          lat = matchedGeo.lat;
          lng = matchedGeo.lng;
        } else {
          lat = 22.6273 + stopIndex * 0.008;
          lng = 120.3014 + stopIndex * 0.008;
        }
      }

      stopIndex += 1;
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
    });

    if (pts.length >= 2) {
      const latlngs = pts.map(p => [p.lat, p.lng]);
      window.L.polyline(latlngs, { color: '#167568', weight: 4, dashArray: '7, 7' }).addTo(map);
    }

    if (pts.length > 0) {
      const bounds = pts.map(p => [p.lat, p.lng]);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
    setTimeout(() => map.invalidateSize(), 150);
  }, [currentDayEvents, placeMap, currentDay]);

  // 產生當天 Google Maps 一鍵多點導航網址
  const googleMapsDayRouteUrl = useMemo(() => {
    const placeNames = currentDayEvents
      .filter(ev => ev.kind !== 'flight')
      .map(ev => ev.name || placeMap[ev.placeId]?.name)
      .filter(Boolean);

    if (placeNames.length >= 2) {
      const origin = encodeURIComponent(placeNames[0]);
      const destination = encodeURIComponent(placeNames[placeNames.length - 1]);
      const waypoints = placeNames.slice(1, -1).map(n => encodeURIComponent(n)).join('|');
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
    }
    if (placeNames.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeNames[0])}`;
    }
    return 'https://www.google.com/maps';
  }, [currentDayEvents, placeMap]);

  // ==================== 互動操作函式 ====================

  // 切換天數
  const handleSelectDay = (d) => {
    setCurrentDay(d);
  };

  // 新增一天 (D+1)
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

  // 打開自訂標題視窗
  const handleOpenTitleModal = () => {
    setEditMainTitle(trip.title || '');
    setEditStartDate(trip.start || '');
    setEditDaySubtitle(currentDaySubtitle);
    setShowTitleModal(true);
  };

  // 儲存自訂標題與當日主題
  const handleSaveTitleModal = (e) => {
    e.preventDefault();
    if (!editMainTitle.trim()) return;
    const nextDayTitles = { ...(trip.dayTitles || {}), [currentDay]: editDaySubtitle.trim() || `Day ${currentDay} 探索行程` };
    onUpdateTrip({
      ...trip,
      title: editMainTitle.trim(),
      start: editStartDate,
      dayTitles: nextDayTitles
    });
    setShowTitleModal(false);
    if (showToast) showToast('✅ 旅程標題與當日主題已更新！');
  };

  // 1) 從「🔍 Google 搜尋」新增景點進時間軸
  const handleAddGooglePlace = (e) => {
    e.preventDefault();
    if (!gName.trim()) {
      if (showToast) showToast('請輸入要加入的景點、餐廳、飯店或機場名稱');
      return;
    }
    const cleanName = gName.trim();
    const matchedGeo = QUICK_GEO_DICT.find(g => cleanName.includes(g.kw));
    const matchedSaved = allSavedPlaces.find(p => p.name.toLowerCase() === cleanName.toLowerCase());
    const savedCoords = matchedSaved ? window.parseCoordsFromUrl(matchedSaved.mapUrl) : {};

    const pid = 'p_' + Date.now();
    const newPlace = {
      id: pid,
      savedUid: matchedSaved ? matchedSaved.uid : '',
      name: cleanName,
      category: gCat,
      city: matchedSaved?.city || '',
      address: gAddr.trim() || matchedSaved?.address || matchedGeo?.addr || '',
      url: matchedSaved?.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanName)}`,
      note: gNote.trim() || matchedSaved?.combinedNote || '',
      cost: Number(gCost) || 0,
      lat: savedCoords.lat || matchedGeo?.lat || null,
      lng: savedCoords.lng || matchedGeo?.lng || null
    };

    const newEv = {
      id: 'ev_' + Date.now(),
      kind: 'place',
      placeId: pid,
      name: cleanName,
      day: currentDay,
      time: gTime || '12:00',
      category: gCat,
      address: newPlace.address,
      note: newPlace.note,
      cost: Number(gCost) || 0,
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
    setShowAddHubModal(false);
    if (showToast) showToast(`📍 已將「${cleanName}」排入 D-${currentDay}！`);
  };

  // 2) 從「⭐ 娜娜的收藏庫」挑選加入時間軸
  const handlePickSavedPlace = (colItem) => {
    const coords = window.parseCoordsFromUrl(colItem.mapUrl);
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
      lat: coords.lat,
      lng: coords.lng
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
      cost: ev.cost ?? p.cost ?? 0
    });
  };

  // 小鉛筆：儲存景點/航班修改
  const handleSaveEditEvent = (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    const nextEvents = (trip.events || []).map(ev => {
      if (ev.id !== editingEvent.id) return ev;
      return {
        ...ev,
        ...editingEvent,
        cost: Number(editingEvent.cost) || 0
      };
    });

    const nextPlaces = (trip.places || []).map(p => {
      if (p.id !== editingEvent.placeId) return p;
      return {
        ...p,
        name: editingEvent.name,
        category: editingEvent.category,
        address: editingEvent.address,
        note: editingEvent.note,
        cost: Number(editingEvent.cost) || 0
      };
    });

    onUpdateTrip({
      ...trip,
      places: nextPlaces,
      events: nextEvents
    });

    setEditingEvent(null);
    if (showToast) showToast('✅ 景點資訊、備註與花費已更新！');
  };

  // 刪除單筆行程項目
  const handleDeleteEvent = (evId) => {
    const nextEvents = (trip.events || []).filter(ev => ev.id !== evId);
    onUpdateTrip({
      ...trip,
      events: nextEvents
    });
    setEditingEvent(null);
    if (showToast) showToast('🗑️ 已從時間軸移除該項目');
  };

  // 儲存兩景點間的交通方式與車資
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
      if (showToast) showToast('匯出圖片失敗，建議使用旁邊的「列印 / 存成 PDF」');
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

  // Google 搜尋輸入時的即時建議清單（結合收藏庫與熱門機場/地標）
  const googleSearchSuggestions = useMemo(() => {
    const kw = gName.trim().toLowerCase();
    if (!kw) return [];
    const fromSaved = allSavedPlaces
      .filter(p => `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(kw))
      .slice(0, 5)
      .map(p => ({
        name: p.name,
        address: p.address || p.city || '',
        cat: p.sourceTab === 'food' ? 'food' : 'spot',
        note: p.combinedNote || '',
        source: '⭐ 你的收藏庫'
      }));
    const fromDict = QUICK_GEO_DICT
      .filter(g => g.kw.toLowerCase().includes(kw) || g.addr.toLowerCase().includes(kw))
      .map(g => ({
        name: g.kw.includes('機場') ? g.kw : `${g.kw}`,
        address: g.addr,
        cat: g.cat,
        note: '',
        source: '🌐 Google 地標'
      }));
    return [...fromSaved, ...fromDict].slice(0, 6);
  }, [gName, allSavedPlaces]);

  return (
    <div className="space-y-6 pb-12">
      {/* 頂部返回與快速操作列 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-deep bg-white hover:bg-soft px-3.5 py-2 rounded-xl border border-line shadow-sm transition-colors"
        >
          ← 返回行程列表
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenTitleModal}
            className="text-xs font-bold bg-white hover:bg-soft text-deep px-3.5 py-2 rounded-xl border border-line shadow-sm transition-colors"
          >
            ✎ 修改標題與日期
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="text-xs font-bold bg-[#e3c38f] hover:opacity-95 text-deep px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all"
          >
            ✨ 一鍵匯出漂亮行程表
          </button>
        </div>
      </div>

      {/* 深林綠旅程主視覺橫幅 (可點擊自訂標題) */}
      <div className="bg-gradient-to-br from-deep via-[#153d43] to-accent text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold tracking-wider uppercase px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[#e3c38f]">
                DAY {currentDay} · {formatDayDateLabel(trip.start, currentDay)}
              </span>
              <button
                onClick={handleOpenTitleModal}
                className="text-[11px] font-bold text-white/80 hover:text-white underline"
              >
                ✎ 點此自訂標題
              </button>
            </div>
            <h1
              onClick={handleOpenTitleModal}
              className="text-2xl sm:text-3xl font-serif font-bold tracking-tight cursor-pointer hover:text-[#e3c38f] transition-colors"
              title="點擊修改旅程名稱"
            >
              {trip.title}
            </h1>
            <p
              onClick={handleOpenTitleModal}
              className="text-xs sm:text-sm text-[#cde4d7] font-medium cursor-pointer"
            >
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

      {/* D-1 / D-2 / D-3 天數切換列 */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {dayNumbers.map(dNum => {
            const isActive = dNum === currentDay;
            const count = getEventsForDay(dNum).length;
            return (
              <button
                key={dNum}
                onClick={() => handleSelectDay(dNum)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all flex items-center gap-2 shrink-0 border ${
                  isActive
                    ? 'bg-deep text-white border-deep shadow-md scale-[1.02]'
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
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-soft hover:bg-accent hover:text-white text-accent border border-dashed border-accent transition-colors shrink-0"
          >
            ＋ 加一天
          </button>
        </div>
      </div>

      {/* ==================== 行程時間軸主體 ==================== */}
      <div className="relative pt-2 pb-4">
        {/* 時間軸垂直導線 */}
        <div className="absolute left-[74px] sm:left-[92px] top-6 bottom-16 w-[3px] bg-gradient-to-b from-accent via-line to-accent rounded-full pointer-events-none" />

        {currentDayEvents.length === 0 ? (
          <div className="editorial-card p-10 text-center space-y-2 border-dashed border-2 border-line relative z-10">
            <div className="text-3xl">🌿</div>
            <p className="text-sm font-bold text-deep">D-{currentDay} 目前還沒有排入行程</p>
            <p className="text-xs text-muted">
              點擊下方的大圓形「＋」號，即可從 Google 搜尋新景點、從收藏庫挑選、或插入起飛降落航班！
            </p>
          </div>
        ) : (
          <div className="space-y-3 relative z-10">
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
                  {/* 情況 A：✈️ 航班起飛 / 降落資訊卡 */}
                  {ev.kind === 'flight' ? (
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* 左側起降時間欄 */}
                      <div className="w-16 sm:w-20 text-right pt-3 shrink-0">
                        <div className="text-xs sm:text-sm font-extrabold text-sky-800">{ev.depTime || '14:00'}</div>
                        <div className="text-[10px] font-bold text-sky-500 leading-tight">｜</div>
                        <div className="text-xs sm:text-sm font-extrabold text-sky-800">{ev.arrTime || '16:00'}</div>
                      </div>

                      {/* 時間軸節點 */}
                      <div className="w-4 h-4 rounded-full bg-sky-600 border-4 border-white shadow ring-2 ring-sky-500 mt-5 shrink-0" />

                      {/* 航班卡片本體 */}
                      <div className="flex-1 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-3xl p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-600 text-white">
                              ✈️ 航班起飛 / 降落
                            </span>
                            <strong className="text-xs sm:text-sm font-extrabold text-sky-950">
                              {ev.flightCode || '航班資訊'}
                            </strong>
                            {itemCost > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                💰 NT$ {itemCost.toLocaleString()}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(ev)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-sky-100 text-sky-900 border border-sky-200 transition-colors"
                              title="編輯航班"
                            >
                              ✎ 編輯
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 transition-colors"
                              title="刪除航班"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 items-center bg-white/90 rounded-2xl p-3.5 border border-sky-100">
                          <div>
                            <span className="text-[10px] font-extrabold text-sky-600 uppercase block">🛫 起飛 DEPART</span>
                            <strong className="text-base sm:text-xl font-extrabold text-deep">{ev.depTime}</strong>
                            <span className="block text-xs font-bold text-ink mt-0.5">{ev.fromAirport}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-lg sm:text-2xl">✈️</span>
                            <span className="block text-[10px] text-muted font-bold">直飛航段</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold text-sky-600 uppercase block">🛬 降落 ARRIVE</span>
                            <strong className="text-base sm:text-xl font-extrabold text-deep">{ev.arrTime}</strong>
                            <span className="block text-xs font-bold text-ink mt-0.5">{ev.toAirport}</span>
                          </div>
                        </div>

                        {itemNote && (
                          <div className="mt-2.5 text-xs text-sky-900 bg-white/70 px-3 py-2 rounded-xl border border-sky-100">
                            📝 備註：{itemNote}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* 情況 B：一般景點 / 餐廳 / 住宿 / 機場卡片 */
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* 左側時間與分類 */}
                      <div className="w-16 sm:w-20 text-right pt-3.5 shrink-0">
                        <div className="text-sm sm:text-base font-extrabold text-deep">{ev.time || '--:--'}</div>
                        <div className="text-[10px] font-bold text-muted">{catMeta.label}</div>
                      </div>

                      {/* 時間軸節點 */}
                      <div className="w-4 h-4 rounded-full bg-accent border-4 border-white shadow ring-2 ring-accent mt-5 shrink-0" />

                      {/* 景點卡片本體 */}
                      <div className="flex-1 editorial-card p-4 sm:p-5 hover:border-accent transition-all">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${catMeta.badgeCls}`}>
                                {catMeta.icon} {catMeta.label}
                              </span>
                              {itemCost > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  💰 花費：NT$ {itemCost.toLocaleString()}
                                </span>
                              )}
                              <button
                                onClick={() => onJumpToSaved && onJumpToSaved(itemName, savedUid)}
                                className="text-[11px] font-bold text-accent hover:underline inline-flex items-center gap-0.5"
                                title="點擊直接跳轉到收藏庫查看該景點"
                              >
                                ⭐ 點擊跳轉收藏頁 ↗
                              </button>
                            </div>

                            {/* 直接點在畫面上景點名稱 ➔ 跳轉到收藏該景點頁面 */}
                            <h3
                              onClick={() => onJumpToSaved && onJumpToSaved(itemName, savedUid)}
                              className="text-base sm:text-lg font-extrabold text-deep hover:text-accent cursor-pointer transition-colors"
                              title="點擊直接跳轉至收藏該景點頁面"
                            >
                              {itemName}
                            </h3>

                            {itemAddress && (
                              <p className="text-xs text-muted mt-0.5 truncate">
                                📍 {itemAddress}
                              </p>
                            )}
                          </div>

                          {/* 右側小鉛筆編輯 & 刪除按鈕 */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleOpenEditModal(ev)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-paper hover:bg-soft text-deep border border-line transition-colors flex items-center gap-1"
                              title="編輯分類、備註與花費"
                            >
                              ✎ 編輯
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-paper hover:bg-red-50 text-red-600 border border-line transition-colors"
                              title="刪除此景點"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* 備註列（點擊可直接開啟小鉛筆編輯） */}
                        <div
                          onClick={() => handleOpenEditModal(ev)}
                          className="mt-3 px-3.5 py-2.5 rounded-2xl bg-paper/80 hover:bg-soft/60 border border-line text-xs text-ink cursor-pointer flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="truncate">
                            <strong className="text-accent">📝 備註：</strong>
                            {itemNote ? (
                              <span>{itemNote}</span>
                            ) : (
                              <span className="text-muted">點擊小鉛筆新增必點招牌、門票或花費備註...</span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-accent shrink-0">✎ 修改</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 景點與景點之間的「🚕 交通方式與車資」小圖示連接器 */}
                  {!isLast && (
                    <div className="pl-20 sm:pl-28 py-0.5">
                      <button
                        onClick={() => setEditingTransitEv({
                          id: ev.id,
                          mode: tr.mode || 'taxi',
                          duration: tr.duration || '車程約 15 分鐘',
                          cost: tr.cost || 0,
                          note: tr.note || ''
                        })}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-soft border border-dashed border-accent/60 text-xs font-bold text-ink shadow-sm transition-all"
                      >
                        <span>{trMeta.icon} {trMeta.label}</span>
                        <span className="text-muted">· {tr.duration || '設定時間'}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
                          💰 車資 NT$ {Number(tr.cost || 0).toLocaleString()}
                        </span>
                        {tr.note && <span className="text-muted font-normal">({tr.note})</span>}
                        <span className="text-accent underline text-[11px]">✎ 編輯交通</span>
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ==================== 時間軸底部：大圓形「＋」按鈕（不管有沒有行程都會顯示） ==================== */}
        <div className="mt-6 flex flex-col items-center justify-center relative z-10">
          <button
            onClick={() => {
              setAddHubTab('google');
              setShowAddHubModal(true);
            }}
            className="w-16 h-16 rounded-full bg-white hover:bg-accent text-accent hover:text-white border-2 border-dashed border-accent shadow-lg flex items-center justify-center text-3xl font-bold transition-all hover:scale-110 active:scale-95"
            title="點擊加入景點、收藏或航班"
          >
            ＋
          </button>
          <span
            onClick={() => {
              setAddHubTab('google');
              setShowAddHubModal(true);
            }}
            className="text-xs font-bold text-accent mt-2 cursor-pointer hover:underline"
          >
            點擊「＋」選擇：在 Google 搜尋景點 ／ 加入收藏的景點 ／ 插入航班
          </span>
        </div>
      </div>

      {/* ==================== 最底部：🗺️ 當天的 Google 路線圖 ==================== */}
      <div className="editorial-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🗺️</span>
              <h3 className="text-base font-serif font-bold text-deep">
                當天的 Google 路線圖 (D-{currentDay})
              </h3>
            </div>
            <p className="text-xs text-muted mt-0.5">
              自動依時間順序串聯 D-{currentDay} 所有地點，點擊右上角可直接在 Google Maps 開啟當天完整導航路線。
            </p>
          </div>

          <a
            href={googleMapsDayRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-deep hover:bg-accent text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition-colors self-start"
          >
            🧭 一鍵開啟 Google Maps 當天路線導航 ↗
          </a>
        </div>

        {/* 路線順序膠囊條 */}
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-paper border border-line font-bold text-deep">
                      <span className="w-4 h-4 rounded-full bg-deep text-white text-[10px] grid place-items-center">
                        {i + 1}
                      </span>
                      {name}
                    </span>
                    {i < arr.length - 1 && <span className="text-accent font-extrabold">➔</span>}
                  </React.Fragment>
                );
              })
          )}
        </div>

        {/* 地圖畫布 */}
        <div
          ref={mapContainerRef}
          className="w-full h-72 rounded-2xl border border-line overflow-hidden z-0"
        />
      </div>

      {/* ==========================================================================
          彈出視窗 1：點擊大「＋」號後的三合一選擇器 (Google 搜尋 / 從收藏加入 / 插入航班)
         ========================================================================== */}
      {showAddHubModal && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-line animate-fade-in">
            <div className="bg-deep text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">
                ➕ 新增行程至 D-{currentDay} ({formatDayDateLabel(trip.start, currentDay)})
              </h3>
              <button onClick={() => setShowAddHubModal(false)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>

            {/* 三大模式切換 Tab */}
            <div className="grid grid-cols-3 gap-1.5 p-2 bg-paper border-b border-line text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setAddHubTab('google')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'google' ? 'bg-deep text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                🔍 Google 搜尋景點
              </button>
              <button
                type="button"
                onClick={() => setAddHubTab('saved')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'saved' ? 'bg-deep text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                ⭐ 加入收藏的景點 ({allSavedPlaces.length})
              </button>
              <button
                type="button"
                onClick={() => setAddHubTab('flight')}
                className={`py-2.5 rounded-2xl transition-all ${addHubTab === 'flight' ? 'bg-sky-600 text-white shadow' : 'text-muted hover:text-deep'}`}
              >
                ✈️ 插入航班起降
              </button>
            </div>

            {/* 模式 A：自行尋找 Google 景點 */}
            {addHubTab === 'google' && (
              <form onSubmit={handleAddGooglePlace} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-deep block mb-1">預計時間 *</label>
                    <input
                      type="time"
                      value={gTime}
                      onChange={e => setGTime(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">選擇分類 (4種) *</label>
                    <select
                      value={gCat}
                      onChange={e => setGCat(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                    >
                      <option value="spot">📸 景點</option>
                      <option value="food">🍽️ 餐廳</option>
                      <option value="hotel">🏨 住宿</option>
                      <option value="airport">✈️ 機場</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-deep">輸入 Google 景點 / 餐廳 / 飯店 / 機場名稱 *</label>
                    {gName.trim() && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gName)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-accent hover:underline"
                      >
                        在 Google Maps 查看此地點 ↗
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="例如：小港機場、內排機場、河內樂天飯店、Pizza 4P's..."
                    value={gName}
                    onChange={e => setGName(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-sm font-bold text-ink"
                    required
                  />

                  {/* 自動建議下拉清單 */}
                  {googleSearchSuggestions.length > 0 && (
                    <div className="mt-1.5 border border-line rounded-2xl bg-white shadow-lg max-h-40 overflow-y-auto divide-y divide-line">
                      {googleSearchSuggestions.map((sug, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setGName(sug.name);
                            setGCat(sug.cat || 'spot');
                            if (sug.address) setGAddr(sug.address);
                            if (sug.note) setGNote(sug.note);
                          }}
                          className="px-3.5 py-2 hover:bg-soft cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <strong className="text-deep block">{sug.name}</strong>
                            <span className="text-[11px] text-muted">{sug.address}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-paper text-accent shrink-0">
                            {sug.source} · 點擊帶入
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-deep block mb-1">地址或位置（選填）</label>
                    <input
                      type="text"
                      placeholder="可留空或貼上地址"
                      value={gAddr}
                      onChange={e => setGAddr(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">💰 預估花費 (NT$)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={gCost}
                      onChange={e => setGCost(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-deep block mb-1">📝 備註（必點招牌、訂位時間、航廈資訊）</label>
                  <input
                    type="text"
                    placeholder="例如：提早2小時報到、已訂位 18:30..."
                    value={gNote}
                    onChange={e => setGNote(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
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
                    className="px-6 py-2.5 rounded-xl font-bold bg-accent hover:bg-deep text-white shadow transition-colors"
                  >
                    ＋ 加入 D-{currentDay} 行程
                  </button>
                </div>
              </form>
            )}

            {/* 模式 B：從「我收藏的景點」挑選加入 */}
            {addHubTab === 'saved' && (
              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="font-bold text-deep block mb-1">排入時間</label>
                    <input
                      type="time"
                      value={favTime}
                      onChange={e => setFavTime(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3 py-2 font-bold text-ink"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold text-deep block mb-1">搜尋你的收藏庫</label>
                    <input
                      type="text"
                      placeholder="🔍 輸入店名、城市或必點備註..."
                      value={favSearch}
                      onChange={e => setFavSearch(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {[['all', '全部'], ['food', '🍽️ 餐廳'], ['spot', '📸 景點']].map(([k, lb]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFavCatFilter(k)}
                      className={`px-3 py-1 rounded-xl font-bold ${favCatFilter === k ? 'bg-deep text-white' : 'bg-paper text-muted'}`}
                    >
                      {lb}
                    </button>
                  ))}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
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
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-line">
                              {item.sourceTab === 'food' ? '🍽️ 餐廳' : '📸 景點'}
                            </span>
                            <strong className="text-sm text-deep truncate">{item.name}</strong>
                            <span className="text-muted">({item.city || '未分類'})</span>
                          </div>
                          {item.combinedNote && (
                            <p className="text-[11px] text-muted truncate mt-1">{item.combinedNote}</p>
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

            {/* 模式 C：插入「✈️ 航班起飛 / 降落資訊」 */}
            {addHubTab === 'flight' && (
              <form onSubmit={handleAddFlightCard} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-deep block mb-1">🛫 起飛時間 *</label>
                    <input
                      type="time"
                      value={flDepTime}
                      onChange={e => setFlDepTime(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">🛬 降落時間 *</label>
                    <input
                      type="time"
                      value={flArrTime}
                      onChange={e => setFlArrTime(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-deep block mb-1">出發機場 *</label>
                    <input
                      type="text"
                      placeholder="例如：小港機場 (KHH)"
                      value={flFrom}
                      onChange={e => setFlFrom(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">降落機場 *</label>
                    <input
                      type="text"
                      placeholder="例如：內排機場 (HAN)"
                      value={flTo}
                      onChange={e => setFlTo(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-deep block mb-1">航班代號 / 航空公司</label>
                    <input
                      type="text"
                      placeholder="例如：VN587 越南航空"
                      value={flCode}
                      onChange={e => setFlCode(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">💰 機票花費 (NT$)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={flCost}
                      onChange={e => setFlCost(e.target.value)}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-deep block mb-1">📝 航班備註（航廈、免費託運額度等）</label>
                  <input
                    type="text"
                    placeholder="例如：T2 航廈報到、含 23kg 託運行李"
                    value={flNote}
                    onChange={e => setFlNote(e.target.value)}
                    className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
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
          彈出視窗 2：小鉛筆編輯景點 / 備註 / 花費 / 分類
         ========================================================================== */}
      {editingEvent && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditEvent}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-deep text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">✎ 編輯行程項目、備註與花費</h3>
              <button type="button" onClick={() => setEditingEvent(null)} className="text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {editingEvent.kind === 'flight' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-deep block mb-1">🛫 起飛時間</label>
                      <input
                        type="time"
                        value={editingEvent.depTime || '14:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, depTime: e.target.value, time: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1">🛬 降落時間</label>
                      <input
                        type="time"
                        value={editingEvent.arrTime || '16:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, arrTime: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-deep block mb-1">出發機場</label>
                      <input
                        type="text"
                        value={editingEvent.fromAirport || ''}
                        onChange={e => setEditingEvent({ ...editingEvent, fromAirport: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1">降落機場</label>
                      <input
                        type="text"
                        value={editingEvent.toAirport || ''}
                        onChange={e => setEditingEvent({ ...editingEvent, toAirport: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-deep block mb-1">航班代號</label>
                    <input
                      type="text"
                      value={editingEvent.flightCode || ''}
                      onChange={e => setEditingEvent({ ...editingEvent, flightCode: e.target.value })}
                      className="w-full bg-paper border border-line rounded-xl px-3 py-2"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-deep block mb-1">時間</label>
                      <input
                        type="time"
                        value={editingEvent.time || '12:00'}
                        onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-deep block mb-1">分類 (住宿/餐廳/景點/機場)</label>
                      <select
                        value={editingEvent.category || 'spot'}
                        onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2.5 font-bold"
                      >
                        <option value="spot">📸 景點</option>
                        <option value="food">🍽️ 餐廳</option>
                        <option value="hotel">🏨 住宿</option>
                        <option value="airport">✈️ 機場</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-deep block mb-1">地點名稱</label>
                    <input
                      type="text"
                      value={editingEvent.name || ''}
                      onChange={e => setEditingEvent({ ...editingEvent, name: e.target.value })}
                      className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="font-bold text-deep block mb-1">💰 花費金額 (NT$)</label>
                <input
                  type="number"
                  min="0"
                  value={editingEvent.cost ?? 0}
                  onChange={e => setEditingEvent({ ...editingEvent, cost: e.target.value })}
                  className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-amber-800"
                />
              </div>

              <div>
                <label className="font-bold text-deep block mb-1">📝 備註說明</label>
                <textarea
                  rows="3"
                  value={editingEvent.note || ''}
                  onChange={e => setEditingEvent({ ...editingEvent, note: e.target.value })}
                  placeholder="輸入必點美食、預約代號、注意事項..."
                  className="w-full bg-paper border border-line rounded-xl p-3 text-ink"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteEvent(editingEvent.id)}
                  className="px-3.5 py-2 rounded-xl font-bold bg-red-50 text-red-600 hover:bg-red-100"
                >
                  🗑️ 刪除此項目
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="px-4 py-2 rounded-xl font-bold text-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl font-bold bg-deep hover:bg-accent text-white shadow"
                  >
                    儲存變更
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
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTransit}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-accent text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">🚕 編輯景點間交通方式與花費</h3>
              <button type="button" onClick={() => setEditingTransitEv(null)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-deep block mb-1">移動時間 / 距離</label>
                  <input
                    type="text"
                    placeholder="例如：車程約 20 分鐘"
                    value={editingTransitEv.duration || ''}
                    onChange={e => setEditingTransitEv({ ...editingTransitEv, duration: e.target.value })}
                    className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                  />
                </div>
                <div>
                  <label className="font-bold text-deep block mb-1">💰 交通車資 (NT$)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingTransitEv.cost ?? 0}
                    onChange={e => setEditingTransitEv({ ...editingTransitEv, cost: e.target.value })}
                    className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-amber-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-deep block mb-1">交通備註（選填）</label>
                <input
                  type="text"
                  placeholder="例如：用 Grab 叫車、出站走 3 號出口"
                  value={editingTransitEv.note || ''}
                  onChange={e => setEditingTransitEv({ ...editingTransitEv, note: e.target.value })}
                  className="w-full bg-paper border border-line rounded-xl px-3.5 py-2 text-ink"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTransitEv(null)}
                  className="px-4 py-2 rounded-xl font-bold text-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-accent hover:bg-deep text-white shadow"
                >
                  儲存交通設定
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 4：自訂旅程標題、出發日期與當日副標題
         ========================================================================== */}
      {showTitleModal && (
        <div className="fixed inset-0 bg-deep/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTitleModal}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-fade-in"
          >
            <div className="bg-deep text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base">✎ 自訂旅程標題與當日主題</h3>
              <button type="button" onClick={() => setShowTitleModal(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-deep block mb-1">旅程總標題 *</label>
                <input
                  type="text"
                  value={editMainTitle}
                  onChange={e => setEditMainTitle(e.target.value)}
                  className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-sm font-bold text-ink"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-deep block mb-1">出發日期</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                />
              </div>
              <div>
                <label className="font-bold text-deep block mb-1">D-{currentDay} 當日副標題 / 主題</label>
                <input
                  type="text"
                  placeholder="例如：高雄小港出發 ➔ 抵達河內 & 還劍湖夜遊"
                  value={editDaySubtitle}
                  onChange={e => setEditDaySubtitle(e.target.value)}
                  className="w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 font-bold text-ink"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowTitleModal(false)} className="px-4 py-2 rounded-xl font-bold text-muted">取消</button>
                <button type="submit" className="px-5 py-2 rounded-xl font-bold bg-deep text-white shadow">儲存設定</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================================
          彈出視窗 5：✨ 一鍵匯出漂亮行程表 (旅遊手冊雜誌風)
         ========================================================================== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-deep/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-paper rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-line">
            {/* 頂部操作工具列 (列印時自動隱藏) */}
            <div className="no-print bg-deep text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] tracking-widest uppercase text-[#e3c38f] font-bold block">ITINERARY EXPORT STUDIO</span>
                <h3 className="font-serif font-bold text-base">✨ 一鍵匯出漂亮行程表</h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  disabled={isExportingImg}
                  className="bg-accent hover:opacity-95 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow"
                >
                  {isExportingImg ? '產生圖片中...' : '📸 下載高畫質長圖 (PNG)'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-[#e3c38f] hover:opacity-95 text-deep text-xs font-bold px-3.5 py-2 rounded-xl shadow"
                >
                  🖨️ 列印 / 存成精美 PDF
                </button>
                <button
                  type="button"
                  onClick={handleCopyLineText}
                  className="bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-white/20"
                >
                  💬 複製 LINE 文字版
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="text-white/70 hover:text-white text-lg px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 匯出範圍與顯示勾選列 */}
            <div className="no-print bg-white px-5 py-2.5 border-b border-line flex flex-wrap items-center gap-4 text-xs font-bold text-ink shrink-0">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="expScope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                />
                匯出全部天數 (D-1 ~ D-{totalDays})
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="expScope"
                  checked={exportScope === 'day'}
                  onChange={() => setExportScope('day')}
                />
                僅匯出目前天數 (D-{currentDay})
              </label>
              <span className="text-line">|</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportShowCost}
                  onChange={e => setExportShowCost(e.target.checked)}
                />
                💰 顯示花費明細
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportShowNote}
                  onChange={e => setExportShowNote(e.target.checked)}
                />
                📝 顯示備註
              </label>
            </div>

            {/* 預覽與實際匯出畫布 */}
            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-[#e5ece8]">
              <div
                id="tw-printable-area"
                ref={exportCardRef}
                className="bg-white rounded-3xl overflow-hidden shadow-xl border border-line max-w-2xl mx-auto"
              >
                {/* 手冊封面頭條 */}
                <div className="bg-gradient-to-br from-deep via-[#153d43] to-accent text-white p-7 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-[#e3c38f] font-extrabold">
                      NANA'S TRAVEL HANDBOOK
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold mt-1">{trip.title}</h2>
                    <p className="text-xs text-[#cde4d7] mt-1.5">
                      📅 出發日期：{trip.start} · 共 {totalDays} 天 · 👥 旅伴：{(trip.members || ['我']).join('、')}
                    </p>
                  </div>
                  {exportShowCost && (
                    <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2.5 sm:text-right">
                      <span className="text-[10px] text-[#cde4d7] block font-bold">預估行程總預算</span>
                      <strong className="text-xl font-extrabold text-[#e3c38f]">
                        NT$ {(exportScope === 'all' ? dayNumbers : [currentDay]).reduce((s, d) => s + calcDayTotalCost(d), 0).toLocaleString()}
                      </strong>
                    </div>
                  )}
                </div>

                {/* 各天行程內容 */}
                <div className="p-6 sm:p-8 space-y-8">
                  {(exportScope === 'all' ? dayNumbers : [currentDay]).map(dNum => {
                    const evs = getEventsForDay(dNum);
                    const dSub = (trip.dayTitles && trip.dayTitles[dNum]) || `Day ${dNum} 精彩行程`;
                    return (
                      <div key={dNum} className="space-y-3">
                        <div className="flex items-center justify-between border-b-2 border-deep pb-2">
                          <div className="flex items-center gap-2.5">
                            <span className="bg-deep text-[#e3c38f] text-xs font-extrabold px-3 py-1 rounded-xl">
                              DAY {dNum}
                            </span>
                            <strong className="text-base font-serif font-bold text-deep">
                              {formatDayDateLabel(trip.start, dNum)} · {dSub}
                            </strong>
                          </div>
                          {exportShowCost && (
                            <span className="text-xs font-extrabold text-accent">
                              當日小計 NT$ {calcDayTotalCost(dNum).toLocaleString()}
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
                                    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                                      <div>
                                        <div className="text-xs font-extrabold text-sky-900">
                                          ✈️ {ev.depTime} 起飛 ({ev.fromAirport}) ➔ {ev.arrTime} 降落 ({ev.toAirport})
                                          {ev.flightCode && <span className="ml-2 text-sky-700">[{ev.flightCode}]</span>}
                                        </div>
                                        {exportShowNote && note && (
                                          <p className="text-[11px] text-sky-800 mt-1">📝 {note}</p>
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
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-extrabold text-accent w-11">{ev.time || '--:--'}</span>
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.badgeCls}`}>
                                            {cat.icon} {cat.label}
                                          </span>
                                          <strong className="text-sm font-bold text-deep">{name}</strong>
                                        </div>
                                        {exportShowNote && note && (
                                          <p className="text-[11px] text-muted pl-13">📝 {note}</p>
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
                                    <div className="pl-12 text-[11px] font-bold text-muted flex items-center gap-1.5">
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
