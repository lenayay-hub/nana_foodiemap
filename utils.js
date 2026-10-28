// ==========================================================================
// 檔案名稱：utils.js
// 功能：API 網址常數、分類清單、Google圖片智慧解析、營業時間判斷、PDF 列印引擎
// ==========================================================================

window.GAS_API_URL = 'https://script.google.com/macros/s/AKfycbyKXiPyB0px2WYHW2l2CxeCID-yj2ixog9FezvrPYuzfgX9MSAtRcP-hqj3yQTTBbUi/exec';
window.LOCAL_TRIPS_KEY = 'nana_superapp_trips_v1';

// 菜單字典與 OCR 腳本：第一次掃描或打開「當地美食」才載入，不進首屏。
window.loadNanaFood = function () {
  if (window.NanaFood && window.NanaFood.ready) return Promise.resolve(window.NanaFood);
  if (window.__nanaFoodPromise) return window.__nanaFoodPromise;
  window.__nanaFoodPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'food-logic.js';
    s.async = true;
    s.onload = function () {
      if (window.NanaFood && window.NanaFood.ready) resolve(window.NanaFood);
      else reject(new Error('字典載入失敗'));
    };
    s.onerror = function () {
      window.__nanaFoodPromise = null;
      reject(new Error('字典載入失敗'));
    };
    document.head.appendChild(s);
  });
  return window.__nanaFoodPromise;
};

// 舊行程補上新欄位，不刪原本的地點、花費、備註或交通。
window.normalizeTrips = function (list) {
  if (!Array.isArray(list)) return [];
  return list.map(t => {
    if (!t || typeof t !== 'object') return t;
    const events = Array.isArray(t.events) ? t.events.map(ev => {
      if (!ev || typeof ev !== 'object') return ev;
      return {
        ...ev,
        bookingUrl: typeof ev.bookingUrl === 'string' ? ev.bookingUrl : (ev.bookingUrl ? String(ev.bookingUrl) : ''),
        orderNo: typeof ev.orderNo === 'string' ? ev.orderNo : (ev.orderNo ? String(ev.orderNo) : '')
      };
    }) : t.events;
    return {
      ...t,
      country: typeof t.country === 'string' ? t.country : '',
      avoids: Array.isArray(t.avoids) ? t.avoids : [],
      avoidCustom: Array.isArray(t.avoidCustom) ? t.avoidCustom : [],
      foodFavs: Array.isArray(t.foodFavs) ? t.foodFavs : [],
      events
    };
  });
};

// 🏷️ 分類設定
window.categoriesData = {
  food: [
    { name: "日式", emoji: "🍣" }, { name: "台式", emoji: "🥘" }, { name: "韓式", emoji: "🌶️" },
    { name: "美式", emoji: "🍔" }, { name: "義式", emoji: "🍝" }, { name: "早午餐", emoji: "🥞" },
    { name: "咖啡廳", emoji: "☕" }, { name: "甜點", emoji: "🍰" }, { name: "火鍋", emoji: "🍲" },
    { name: "手搖", emoji: "🧋" }, { name: "燒肉", emoji: "🥩" }, { name: "餐酒館", emoji: "🍷" },
    { name: "小吃", emoji: "🥡" }, { name: "其他", emoji: "🍽️" }
  ],
  spot: [
    { name: "自然風景", emoji: "⛰️" }, { name: "歷史古蹟", emoji: "🏛️" }, { name: "網美打卡", emoji: "✨" },
    { name: "展覽藝文", emoji: "🎨" }, { name: "休閒娛樂", emoji: "🎬" }, { name: "其他", emoji: "📍" }
  ],
  shop: [
    { name: "美妝保養", emoji: "💄" }, { name: "3C家電", emoji: "💻" }, { name: "服飾配件", emoji: "👕" },
    { name: "生活居家", emoji: "🛋️" }, { name: "食品伴手禮", emoji: "🎁" }, { name: "玩具模型", emoji: "🧸" },
    { name: "工作買貨", emoji: "📦" }, { name: "達達婷婷", emoji: "🐶" }, { name: "其他", emoji: "🛍️" }
  ]
};

