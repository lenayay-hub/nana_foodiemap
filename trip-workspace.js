// ==========================================================================
// 檔案名稱：trip-workspace.js
// 功能：單一行程工作台 (每日時間軸、Leaflet路線地圖、班機交通、旅伴分帳、PDF匯出)
// ==========================================================================

const { useState, useEffect, useMemo, useRef } = React;

window.TripWorkspace = ({ trip, allSavedPlaces, onUpdateTrip, onBack, showToast }) => {
  const [subTab, setSubTab] = useState('plan');
  const [modalType, setModalType] = useState(null);
  const [selectedDay, setSelectedDay] = useState(trip.day || 1);
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersLayerRef = useRef(null);

  const [pickedPlaceIds, setPickedPlaceIds] = useState([]);
  const [scheduleTime, setScheduleTime] = useState('11:00');
  const [pickFilter, setPickFilter] = useState('');

  const [travelForm, setTravelForm] = useState({ kind: 'flight', day: 1, time: '09:00', arrive: '12:00', from: '', to: '', mode: '', duration: 60, amount: '', currency: 'TWD', payer: trip.members?.[0] || '我', note: '' });
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', currency: 'TWD', day: 1, payer: trip.members?.[0] || '我', split: trip.members || ['我'] });
  const [membersText, setMembersText] = useState((trip.members || ['我']).join('\n'));
  const [rateCurrency, setRateCurrency] = useState('JPY');
  const [rateVal, setRateVal] = useState(trip.rates?.JPY || 0.215);

  const dateOf = (d) => {
    try {
      const z = new Date(`${trip.start}T12:00:00`);
      z.setDate(z.getDate() + d - 1);
      return z.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' });
    } catch (e) { return `Day ${d}`; }
  };

  const dayEvents = useMemo(() => {
    return (trip.events || []).filter(e => Number(e.day) === Number(selectedDay)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [trip.events, selectedDay]);

  const todayPlaces = useMemo(() => {
    return dayEvents.filter(e => e.kind === 'place').map(e => {
      const p = (trip.places || []).find(x => x.id === e.placeId);
      return p ? { ...p, eventTime: e.time, eventId: e.id } : null;
    }).filter(Boolean);
  }, [dayEvents, trip.places]);

  useEffect(() => {
    if (subTab !== 'plan' || !mapContainerRef.current || !window.L) return;
    if (!leafletMapRef.current) {
      leafletMapRef.current = L.map(mapContainerRef.current, { scrollWheelZoom: false }).setView([25.033, 121.565], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(leafletMapRef.current);
      markersLayerRef.current = L.layerGroup().addTo(leafletMapRef.current);
    }
    setTimeout(() => leafletMapRef.current?.invalidateSize(), 120);

    markersLayerRef.current.clearLayers();
    const pts = [];
    todayPlaces.forEach(p => {
      if (p.lat && p.lng && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))) {
        L.marker([Number(p.lat), Number(p.lng)]).bindPopup(`<b>${p.name}</b><br>${p.address || ''}`).addTo(markersLayerRef.current);
        pts.push([Number(p.lat), Number(p.lng)]);
      }
    });
    if (pts.length > 0) {
      leafletMapRef.current.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 15 });
    }
  }, [subTab, todayPlaces, selectedDay]);

  const handleLocatePlace = async (place) => {
    const q = prompt('確認搜尋地址或店名（可加上縣市提高準確度）：', `${place.city || ''} ${place.name}`);
    if (!q) return;
    showToast('正在搜尋地圖座標...');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q.trim())}`);
      const arr = await res.json();
      if (arr && arr.length > 0) {
        const updatedPlaces = (trip.places || []).map(p => p.id === place.id ? { ...p, lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon), address: p.address || arr[0].display_name } : p);
        onUpdateTrip({ ...trip, places: updatedPlaces });
        showToast('📍 已成功定位並標記於地圖！');
      } else {
        showToast('找不到座標，請嘗試輸入更詳細的店名或路名');
      }
    } catch (e) {
      showToast('定位服務暫時無法使用');
    }
  };

  const handleImportFromCollection = () => {
    if (pickedPlaceIds.length === 0) return showToast('請至少勾選一個收藏地點');
    const newTripPlaces = [...(trip.places || [])];
    const newEvents = [...(trip.events || [])];

    pickedPlaceIds.forEach(colId => {
      const colItem = allSavedPlaces.find(x => x.uid === colId);
      if (!colItem) return;
      let existingPlace = newTripPlaces.find(p => p.name === colItem.name);
      if (!existingPlace) {
        const coords = window.parseCoordsFromUrl(colItem.mapUrl);
        existingPlace = {
          id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: colItem.name,
          city: colItem.city || '',
          address: colItem.address || '',
          url: colItem.mapUrl || '',
          note: colItem.combinedNote || '',
          lat: coords.lat,
          lng: coords.lng
        };
        newTripPlaces.push(existingPlace);
      }
      newEvents.push({
        id: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        kind: 'place',
        placeId: existingPlace.id,
        day: selectedDay,
        time: scheduleTime
      });
    });

    onUpdateTrip({ ...trip, places: newTripPlaces, events: newEvents });
    setPickedPlaceIds([]);
    setModalType(null);
    showToast(`✅ 已將 ${pickedPlaceIds.length} 個收藏排入 Day ${selectedDay}！`);
  };

  const handleSaveTravel = (e) => {
    e.preventDefault();
    const evId = 'ev_' + Date.now();
    const amount = Number(travelForm.amount) || 0;
    const rate = Number(trip.rates?.[travelForm.currency] || 1);
    const costTwd = Math.round(amount * rate);

    const newEv = {
      id: evId,
      kind: travelForm.kind,
      day: Number(travelForm.day),
      time: travelForm.time,
      arrive: travelForm.arrive,
      from: travelForm.from,
      to: travelForm.to,
      code: travelForm.kind === 'flight' ? travelForm.mode : '',
      mode: travelForm.kind === 'transport' ? travelForm.mode : '',
      duration: Number(travelForm.duration) || 0,
      amount,
      currency: travelForm.currency,
      payer: travelForm.payer,
      note: travelForm.note,
      costTwd
    };

    const newExpenses = [...(trip.expenses || [])];
    if (amount > 0) {
      newExpenses.push({
        id: 'exp_' + Date.now(),
        sourceEvent: evId,
        title: travelForm.kind === 'flight' ? `機票 ${travelForm.mode || ''} (${travelForm.from}→${travelForm.to})` : `交通 ${travelForm.mode || ''} (${travelForm.from}→${travelForm.to})`,
        amount,
        currency: travelForm.currency,
        twd: costTwd,
        payer: travelForm.payer,
        split: [...(trip.members || ['我'])],
        day: Number(travelForm.day)
      });
    }

    onUpdateTrip({ ...trip, events: [...(trip.events || []), newEv], expenses: newExpenses });
    setModalType(null);
    showToast('✈️ 已儲存班機/交通紀錄！');
  };

  const handleSaveExpense = (e) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount) || 0;
    if (amount <= 0) return showToast('請輸入正確金額');
    const rate = Number(trip.rates?.[expenseForm.currency] || 1);
    const twd = Math.round(amount * rate);
    const newExp = {
      id: 'exp_' + Date.now(),
      title: expenseForm.title.trim(),
      amount,
      currency: expenseForm.currency,
      twd,
      payer: expenseForm.payer,
      split: expenseForm.split.length ? expenseForm.split : [...(trip.members || ['我'])],
      day: Number(expenseForm.day)
    };
    onUpdateTrip({ ...trip, expenses: [...(trip.expenses || []), newExp] });
    setExpenseForm({ ...expenseForm, title: '', amount: '' });
    setModalType(null);
    showToast('💰 已記下一筆消費！');
  };

  const settlements = useMemo(() => {
    const members = trip.members || ['我'];
    const balances = Object.fromEntries(members.map(m => [m, 0]));
    (trip.expenses || []).forEach(e => {
      const v = Number(e.twd) || 0;
      if (e.payer in balances) balances[e.payer] += v;
      const sp = (e.split || []).filter(m => m in balances);
      if (sp.length > 0) sp.forEach(m => balances[m] -= v / sp.length);
    });
    let debt = Object.entries(balances).filter(x => x[1] < -0.5).map(([name, v]) => ({ name, v: -v }));
    let credit = Object.entries(balances).filter(x => x[1] > 0.5).map(([name, v]) => ({ name, v }));
    const transfers = [];
    while (debt.length && credit.length) {
      const v = Math.min(debt[0].v, credit[0].v);
      transfers.push(`${debt[0].name} 應付給 ${credit[0].name}：NT$ ${Math.round(v).toLocaleString()}`);
      debt[0].v -= v;
      credit[0].v -= v;
      if (debt[0].v < 0.5) debt.shift();
      if (credit[0].v < 0.5) credit.shift();
    }
    return transfers;
  }, [trip.expenses, trip.members]);

  const handleExportItineraryPdf = () => {
    let daysHtml = '';
    for (let d = 1; d <= trip.days; d++) {
      const evs = (trip.events || []).filter(e => Number(e.day) === d).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
      const rows = evs.length ? evs.map(e => {
        const p = (trip.places || []).find(x => x.id === e.placeId);
        const title = e.kind === 'place' ? (p?.name || '景點') : e.kind === 'flight' ? `✈️ ${e.code || '班機'} · ${e.from} → ${e.to}` : `🚆 ${e.mode || '交通'} · ${e.from} → ${e.to}`;
        const meta = e.kind === 'place' ? `${p?.address || ''} ${p?.note ? '｜ ' + p.note : ''}` : `${e.arrive ? e.arrive + ' 抵達 · ' : ''}${e.note || ''}`;
        return `<div class="row"><div class="time">${e.time || '--:--'}</div><div style="flex:1"><strong>${title}</strong><div class="meta">${meta}</div></div></div>`;
      }).join('') : `<div class="meta">尚未安排行程</div>`;
      daysHtml += `<section><h2>Day ${d} · ${dateOf(d)}</h2>${rows}</section>`;
    }
    window.printHtmlDocument(`${trip.title} - 行程表`, `<p class="eyebrow">NANA'S TRAVEL JOURNAL · ITINERARY</p><h1>${trip.title}</h1><p class="sub">${trip.start} 出發 · 共 ${trip.days} 天 · 旅伴：${(trip.members || ['我']).join('、')}</p>${daysHtml}`);
  };

  const handleExportMoneyPdf = () => {
    const total = (trip.expenses || []).reduce((a, e) => a + Number(e.twd || 0), 0);
    const expRows = (trip.expenses || []).map(e => `<div class="row"><div style="flex:1"><strong>${e.title}</strong><div class="meta">Day ${e.day} · ${e.payer} 先付 · 分攤：${(e.split || []).join('、')}</div></div><div style="text-align:right"><strong>NT$ ${Math.round(e.twd).toLocaleString()}</strong><div class="meta">${e.currency} ${e.amount}</div></div></div>`).join('') || '<div class="meta">尚無消費紀錄</div>';
    const setRows = settlements.map(s => `<div class="row"><strong>${s}</strong></div>`).join('') || '<div class="meta">目前無須轉帳</div>';
    window.printHtmlDocument(`${trip.title} - 分帳單`, `<p class="eyebrow">NANA'S TRAVEL JOURNAL · EXPENSE & SPLIT</p><h1>${trip.title} · 旅伴分帳單</h1><p class="sub">總支出：NT$ ${Math.round(total).toLocaleString()} · 旅伴：${(trip.members || ['我']).join('、')}</p><h2>結算轉帳建議</h2>${setRows}<h2>消費明細</h2>${expRows}`);
  };

  const totalCost = (trip.expenses || []).reduce((a, e) => a + Number(e.twd || 0), 0);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-deep text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button onClick={onBack} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl font-bold transition-colors">
            ← 返回行程列表
          </button>
          <div className="flex gap-2">
            <button onClick={handleExportItineraryPdf} className="text-xs bg-[#e3c38f] text-deep px-3 py-1.5 rounded-xl font-bold">
              📄 行程 PDF
            </button>
            <button onClick={handleExportMoneyPdf} className="text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl font-bold">
              💰 帳單 PDF
            </button>
          </div>
        </div>
        <p className="text-[11px] tracking-widest uppercase text-[#a8ceae] font-bold">ACTIVE ITINERARY</p>
        <h2 className="text-2xl font-serif font-bold mt-1">{trip.title}</h2>
        <p className="text-xs text-[#b4d2c7] mt-1">{trip.start} 出發 · 共 {trip.days} 天 · {(trip.members || ['我']).length} 位旅伴 · 總花費 NT$ {totalCost.toLocaleString()}</p>

        <div className="flex gap-2 mt-5 pt-4 border-t border-white/15 overflow-x-auto hide-scrollbar">
          {[
            ['plan', '◈ 每日時間軸 & 地圖'],
            ['flights', '✈️ 班機 & 交通'],
            ['money', '＄ 記帳 & 旅伴分帳']
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSubTab(k)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${subTab === k ? 'bg-white text-deep shadow' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 editorial-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-base text-deep">🗓️ 每日時間軸</h3>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setModalType('addPlaceFromSaved')} className="text-xs bg-accent text-white font-bold px-3 py-1.5 rounded-xl hover:opacity-90">
                  ＋ 從收藏加入景點/餐廳
                </button>
                <button onClick={() => { setTravelForm({ ...travelForm, kind: 'flight', day: selectedDay }); setModalType('addTravel'); }} className="text-xs bg-paper border border-line font-bold px-2.5 py-1.5 rounded-xl">
                  ＋ 班機
                </button>
                <button onClick={() => { setTravelForm({ ...travelForm, kind: 'transport', day: selectedDay }); setModalType('addTravel'); }} className="text-xs bg-paper border border-line font-bold px-2.5 py-1.5 rounded-xl">
                  ＋ 交通
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {Array.from({ length: trip.days }, (_, i) => i + 1).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${selectedDay === d ? 'bg-deep text-white border-deep' : 'bg-white text-muted border-line hover:border-accent'}`}
                >
                  Day {d} · {dateOf(d)}
                </button>
              ))}
              <button
                onClick={() => {
                  const nextDays = Number(trip.days) + 1;
                  onUpdateTrip({ ...trip, days: nextDays });
                  setSelectedDay(nextDays);
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border border-dashed border-accent text-accent hover:bg-soft"
              >
                ＋ 加一天
              </button>
            </div>

            {dayEvents.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-line rounded-2xl text-muted text-xs">
                Day {selectedDay} 尚未安排行程，點上方「＋ 從收藏加入景點/餐廳」快速排入吧！
              </div>
            ) : (
              <div className="border-l-2 border-[#c7d9d2] ml-2 pl-5 space-y-4 py-1">
                {dayEvents.map(ev => {
                  const p = (trip.places || []).find(x => x.id === ev.placeId);
                  const title = ev.kind === 'place' ? (p?.name || '已移除地點') : ev.kind === 'flight' ? `✈️ ${ev.code || '班機'} · ${ev.from} → ${ev.to}` : `🚆 ${ev.mode || '交通'} · ${ev.from} → ${ev.to}`;
                  const subInfo = ev.kind === 'place' ? (p?.address || '待確認地址') : `${ev.arrive ? ev.arrive + ' 抵達 · ' : ''}${ev.duration ? ev.duration + ' 分鐘 · ' : ''}${ev.costTwd ? 'NT$ ' + ev.costTwd : ''}`;
                  return (
                    <div key={ev.id} className="relative bg-paper border border-line rounded-2xl p-3.5 flex items-start justify-between gap-3">
                      <span className={`w-3 h-3 rounded-full absolute -left-[27px] top-4 border-2 border-white shadow ${ev.kind === 'place' ? 'bg-accent' : ev.kind === 'flight' ? 'bg-sky-600' : 'bg-gold'}`}></span>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-accent">{ev.time || '--:--'}</span>
                          <strong className="text-sm text-deep truncate">{title}</strong>
                        </div>
                        <p className="text-xs text-muted break-words">{subInfo}</p>
                        {ev.kind === 'place' && p?.note && (
                          <div className="text-[11px] bg-white p-2 rounded-lg border border-line text-ink whitespace-pre-line mt-1">
                            {p.note}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ev.kind === 'place' && p && (
                          <button onClick={() => handleLocatePlace(p)} className="text-xs bg-white border border-line px-2 py-1 rounded-lg hover:bg-soft" title="定位座標以顯示於地圖">
                            {p.lat ? '📍已定位' : '⌖定位'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const nextEvs = (trip.events || []).filter(x => x.id !== ev.id);
                            const nextExps = (trip.expenses || []).filter(x => x.sourceEvent !== ev.id);
                            onUpdateTrip({ ...trip, events: nextEvs, expenses: nextExps });
                          }}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                          title="移除"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 editorial-card p-5 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-base text-deep">🗺️ Day {selectedDay} 路線地圖</h3>
                <span className="text-xs text-muted">{todayPlaces.length} 個地點</span>
              </div>
              <div ref={mapContainerRef} className="w-full h-72 rounded-2xl bg-[#e9f0eb] overflow-hidden border border-line"></div>
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                💡 點擊時間軸卡片上的「⌖定位」即可將景點標記於地圖上。
              </p>
            </div>

            <button
              onClick={() => {
                if (todayPlaces.length === 0) return showToast('今日尚未安排景點');
                if (todayPlaces.length === 1) {
                  const p = todayPlaces[0];
                  window.open(p.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`, '_blank');
                } else {
                  const origin = encodeURIComponent(todayPlaces[0].name);
                  const dest = encodeURIComponent(todayPlaces[todayPlaces.length - 1].name);
                  const waypoints = todayPlaces.slice(1, -1).map(p => encodeURIComponent(p.name)).join('|');
                  window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=transit`, '_blank');
                }
              }}
              className="w-full py-2.5 bg-soft hover:bg-accent hover:text-white text-accent font-bold text-xs rounded-xl transition-colors"
            >
              在 Google Maps 開啟今日導航路線 ↗
            </button>
          </div>
        </div>
      )}

      {subTab === 'flights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="editorial-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-deep">✈️ 班機資訊</h3>
              <button onClick={() => { setTravelForm({ ...travelForm, kind: 'flight', day: selectedDay }); setModalType('addTravel'); }} className="text-xs bg-accent text-white font-bold px-3 py-1.5 rounded-xl">＋ 新增班機</button>
            </div>
            {(trip.events || []).filter(e => e.kind === 'flight').length === 0 ? (
              <div className="text-xs text-muted py-8 text-center border border-dashed border-line rounded-xl">尚無班機紀錄</div>
            ) : (
              (trip.events || []).filter(e => e.kind === 'flight').map(e => (
                <div key={e.id} className="p-3.5 rounded-xl bg-paper border border-line flex justify-between items-center">
                  <div>
                    <strong className="text-sm text-deep">{e.code || '班機'} · {e.from} → {e.to}</strong>
                    <p className="text-xs text-muted mt-0.5">Day {e.day} · {e.time} 起飛 {e.arrive ? `/ ${e.arrive} 抵達` : ''} {e.costTwd ? `· NT$ ${e.costTwd}` : ''}</p>
                  </div>
                  <button onClick={() => onUpdateTrip({ ...trip, events: trip.events.filter(x => x.id !== e.id) })} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                </div>
              ))
            )}
          </div>

          <div className="editorial-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-deep">🚆 交通移動紀錄</h3>
              <button onClick={() => { setTravelForm({ ...travelForm, kind: 'transport', day: selectedDay }); setModalType('addTravel'); }} className="text-xs bg-accent text-white font-bold px-3 py-1.5 rounded-xl">＋ 新增交通</button>
            </div>
            {(trip.events || []).filter(e => e.kind === 'transport').length === 0 ? (
              <div className="text-xs text-muted py-8 text-center border border-dashed border-line rounded-xl">尚無交通紀錄</div>
            ) : (
              (trip.events || []).filter(e => e.kind === 'transport').map(e => (
                <div key={e.id} className="p-3.5 rounded-xl bg-paper border border-line flex justify-between items-center">
                  <div>
                    <strong className="text-sm text-deep">{e.mode || '交通'} · {e.from} → {e.to}</strong>
                    <p className="text-xs text-muted mt-0.5">Day {e.day} · {e.time} · {e.duration || 0} 分鐘 {e.costTwd ? `· NT$ ${e.costTwd}` : ''}</p>
                  </div>
                  <button onClick={() => onUpdateTrip({ ...trip, events: trip.events.filter(x => x.id !== e.id) })} className="text-gray-400 hover:text-red-500 text-xs">✕</button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === 'money' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="editorial-card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-deep">💰 旅程消費明細</h3>
              <button onClick={() => setModalType('addExpense')} className="text-xs bg-accent text-white font-bold px-3 py-1.5 rounded-xl">＋ 記一筆</button>
            </div>
            <div className="bg-soft rounded-2xl p-4 border border-[#cde4d7]">
              <span className="text-xs text-accent font-bold">旅程累計總支出</span>
              <div className="text-2xl font-extrabold text-deep mt-0.5">NT$ {totalCost.toLocaleString()}</div>
              <span className="text-[11px] text-muted">共 {(trip.expenses || []).length} 筆帳目</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(trip.expenses || []).length === 0 ? (
                <div className="text-xs text-muted py-8 text-center border border-dashed border-line rounded-xl">尚未記帳</div>
              ) : (
                [...(trip.expenses || [])].reverse().map(exp => (
                  <div key={exp.id} className="p-3 rounded-xl bg-paper border border-line flex justify-between items-center">
                    <div>
                      <strong className="text-sm text-deep">{exp.title}</strong>
                      <p className="text-xs text-muted">Day {exp.day} · {exp.payer} 先付 · 分攤：{(exp.split || []).join('、')}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-sm font-bold text-deep">NT$ {Math.round(exp.twd).toLocaleString()}</div>
                        <div className="text-[11px] text-muted">{exp.currency} {exp.amount}</div>
                      </div>
                      <button onClick={() => onUpdateTrip({ ...trip, expenses: trip.expenses.filter(x => x.id !== exp.id) })} className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="editorial-card p-5 space-y-4">
            <h3 className="font-bold text-base text-deep">🤝 旅伴分帳結算</h3>
            <div className="space-y-2">
              {settlements.length === 0 ? (
                <div className="text-xs text-muted py-6 text-center bg-paper rounded-xl border border-line">目前帳目平衡，無須轉帳 ✨</div>
              ) : (
                settlements.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#fff8eb] border border-[#f0dec2] text-xs font-bold text-[#7c521b]">
                    💸 {s}
                  </div>
                ))
              )}
            </div>

            <hr className="border-line" />
            <h4 className="font-bold text-sm text-deep">⚙️ 旅伴名單與匯率設定</h4>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-muted block mb-1">旅伴名單（一行一位）</label>
                <textarea
                  className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink"
                  rows="3"
                  value={membersText}
                  onChange={e => setMembersText(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-muted block mb-1">外幣幣別</label>
                  <select
                    className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink font-semibold"
                    value={rateCurrency}
                    onChange={e => {
                      setRateCurrency(e.target.value);
                      setRateVal(trip.rates?.[e.target.value] || 1);
                    }}
                  >
                    {['JPY', 'USD', 'KRW', 'EUR', 'TWD'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-muted block mb-1">1 外幣 = 幾元台幣</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-paper border border-line rounded-xl p-2.5 text-ink"
                    value={rateVal}
                    onChange={e => setRateVal(e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  const mems = [...new Set(membersText.split('\n').map(s => s.trim()).filter(Boolean))];
                  if (!mems.length) return showToast('請至少保留一位旅伴');
                  const nextRates = { ...(trip.rates || { TWD: 1, JPY: 0.215, USD: 32.1, KRW: 0.024, EUR: 35 }), [rateCurrency]: Number(rateVal) || 1 };
                  onUpdateTrip({ ...trip, members: mems, rates: nextRates });
                  showToast('✅ 已更新旅伴與匯率設定！');
                }}
                className="bg-deep text-white font-bold px-4 py-2 rounded-xl"
              >
                儲存旅伴與匯率
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'addPlaceFromSaved' && (
        <div className="fixed inset-0 bg-deep/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 max-h-[88vh] flex flex-col space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-deep">⭐ 從收藏庫排入 Day {selectedDay}</h3>
              <button onClick={() => setModalType(null)} className="text-muted text-sm">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="font-bold text-muted block mb-1">預計到達時間</label>
                <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full border border-line rounded-xl p-2 bg-paper" />
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">搜尋收藏</label>
                <input type="text" placeholder="輸入店名或縣市..." value={pickFilter} onChange={e => setPickFilter(e.target.value)} className="w-full border border-line rounded-xl p-2 bg-paper" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allSavedPlaces
                .filter(p => `${p.name} ${p.city} ${p.foodType}`.toLowerCase().includes(pickFilter.toLowerCase()))
                .map(p => {
                  const checked = pickedPlaceIds.includes(p.uid);
                  return (
                    <label key={p.uid} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${checked ? 'bg-soft border-accent' : 'bg-paper border-line'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setPickedPlaceIds([...pickedPlaceIds, p.uid]);
                          else setPickedPlaceIds(pickedPlaceIds.filter(id => id !== p.uid));
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-line">
                            {p.sourceTab === 'food' ? '🍽️ 餐廳' : '📸 景點'}
                          </span>
                          <strong className="text-sm text-deep truncate">{p.name}</strong>
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">{p.city}{p.district} · {p.foodType}</p>
                        {p.combinedNote && <p className="text-[11px] text-accent truncate mt-0.5">{p.combinedNote}</p>}
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button onClick={() => setModalType(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-muted">取消</button>
              <button onClick={handleImportFromCollection} className="px-5 py-2 rounded-xl text-xs font-bold bg-accent text-white">
                確認排入 ({pickedPlaceIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {modalType === 'addTravel' && (
        <div className="fixed inset-0 bg-deep/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveTravel} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 text-xs shadow-2xl">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-base text-deep">{travelForm.kind === 'flight' ? '✈️ 新增班機' : '🚆 新增交通移動'}</h3>
              <button type="button" onClick={() => setModalType(null)} className="text-muted">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-muted block mb-1">第幾天</label>
                <input type="number" min="1" max={trip.days} value={travelForm.day} onChange={e => setTravelForm({...travelForm, day: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" required />
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">出發時間</label>
                <input type="time" value={travelForm.time} onChange={e => setTravelForm({...travelForm, time: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-muted block mb-1">出發地 / 機場</label>
                <input type="text" value={travelForm.from} onChange={e => setTravelForm({...travelForm, from: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" required />
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">目的地 / 機場</label>
                <input type="text" value={travelForm.to} onChange={e => setTravelForm({...travelForm, to: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-muted block mb-1">{travelForm.kind === 'flight' ? '航班號碼' : '交通工具'}</label>
                <input type="text" placeholder={travelForm.kind === 'flight' ? '如 JX800' : '如 新幹線/計程車'} value={travelForm.mode} onChange={e => setTravelForm({...travelForm, mode: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" />
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">花費金額 (選填，自動入帳)</label>
                <input type="number" step="any" placeholder="0" value={travelForm.amount} onChange={e => setTravelForm({...travelForm, amount: e.target.value})} className="w-full border border-line rounded-xl p-2 bg-paper" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 rounded-xl text-muted font-bold">取消</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-accent text-white font-bold">儲存</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'addExpense' && (
        <div className="fixed inset-0 bg-deep/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-white rounded-3xl max-w-md w-full p-6 space-y-3 text-xs shadow-2xl">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-base text-deep">💰 記一筆消費</h3>
              <button type="button" onClick={() => setModalType(null)} className="text-muted">✕</button>
            </div>
            <div>
              <label className="font-bold text-muted block mb-1">消費項目</label>
              <input type="text" placeholder="例如：敘敘苑燒肉晚餐、伴手禮" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} className="w-full border border-line rounded-xl p-2.5 bg-paper" required />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="font-bold text-muted block mb-1">金額</label>
                <input type="number" step="any" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full border border-line rounded-xl p-2.5 bg-paper" required />
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">幣別</label>
                <select value={expenseForm.currency} onChange={e => setExpenseForm({...expenseForm, currency: e.target.value})} className="w-full border border-line rounded-xl p-2.5 bg-paper font-bold">
                  {Object.keys(trip.rates || { TWD: 1, JPY: 0.215, USD: 32.1 }).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-muted block mb-1">誰先付錢</label>
                <select value={expenseForm.payer} onChange={e => setExpenseForm({...expenseForm, payer: e.target.value})} className="w-full border border-line rounded-xl p-2.5 bg-paper font-bold">
                  {(trip.members || ['我']).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-muted block mb-1">第幾天</label>
                <input type="number" min="1" max={trip.days} value={expenseForm.day} onChange={e => setExpenseForm({...expenseForm, day: e.target.value})} className="w-full border border-line rounded-xl p-2.5 bg-paper" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 rounded-xl text-muted font-bold">取消</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-accent text-white font-bold">儲存帳目</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
