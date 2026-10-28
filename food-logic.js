/* Nana's Journal — local food dictionary + on-device OCR helpers.
   Loaded only after the first menu scan or the first opening of 當地美食.
   Bundled Vietnam rows come from data/vn_food_dictionary.csv. */
(function (root) {
  'use strict';

  const SHEETS_KEY = 'nana_journal_dict_sheets_v1';
  const CACHE_KEY = 'nana_journal_dict_cache_v1';
  const DEFAULT_SHEETS = {
    '越南': 'https://docs.google.com/spreadsheets/d/1mowKgXs8ONZaZbcGc4hZi50To2b1JJbHLC6MGHVOz1Y/export?format=csv'
  };
  const DICT_COUNTRIES = ['越南','日本','韓國','泰國','台灣','香港','新加坡','法國','義大利','美國','英國'];
  const OCR_LANG = {
    '越南':'vie','日本':'jpn','韓國':'kor','泰國':'tha','台灣':'chi_tra','中國':'chi_sim','香港':'chi_tra',
    '法國':'fra','義大利':'ita','西班牙':'spa','德國':'deu','美國':'eng','英國':'eng','新加坡':'eng',
    '馬來西亞':'msa','印尼':'ind'
  };
  const VN_CSV = "原文,中文名,說明,食材,辣度,標籤\nBánh bèo,萍餅,,,0,主食\nBánh xèo,越南煎餅,本為下柬埔寨的高棉傳統食品,,0,主食\nChả cá,魚漿,河內美食傳統燴魚鍋,海鮮,0,主食\nCao lầu,會安乾麵,搭配香草、生菜、豬肉、拌醬的清爽乾麵,豬肉,0,主食\nGỏi cuốn,生春捲,原文寫作 Goi cuon,,0,主食\nChả giò,越南炸春捲,原文寫作 cha gio（南越說法）,,0,主食\nNem rán,越南炸春捲,北越說法,,0,主食\nBún bò Huế,順化牛肉粉,原文寫作 Bun bo Hue,牛肉,0,主食\nBánh khọt,南越小吃，一種薄餅,原文寫作 Banh khot,,0,主食\nNộm hoa chuối,涼拌香蕉花,原文寫作 Nom hoa chuoi,,0,主食\nBún bò Nam Bộ,越式牛肉米線,原文寫作 Bun bo nam bo,牛肉,0,主食\nHoa quả dầm,北越碎冰什錦水果粒,原文寫作 Hoa qua dam,,0,點心\nBò lá lốt,荖葉烤牛肉捲,原文寫作 Bo la lot,牛肉,0,主食\nBột chiên,蛋煎糕,,蛋,0,主食\nCơm sườn nướng,烤排骨飯,原文寫作 com suon nuong；sườn 為豬排骨,豬肉,0,主食\nThịt,肉類,Meat,,0,肉類\nBò,牛肉,beef,牛肉,0,肉類\nTái,半生熟牛肉,原文寫作 Tai,牛肉,0,肉類\nGà,雞肉,chicken,,0,肉類\nCá,魚,fish,海鮮,0,肉類\nTôm,蝦子,shrimp,海鮮,0,肉類\nLợn,豬肉,pork（北越用法）,豬肉,0,肉類\nHeo,豬肉,pork（南越用法）,豬肉,0,肉類\nMực,墨魚,cuttlefish,海鮮,0,肉類\nPhở,河粉,Flat rice noodle,,0,麵食\nPhở bò,牛肉河粉,,牛肉,0,麵食\nPhở (bò) tái,半生熟牛肉河粉,,牛肉,0,麵食\nPhở nạm,牛腩河粉,原文寫作 Phở Nam,牛肉,0,麵食\nPhở tái nạm,半生熟+牛腩河粉,原文寫作 Phở Tai Nam,牛肉,0,麵食\nPhở chả,甜不辣河粉,chả 為魚漿/肉漿製品,,0,麵食\nPhở đặc biệt,綜合河粉,,,0,麵食\nMì,細油麵,,,0,麵食\nMì xào bò,牛肉炒麵,,牛肉,0,麵食\nMì xào hải sản,海鮮炒麵,音：米臊海傘,海鮮,0,麵食\nMì xào thập cẩm,什錦炒麵,,,0,麵食\nMì xào đặc biệt,炒麵特餐,,,0,麵食\nMì xào rau,青菜炒麵,,,0,麵食\nBún,米線,原文寫作 Bun,,0,麵食\nCơm,飯,,,0,主食\nLẩu hải sản chua cay (lớn & nhỏ),越式火鍋（大鍋/小鍋）,海鮮酸辣火鍋；原文寫作 Lau Hai San chua cay(lon&nho),\"海鮮,辣\",2,主食\nBánh mì,麵包,越式法國麵包；原文寫作 Banh mi,,0,西式\nNui,通心粉,Pasta,,0,西式\nBánh ngọt,蛋糕,,,0,西式\nNgô,玉米,,,0,蔬菜\nCủ tỏi,大蒜,,,0,蔬菜\nRau,菜,,,0,蔬菜\nTỏi tây,蔥,tỏi tây 字面是韭蔥(leek),,0,蔬菜\nCủ hành,洋蔥,,,0,蔬菜\nCà chua,番茄,,,0,蔬菜\nMướp tây,秋葵,,,0,蔬菜\nỚt,辣椒,,辣,2,蔬菜\nKhoai tây,馬鈴薯,,,0,蔬菜\nCủ lạc,花生,,花生,0,蔬菜\nBạc hà,薄荷,,,0,蔬菜\nQuả ô liu,橄欖,原文寫作 quả oliu,,0,蔬菜\nTrái cây,水果,買果乾的時候用得到,,0,水果\nNa,釋迦,,,0,水果\nChuối,香蕉,,,0,水果\nVỏ chuối,香蕉皮,,,0,水果\nDâu tây,草莓,,,0,水果\nDứa,鳳梨,,,0,水果\nCam,柳橙,,,0,水果\nTáo,蘋果,,,0,水果\nMía,甘蔗,,,0,水果\nỔi,芭樂,,,0,水果\nQuýt,橘子,,,0,水果\nMận,李子,,,0,水果\nChôm chôm,紅毛丹,,,0,水果\nThanh long,火龍果,,,0,水果\nQuả roi,蓮霧,,,0,水果\nQuả nhãn,龍眼,,,0,水果\nXoài,芒果,,,0,水果\nĐu đủ,木瓜,,,0,水果\nChanh,檸檬,,,0,水果\nNho,葡萄,,,0,水果\nSơn tra,山楂,,,0,水果\nMăng cụt,山竹,,,0,水果\nQuả lựu,石榴,,,0,水果\nĐào,桃子,,,0,水果\nDừa,椰子,,,0,水果\nBưởi,柚子,,,0,水果\nQuả dương đào,奇異果,,,0,水果\nTáo đỏ,紅棗,,,0,水果\nQuả sung,無花果,,,0,水果\nĐá,冰,,,0,飲料\nNóng,熱,,,0,飲料\nSữa,牛奶,,奶製品,0,飲料\nCam ép,橙汁,,,0,飲料\nTrà,茶,音：炸,,0,飲料\nTrà đá,冰茶,原文誤植為 Trả Đá,,0,飲料\nTrà sữa,奶茶,音：舌,奶製品,0,飲料\nTrà sữa Thái,泰式奶茶,,奶製品,0,飲料\nTrà sữa trân châu,珍珠奶茶,,奶製品,0,飲料\nTrà sữa đào,桃香奶茶,越南奶茶,奶製品,0,飲料\nCà phê,咖啡,,,0,飲料\nCà phê đá,冰黑咖啡,,,0,飲料\nCà phê nóng,熱黑咖啡,,,0,飲料\nCà phê sữa đá,冰煉乳咖啡,加煉乳，並非拿鐵,奶製品,0,飲料\nCà phê sữa nóng,熱煉乳咖啡,加煉乳,奶製品,0,飲料\nNước trái cây,果汁,,,0,飲料\nNước,水,,,0,飲料\nRượu cốc tai,雞尾酒,,,0,飲料\nRượu vang đỏ,紅酒,,,0,飲料\nRượu trắng,白酒,,,0,飲料\nBia,啤酒,,,0,飲料\nCoca,可樂,,,0,飲料\nSữa chua uống,優格,飲用優格（優酪乳）,奶製品,0,點心\nSữa chua uống vị,優格,vị = 口味，後面通常接口味名稱（如 vị dâu 草莓口味）,奶製品,0,點心\nSô-cô-la,巧克力,原文寫作 Socola,,0,點心\nHạt điều,腰果,,,0,點心\nKẹo cao su,口香糖,,,0,點心\nKẹo,糖果,,,0,點心\nNho khô,葡萄乾,,,0,點心\nMón bỏng ngô,爆米花,,,0,點心\nQuán cơm,飯館、餐廳,,,0,其他\nLò vi sóng,微波爐,,,0,其他\nTủ lạnh,冰箱,,,0,其他\nBữa ăn sáng,早餐,,,0,其他\nBữa ăn trưa,午餐,,,0,其他\nBữa ăn tối,晚餐,,,0,其他\nĐường,糖,,,0,其他\n";

  function csvRows(text) {
    const rows = [];
    let row = [], val = '', quote = false;
    const src = String(text || '');
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quote && c === '"' && src[i + 1] === '"') { val += '"'; i++; }
      else if (c === '"') quote = !quote;
      else if (!quote && c === ',') { row.push(val); val = ''; }
      else if (!quote && (c === '\n' || c === '\r')) {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(val);
        if (row.some(x => String(x).trim())) rows.push(row);
        row = []; val = '';
      } else val += c;
    }
    row.push(val);
    if (row.some(x => String(x).trim())) rows.push(row);
    return rows;
  }

  function spiceLabel(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    if (s === '0' || s === '不辣' || s === '無' || s === '無辣') return '不辣';
    if (s === '1' || s === '微辣') return '微辣';
    if (/^\d+$/.test(s)) return Number(s) >= 2 ? '辣' : '不辣';
    return s;
  }

  function splitList(s) {
    return String(s || '').split(/[、,，/|｜;；]/).map(x => x.trim()).filter(Boolean);
  }

  function parseDictCsv(text) {
    const rows = csvRows(String(text || '').replace(/^\uFEFF/, ''));
    if (!rows.length) throw new Error('試算表是空的');
    const head = rows[0].map(x => String(x || '').trim());
    const need = ['原文','中文名','說明','食材','辣度','標籤'];
    const idx = {};
    need.forEach(n => { idx[n] = head.indexOf(n); });
    const missing = need.filter(n => idx[n] < 0);
    if (missing.length) throw new Error('缺少欄位：' + missing.join('、'));
    const dishes = [];
    for (const row of rows.slice(1)) {
      const original = String(row[idx['原文']] || '').trim();
      const zh = String(row[idx['中文名']] || '').trim();
      if (!original && !zh) continue;
      dishes.push({
        original: original || zh,
        zh: zh || original,
        desc: String(row[idx['說明']] || '').trim(),
        ingredients: splitList(row[idx['食材']]),
        spice: spiceLabel(row[idx['辣度']]),
        tags: splitList(row[idx['標籤']])
      });
    }
    if (!dishes.length) throw new Error('沒有讀到任何菜色');
    return dishes;
  }

  let bundledMemo = null;
  function bundledVietnam() {
    if (!bundledMemo) bundledMemo = parseDictCsv(VN_CSV);
    return bundledMemo;
  }

  function fold(s) {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readJson(key) {
    try {
      const raw = root.localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed;
    } catch (e) { return {}; }
  }
  function writeJson(key, value) {
    try { root.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function readSheets() { return readJson(SHEETS_KEY); }
  function writeSheets(sheets) { return writeJson(SHEETS_KEY, sheets); }
  function readCache() { return readJson(CACHE_KEY); }
  function writeCache(cache) { return writeJson(CACHE_KEY, cache); }

  function sheetLink(country) {
    const stored = readSheets();
    if (Object.prototype.hasOwnProperty.call(stored, country)) return String(stored[country] || '').trim();
    return DEFAULT_SHEETS[country] || '';
  }

  function sheetCsvUrl(link) {
    const raw = String(link || '').trim();
    if (!raw) return '';
    let u;
    try { u = new URL(raw); } catch (e) { return ''; }
    if (u.protocol !== 'https:') return '';
    if (/[?&](output|format)=csv/i.test(u.search) || /\/export/i.test(u.pathname) || /\.csv($|\?)/i.test(u.pathname)) return u.href;
    const pub = u.pathname.match(/\/spreadsheets\/d\/e\/([^/]+)/);
    if (pub) return 'https://docs.google.com/spreadsheets/d/e/' + pub[1] + '/pub?output=csv';
    const id = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (id) {
      const gid = u.searchParams.get('gid') || '0';
      return 'https://docs.google.com/spreadsheets/d/' + id[1] + '/export?format=csv&gid=' + encodeURIComponent(gid);
    }
    return '';
  }

  function packFromCache(country) {
    const key = country || '越南';
    const cache = readCache()[key];
    if (cache && Array.isArray(cache.dishes) && cache.dishes.length) {
      return { country: key, dishes: cache.dishes, updatedAt: cache.updatedAt || '', sample: false, cached: true };
    }
    if (key === '越南') {
      return { country: '越南', dishes: bundledVietnam(), updatedAt: '', sample: true, cached: false };
    }
    return { country: key, dishes: [], updatedAt: '', sample: false, cached: false };
  }

  async function refreshCountry(country, linkOverride) {
    const link = linkOverride != null ? String(linkOverride).trim() : sheetLink(country);
    const url = sheetCsvUrl(link);
    if (!link || !url) {
      const err = new Error('請先貼上 https 的 Google 試算表連結');
      err.code = 'nourl';
      throw err;
    }
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error('讀不到試算表（' + res.status + '）');
      err.code = 'http';
      throw err;
    }
    const dishes = parseDictCsv(await res.text());
    const cache = readCache();
    cache[country] = { updatedAt: new Date().toISOString(), dishes: dishes, sourceUrl: url };
    writeCache(cache);
    return { country: country, dishes: dishes, updatedAt: cache[country].updatedAt, sample: false, cached: true };
  }

  function dishHits(dish, avoidList) {
    const avoid = new Set(avoidList || []);
    const hits = [];
    for (const ing of (dish && dish.ingredients) || []) {
      if (avoid.has(ing)) hits.push(ing);
      else if (avoid.has('不要辣') && (ing === '辣' || ing === '辣椒') && !hits.includes('辣')) hits.push('辣');
    }
    const spice = dish && dish.spice || '';
    if (avoid.has('不要辣') && spice && /辣/.test(spice) && !/不辣/.test(spice) && !hits.includes('辣')) hits.push('辣');
    return hits;
  }

  function isHan(s) { return /\p{Script=Han}/u.test(s); }

  // Tone-insensitive phrase check. Latin names must sit on a word boundary
  // so "Pho bo" hits "Phở bò" without also treating every short syllable as its own dish.
  function phraseHit(hay, needle) {
    if (!needle || needle.length < 2) return false;
    if (hay === needle) return true;
    if (isHan(needle)) return hay.includes(needle);
    let from = 0;
    while (from < hay.length) {
      const at = hay.indexOf(needle, from);
      if (at < 0) return false;
      const before = at === 0 || hay[at - 1] === ' ';
      const after = at + needle.length === hay.length || hay[at + needle.length] === ' ';
      if (before && after) return true;
      from = at + 1;
    }
    return false;
  }

  function nameLen(dish) {
    return Math.max(fold(dish.original).length, fold(dish.zh).length);
  }

  function matchLines(text, dishes) {
    const matched = [], seen = new Set(), unmatched = [];
    const list = Array.isArray(dishes) ? dishes : [];
    for (const raw of String(text || '').split(/\n+/)) {
      const line = raw.trim();
      const f = fold(line);
      if (f.length < 2) continue;
      const hits = list.filter(d => [d.original, d.zh].some(name => phraseHit(f, fold(name))));
      if (!hits.length) {
        if (!/^[\d\s.,:;|/\\+\-–—]+$/.test(line)) unmatched.push(line);
        continue;
      }
      const ranked = hits.slice().sort((a, b) => nameLen(b) - nameLen(a));
      const chosen = [];
      ranked.forEach(d => {
        const names = [fold(d.original), fold(d.zh)].filter(n => n.length >= 2);
        const covered = chosen.some(c => {
          const longer = [fold(c.original), fold(c.zh)];
          return names.some(n => longer.some(o => o.length > n.length && o.includes(n)));
        });
        if (!covered) chosen.push(d);
      });
      chosen.forEach(d => {
        if (!seen.has(d.original)) { seen.add(d.original); matched.push(d); }
      });
    }
    return { matched: matched, unmatched: unmatched };
  }

  // Preserve Vietnamese vowel distinctions: bơ (avocado) is NOT bò (beef).
  function vnKey(value) {
    return String(value||'').normalize('NFC').toLocaleLowerCase('vi')
      .replace(/[^\\p{L}\\p{N}\\s]/gu,' ').replace(/\\s+/g,' ').trim();
  }
  const VN_MENU = [
    ['kem bơ','酪梨冰淇淋'],['cafe nâu','越式奶咖啡'],['cà phê nâu','越式奶咖啡'],
    ['cafe đen','黑咖啡'],['cà phê đen','黑咖啡'],['cafe muối','鹽咖啡'],['cà phê muối','鹽咖啡'],
    ['bạc xỉu','越式牛奶咖啡'],['bac xiu','越式牛奶咖啡'],['nước ép','鮮榨果汁'],
    ['sinh tố','水果冰沙'],['táo dứa','蘋果鳳梨'],['cóc ổi','酸芒果與芭樂'],
    ['dứa ổi','鳳梨芭樂'],['cam táo','柳橙蘋果'],['cam dứa','柳橙鳳梨'],
    ['lê táo','梨子蘋果'],['lựu đào','石榴水蜜桃'],['chanh leo','百香果'],
    ['dưa hấu','西瓜'],['mãng cầu','釋迦'],['cà rốt','胡蘿蔔'],
    ['bưởi','柚子'],['xoài','芒果'],['dứa','鳳梨'],['táo','蘋果'],['đào','水蜜桃'],
    ['cóc','酸芒果'],['ổi','芭樂'],['lựu','石榴'],['cam','柳橙'],['bơ','酪梨'],
    ['bò','牛肉'],['heo','豬肉'],['gà','雞肉'],['tôm','蝦'],['cá','魚'],
    ['bún','米線'],['phở','河粉'],['mì','麵'],['cơm','飯'],['xào','炒'],['nướng','烤'],
    ['hành phi','油蔥酥'],['hành lá','蔥'],['rau mùi','香菜'],['dưa leo','黃瓜']
  ];
  const VN_MAP = new Map(VN_MENU.map(([v,zh])=>[vnKey(v),zh]));
  function explainLine(raw,dishes,country) {
    const original=String(raw||'').trim();
    const name=original.replace(/\\s+\\d[\\d.,]*\\s*(?:₫|đ|vnd|k)?\\s*$/i,'').trim();
    const key=vnKey(name);
    const list=Array.isArray(dishes)?dishes:[];
    // Curated exact names take precedence over tone-insensitive generic dictionary entries.
    if(country==='越南' && VN_MAP.has(key))return {original,zh:VN_MAP.get(key),status:'known',dish:null};
    const exact=list.find(d=>vnKey(d.original)===key);
    if(exact)return {original,zh:exact.zh,status:'known',dish:exact};
    if(country!=='越南')return {original,zh:'',status:'unknown',dish:null};
    const tokens=key.split(' '), used=new Set(),found=[];
    VN_MENU.slice().sort((a,b)=>vnKey(b[0]).split(' ').length-vnKey(a[0]).split(' ').length).forEach(([word,zh])=>{
      const parts=vnKey(word).split(' ');
      for(let i=0;i<=tokens.length-parts.length;i++){
        if(parts.every((p,j)=>tokens[i+j]===p&&!used.has(i+j))){
          parts.forEach((_,j)=>used.add(i+j));found.push({i,zh});break;
        }
      }
    });
    found.sort((a,b)=>a.i-b.i);
    // A lone common word within a long OCR line is not a trustworthy translation.
    if(!found.length || (tokens.length>3 && found.reduce((n,w)=>n+1,0)<2))
      return {original,zh:'',status:'unknown',dish:null};
    return {original,zh:found.map(w=>w.zh).join('・'),status:'guess',dish:null};
  }
  function isMenuCandidate(text, confidence, hasDish) {
    const s=String(text||'').trim();
    if(!s || s.length<2) return false;
    if(/(?:michelin|recommendations|restaurant|cuisine|gourmand|vat|thuế|tax|service charge|giá chưa|đơn vị|vnd|www\\.|https?:|copyright)/i.test(s)) return false;
    if(/^[^\\p{L}]*$/u.test(s)) return false;
    const letters=(s.match(/\\p{L}/gu)||[]).length;
    if(letters<2 || letters/s.length<.55) return false;
    if(!hasDish && Number.isFinite(confidence) && confidence<55) return false;
    if(!hasDish && /(?:[<>~^_=]|\\d{4}|[“”]{2})/.test(s)) return false;
    if(!hasDish && s.split(/\\s+/).length===1 && s.length<3) return false;
    return true;
  }
  function scanLineItems(text,dishes,country,lines) {
    const input=Array.isArray(lines)&&lines.length?lines:String(text||'').split(/\\n+/).map(text=>({text}));
    return input.map(line=>({...explainLine(line.text,dishes,country),bbox:line.bbox||null,confidence:line.confidence}))
      .filter(line=>isMenuCandidate(line.original,line.confidence,!!line.dish) && !!line.zh);
  }
  function ingredientStatus(dish,avoids) {
    if(!avoids||!avoids.length)return {state:'none',hits:[]};
    if(!dish)return {state:'unknown',hits:[]};
    const hits=dishHits(dish,avoids);
    return hits.length?{state:'contains',hits}:{state:'unknown',hits:[]};
  }

  function translateUrl(text) {
    return 'https://translate.google.com/?sl=auto&tl=zh-TW&text=' + encodeURIComponent(text) + '&op=translate';
  }

  function ocrLangFor(country) {
    return OCR_LANG[country] || (country ? 'eng' : 'vie');
  }

  let tessPromise = null, ocrWorker = null, ocrLang = '';
  function loadTesseract() {
    const g = root;
    if (g.Tesseract) return Promise.resolve(g.Tesseract);
    if (tessPromise) return tessPromise;
    tessPromise = new Promise((resolve, reject) => {
      const s = g.document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.async = true;
      s.onload = () => g.Tesseract ? resolve(g.Tesseract) : reject(new Error('辨識工具無法載入'));
      s.onerror = () => { tessPromise = null; reject(new Error('辨識工具無法載入，請連上網路後再掃描')); };
      g.document.head.appendChild(s);
    });
    return tessPromise;
  }

  function downscale(file) {
    return new Promise((resolve, reject) => {
      const img = new root.Image();
      const url = root.URL.createObjectURL(file);
      img.onload = () => {
        const max = 2200;
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = root.document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        root.URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => { root.URL.revokeObjectURL(url); reject(new Error('這張照片讀不起來')); };
      img.src = url;
    });
  }

  function cropCanvas(source, bounds) {
    const left = Math.min(70, Math.max(0, Number(bounds.left) || 0)) / 100;
    const right = Math.min(70, Math.max(0, Number(bounds.right) || 0)) / 100;
    const top = Math.min(70, Math.max(0, Number(bounds.top) || 0)) / 100;
    const bottom = Math.min(70, Math.max(0, Number(bounds.bottom) || 0)) / 100;
    const x = Math.round(source.width * left);
    const y = Math.round(source.height * top);
    const width = Math.max(1, Math.round(source.width * (1 - left - right)));
    const height = Math.max(1, Math.round(source.height * (1 - top - bottom)));
    const canvas = root.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(source, x, y, width, height, 0, 0, width, height);
    return canvas;
  }
  async function recognizeDetailed(canvas, lang) {
    const T = await loadTesseract();
    const useLang = lang === 'vie' ? 'vie+eng' : (lang || 'vie');
    if (!ocrWorker || ocrLang !== useLang) {
      if (ocrWorker) { try { await ocrWorker.terminate(); } catch (e) {} }
      ocrWorker = await T.createWorker(useLang, 1, { logger: function () {} });
      ocrLang = useLang;
    }
    const result = await ocrWorker.recognize(canvas, {}, { blocks: true });
    const data = result && result.data || {}, lines = [];
    function collect(nodes) {
      for(const n of nodes||[]) {
        if(Array.isArray(n.blocks)) collect(n.blocks);
        else if(Array.isArray(n.paragraphs)) collect(n.paragraphs);
        else if(Array.isArray(n.lines)) collect(n.lines);
        else if(n.text && n.bbox) lines.push({text:n.text.trim(),bbox:n.bbox,confidence:n.confidence});
      }
    }
    collect(data.blocks);
    if(!lines.length)collect(data.lines);
    return {text:data.text||'',lines,width:canvas.width,height:canvas.height};
  }
  async function recognize(canvas,lang) { return (await recognizeDetailed(canvas,lang)).text; }

  function fmtDictTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(+d)) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hh + ':' + mm;
  }

  function searchDishes(dishes, query) {
    const q = fold(query);
    if (!q) return dishes || [];
    return (dishes || []).filter(d => {
      if (fold(d.original).includes(q) || fold(d.zh).includes(q) || fold(d.desc).includes(q)) return true;
      if ((d.tags || []).some(t => fold(t).includes(q))) return true;
      if ((d.ingredients || []).some(t => fold(t).includes(q))) return true;
      return false;
    });
  }

  root.NanaFood = {
    DICT_COUNTRIES: DICT_COUNTRIES,
    DEFAULT_SHEETS: DEFAULT_SHEETS,
    fold: fold,
    parseDictCsv: parseDictCsv,
    bundledVietnam: bundledVietnam,
    readSheets: readSheets,
    writeSheets: writeSheets,
    readCache: readCache,
    sheetLink: sheetLink,
    sheetCsvUrl: sheetCsvUrl,
    packFromCache: packFromCache,
    refreshCountry: refreshCountry,
    dishHits: dishHits,
    matchLines: matchLines,
    translateUrl: translateUrl,
    ocrLangFor: ocrLangFor,
    loadTesseract: loadTesseract,
    downscale: downscale,
    cropCanvas: cropCanvas,
    recognize: recognize,
    recognizeDetailed: recognizeDetailed,
    scanLineItems: scanLineItems,
    ingredientStatus: ingredientStatus,
    fmtDictTime: fmtDictTime,
    searchDishes: searchDishes,
    ready: true
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