// 🔥 全方位智慧解析 Google 試算表圖片網址（優化尺寸為 w600 保護手機記憶體）
window.extractPhotoUrls = function(item) {
  let raw = item['照片網址'] || item['照片'] || item['圖片網址'] || item['圖片'] || '';
  
  if (!raw || String(raw).trim() === '' || String(raw).trim() === '[]') {
    const vals = Object.values(item);
    if (vals.length > 10 && vals[10] && (String(vals[10]).startsWith('[') || String(vals[10]).startsWith('http'))) {
      raw = vals[10];
    } else {
      for (const v of vals) {
        const s = String(v || '').trim();
        if (s.startsWith('["http') || s.includes('googleusercontent.com') || s.includes('places.googleapis.com') || s.includes('drive.google.com/uc?id=')) {
          raw = s;
          break;
        }
      }
    }
  }

  const rawStr = String(raw || '').trim();
  let urls = [];

  if (rawStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(rawStr);
      if (Array.isArray(parsed)) urls = parsed;
    } catch (e) {}
  } else if (rawStr.startsWith('http')) {
    urls = [rawStr];
  }

  return urls
    .map(u => String(u || '').trim())
    .filter(u => u.startsWith('http'))
    .map(u => u.includes('drive.google.com/uc?id=') ? u.replace('/uc?id=', '/thumbnail?id=') + '&sz=w600' : u);
};

// 🕒 營業時間判斷工具
window.checkIsOpenNow = function(hoursJson) {
  if (!hoursJson || typeof hoursJson !== 'string') return null;
  try {
    const hours = JSON.parse(hoursJson);
    if (!hours || !hours.periods) return null;
    const twTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
    const currentDay = twTime.getDay();
    const currentTimeVal = twTime.getHours() * 100 + twTime.getMinutes();
    for (const period of hours.periods) {
      if (period.open && !period.close) return true;
      const openDay = period.open.day, openTime = period.open.hour * 100 + period.open.minute;
      const closeDay = period.close.day, closeTime = period.close.hour * 100 + period.close.minute;
      if (openDay === closeDay) {
        if (currentDay === openDay && currentTimeVal >= openTime && currentTimeVal < closeTime) return true;
      } else {
        if (currentDay === openDay && currentTimeVal >= openTime) return true;
        if (currentDay === closeDay && currentTimeVal < closeTime) return true;
      }
    }
    return false;
  } catch (e) { return null; }
};

window.getTodayHoursText = function(hoursJson) {
  if (!hoursJson || typeof hoursJson !== 'string') return '依現場公告為主';
  try {
    const hours = JSON.parse(hoursJson);
    if (hours.weekdayDescriptions && hours.weekdayDescriptions.length > 0) {
      const twTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
      let dayIndex = twTime.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6;
      const desc = String(hours.weekdayDescriptions[dayIndex] || '');
      const splitIndex = desc.indexOf(':') !== -1 ? desc.indexOf(':') : desc.indexOf('：');
      return splitIndex !== -1 ? desc.substring(splitIndex + 1).trim() : desc;
    }
  } catch(e) {}
  return '依現場公告為主';
};

// 🧭 從 Google Maps 網址解析經緯度座標
window.parseCoordsFromUrl = function(url) {
  if (!url || typeof url !== 'string') return { lat: null, lng: null };
  try {
    const s = decodeURIComponent(url);
    const m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[?&](?:q|query)=(-?\d+\.\d+)%?2C(-?\d+\.\d+)/);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : { lat: null, lng: null };
  } catch (e) { return { lat: null, lng: null }; }
};

