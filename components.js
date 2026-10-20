// ==========================================================================
// 檔案名稱：components.js
// 功能：智慧圖片輪播區 (PhotoCarousel) 與 收藏/購物通用卡片 (CollectionCard)
// ==========================================================================

const { useState, useEffect, useMemo } = React;

// 🖼️ 獨立元件：智慧照片輪播區 (處理 Google 圖片顯示與過期失效備援)
window.PhotoCarousel = ({ urls, itemName, city, sourceTab }) => {
  const [brokenIndices, setBrokenIndices] = useState({});

  useEffect(() => {
    setBrokenIndices({});
  }, [urls]);

  const validUrls = (urls || []).filter((_, idx) => !brokenIndices[idx]);
  const googleImgSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent((city || '') + ' ' + itemName)}`;

  if (validUrls.length > 0) {
    return (
      <div className="w-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-2.5 p-3 bg-[#eef3ef] border-b border-line">
        {(urls || []).map((url, idx) => {
          if (brokenIndices[idx]) return null;
          return (
            <div key={idx} className={`snap-center shrink-0 ${validUrls.length === 1 ? 'w-full' : 'w-[86%]'} h-48 rounded-xl overflow-hidden bg-white shadow-sm relative`}>
              <img
                src={url}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                alt={`${itemName} 照片 ${idx + 1}`}
                loading="lazy"
                onError={() => setBrokenIndices(prev => ({ ...prev, [idx]: true }))}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full h-32 bg-gradient-to-br from-[#e7f0ea] to-[#dde8e1] flex flex-col items-center justify-center border-b border-line text-muted px-4 text-center">
      <span className="text-2xl mb-1">{sourceTab === 'food' ? '🍽️' : (sourceTab === 'spot' ? '⛰️' : '🛍️')}</span>
      <a
        href={googleImgSearchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-bold text-accent hover:underline bg-white/80 px-3 py-1 rounded-full border border-line shadow-sm mt-0.5"
      >
        🔍 點此查看「{itemName}」Google 實景圖片 ↗
      </a>
    </div>
  );
};

// 🃏 元件：收藏與購物通用卡片 (整合 AI 總結至備註欄)
window.CollectionCard = ({ item, onUpdateNote, onUpdateCategory, onDelete, onAddToTrip }) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState(item.personalNote || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  let priceDisplay = '依現場為主';
  if (item.sourceTab === 'shop') {
    priceDisplay = String(item.priceLevel || '依現場為主');
  } else if (item.aiData && typeof item.aiData === 'object' && item.aiData.exactPrice && item.aiData.exactPrice !== "依現場為主") {
    priceDisplay = String(item.aiData.exactPrice);
  } else {
    const num = Number(item.priceLevel);
    if (num === 1) priceDisplay = '約 NT$100-300';
    else if (num === 2) priceDisplay = '約 NT$300-800';
    else if (num === 3) priceDisplay = '約 NT$800-1500';
    else if (num >= 4) priceDisplay = 'NT$1500+';
  }

  const aiSummaryNote = useMemo(() => {
    if (!item.aiData) return '';
    if (typeof item.aiData !== 'object') return String(item.aiData);
    const parts = [];
    if (item.aiData.signature) parts.push(`💡 ${item.sourceTab === 'food' ? '必點招牌' : (item.sourceTab === 'spot' ? '打卡亮點' : '商品用途')}：${item.aiData.signature}`);
    if (item.aiData.review) parts.push(`💬 ${item.sourceTab === 'shop' ? '網路評價' : '評論摘要'}：${item.aiData.review}`);
    if (item.aiData.reason && item.sourceTab === 'spot') parts.push(`📌 貼心提醒：${item.aiData.reason}`);
    return parts.join('\n');
  }, [item.aiData, item.sourceTab]);

  const handleSaveNote = async () => {
    setIsSaving(true);
    await onUpdateNote(item.sourceTab, item.id, noteContent);
    setIsSaving(false);
    setIsEditingNote(false);
  };

  const handleSaveCat = async (newCat) => {
    setIsEditingCat(false);
    await onUpdateCategory(item.sourceTab, item.id, newCat);
  };

  const badgeColor = item.sourceTab === 'food' 
    ? 'bg-amber-100 text-amber-800 border-amber-200' 
    : (item.sourceTab === 'spot' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-teal-100 text-teal-800 border-teal-200');

  const catList = window.categoriesData[item.sourceTab] || window.categoriesData.food;

  return (
    <article className="editorial-card overflow-hidden flex flex-col justify-between transition-all hover:shadow-lg animate-fade-in">
      <div>
        <window.PhotoCarousel
          urls={item.photoUrls}
          itemName={item.name}
          city={item.city}
          sourceTab={item.sourceTab}
        />

        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                {item.sourceTab === 'food' ? '🍽️ 餐廳' : (item.sourceTab === 'spot' ? '📸 景點' : '🛍️ 購物')}
              </span>

              {isEditingCat ? (
                <select
                  className="text-xs bg-paper border border-accent rounded-lg px-2 py-0.5 text-ink font-semibold"
                  value={item.foodType}
                  onChange={(e) => handleSaveCat(e.target.value)}
                  onBlur={() => setIsEditingCat(false)}
                  autoFocus
                >
                  {catList.map(c => <option key={c.name} value={c.name}>{c.name} {c.emoji}</option>)}
                </select>
              ) : (
                <button onClick={() => setIsEditingCat(true)} className="text-xs font-semibold bg-paper hover:bg-soft text-ink px-2.5 py-0.5 rounded-full border border-line transition-colors" title="點擊更改分類">
                  {item.foodType} ✎
                </button>
              )}

              {item.city && item.sourceTab !== 'shop' && (
                <span className="text-xs text-muted font-medium">📍 {item.city}{item.district}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {item.sourceTab !== 'shop' && item.isOpenNow === true && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>營業中
                </span>
              )}
              {item.sourceTab !== 'shop' && item.isOpenNow === false && (
                <span className="bg-gray-100 text-gray-500 border border-gray-200 text-[11px] font-semibold px-2 py-0.5 rounded-full">休息中</span>
              )}

              {deleteConfirm ? (
                <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                  <button onClick={() => onDelete(item.sourceTab, item.id)} className="text-[11px] font-bold text-red-600 hover:underline">確定刪除</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setDeleteConfirm(false)} className="text-[11px] text-gray-500">取消</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-0.5 rounded" title="刪除">✕</button>
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-deep mb-2 leading-snug">{item.name}</h3>

          <div className="space-y-1 text-xs text-muted mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-amber-600">★ {item.rating > 0 ? `${item.rating} 分` : '尚未評分'}</span>
              <span>·</span>
              <span>💰 {priceDisplay}</span>
            </div>
            {item.sourceTab !== 'shop' && (
              <div className="truncate">🕒 今日營業：{item.todayHoursText}</div>
            )}
            {item.address && item.address !== '尚未提供地址' && item.sourceTab !== 'shop' && (
              <div className="truncate text-[11px]">🗺️ {item.address}</div>
            )}
          </div>

          {/* 備註與 AI 總結整合區 */}
          <div className="bg-paper rounded-xl p-3.5 border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">📋 備註與 AI 情報摘要</span>
              {!isEditingNote && (
                <button onClick={() => setIsEditingNote(true)} className="text-[11px] text-accent font-semibold hover:underline">
                  ✎ 編輯筆記
                </button>
              )}
            </div>

            {aiSummaryNote && (
              <div className="text-xs text-ink leading-relaxed whitespace-pre-line border-b border-line/70 pb-2">
                {aiSummaryNote}
              </div>
            )}

            {isEditingNote ? (
              <div className="pt-1">
                <textarea
                  className="w-full bg-white border border-accent/50 rounded-lg p-2 text-xs text-ink outline-none min-h-[64px]"
                  placeholder="輸入你的個人心得、同行友人或預約備註..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setIsEditingNote(false)} className="text-xs text-muted px-2.5 py-1">取消</button>
                  <button onClick={handleSaveNote} disabled={isSaving} className="text-xs bg-accent text-white font-bold px-3 py-1 rounded-lg">
                    {isSaving ? '儲存中...' : '儲存筆記'}
                  </button>
                </div>
              </div>
            ) : (
              <div onClick={() => setIsEditingNote(true)} className="text-xs text-ink/90 cursor-pointer hover:text-accent transition-colors pt-0.5">
                {item.personalNote ? (
                  <span className="font-medium">✍️ 筆記：{item.personalNote}</span>
                ) : (
                  <span className="text-muted italic">＋ 點此新增個人筆記或補充說明...</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-[#f9fbf8] border-t border-line flex items-center justify-between gap-2 text-xs font-bold">
        {item.sourceTab === 'shop' ? (
          <React.Fragment>
            <a href={item.shopeeUrl || `https://shopee.tw/search?keyword=${encodeURIComponent(item.name)}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
              🛒 蝦皮一鍵比價 ↗
            </a>
            <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.name)}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink flex items-center gap-1">
              🔍 搜圖片
            </a>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="flex items-center gap-3">
              {item.mapUrl && (
                <a href={item.mapUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline flex items-center gap-1">
                  📍 Google 地圖 ↗
                </a>
              )}
              {item.igUrl && (
                <a href={item.igUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex items-center gap-1">
                  📸 貼文/IG ↗
                </a>
              )}
            </div>
            {onAddToTrip && (
              <button onClick={() => onAddToTrip(item)} className="bg-soft hover:bg-accent hover:text-white text-accent px-3 py-1.5 rounded-lg transition-colors">
                ＋ 排入行程
              </button>
            )}
          </React.Fragment>
        )}
      </div>
    </article>
  );
};