// 📄 PDF 印製與分享引擎
window.printHtmlDocument = function(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) { alert('請允許彈出視窗以產生 PDF'); return; }
  const htmlContent = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>
      *{box-sizing:border-box} body{margin:0;background:#f6f8f3;color:#17353a;font:14px/1.6 "DM Sans","Noto Sans TC",sans-serif;padding:24px}
      .sheet{max-width:760px;margin:auto;background:#fff;border:1px solid #dce6e0;border-radius:18px;padding:28px}
      .bar{display:flex;gap:8px;justify-content:flex-end;max-width:760px;margin:0 auto 12px}
      .btn{border:1px solid #167568;background:#167568;color:#fff;border-radius:10px;padding:9px 14px;font:700 13px inherit;cursor:pointer}
      .eyebrow{color:#167568;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0 0 6px}
      h1{font-size:26px;margin:0 0 4px} .sub{color:#6f8085;margin:0 0 20px;font-size:13px}
      h2{font-size:16px;margin:20px 0 8px;padding-bottom:5px;border-bottom:1px solid #e3e9e5}
      .row{padding:9px 0;border-bottom:1px solid #eef2ef;display:flex;justify-content:space-between;gap:14px}
      .time{color:#167568;font-weight:700;min-width:62px} .meta{color:#6f8085;font-size:12px}
      @media print{body{background:#fff;padding:0}.bar{display:none}.sheet{border:0;padding:0;max-width:none}}
    </style></head><body>
    <div class="bar"><button class="btn" onclick="window.print()">列印 / 儲存為 PDF (iPhone 可點分享傳 LINE)</button></div>
    <main class="sheet">${bodyHtml}</main>
    <script>setTimeout(function(){window.print();}, 400);</script>
    </body></html>`;
  win.document.write(htmlContent);
  win.document.close();
};

// 🗂️ 格式化試算表資料並將 AI 總結自動寫入備註（加入唯一 uid 防呆）
window.formatSheetItems = function(list, sourceTab) {
  return (Array.isArray(list) ? list : []).map((item, idx) => {
    if (!item || typeof item !== 'object') return null;
    let aiSummaryData = null;
    const rawAiText = String(item['AI總結'] || '').trim();
    if (rawAiText.startsWith('{') && rawAiText.endsWith('}')) {
      try { aiSummaryData = JSON.parse(rawAiText); } catch(e) {}
    }

    const parsedPhotoUrls = window.extractPhotoUrls(item);
    const sig = aiSummaryData?.signature ? `★必點/亮點：${aiSummaryData.signature}` : '';
    const rev = aiSummaryData?.review ? `💬摘要：${aiSummaryData.review}` : '';
    const note = String(item['個人註解'] || '');
    const combinedNote = [sig, rev, note].filter(Boolean).join(' ｜ ');
    const nameStr = String(item['店名'] || item['景點名稱'] || item['商品名稱'] || '未命名項目').trim();
    const safeId = item.id !== undefined && item.id !== '' ? item.id : `row_${idx}`;

    return {
      uid: `${sourceTab}_${safeId}_${idx}`,
      id: safeId,
      sourceTab,
      name: nameStr,
      city: String(item['縣市'] || '').replace(/臺/g, '台').trim(),
      district: String(item['區域'] || '').trim(),
      foodType: String(item['類型'] || item['分類'] || '其他').trim(),
      priceLevel: item['價位'] || item['預估價格'] || 2,
      rating: parseFloat(item['Google評分'] || item['推薦指數']) || 0,
      address: String(item['地址'] || '').trim(),
      mapUrl: String(item['地圖連結'] || '').trim(),
      shopeeUrl: String(item['蝦皮連結'] || '').trim(),
      igUrl: String(item['IG連結'] || '').trim(),
      photoUrls: parsedPhotoUrls,
      aiData: aiSummaryData || rawAiText,
      personalNote: note,
      combinedNote,
      isOpenNow: window.checkIsOpenNow(String(item['營業時間'] || '')),
      todayHoursText: window.getTodayHoursText(String(item['營業時間'] || ''))
    };
  }).filter(x => x && x.name && x.name !== '未命名項目');
};
