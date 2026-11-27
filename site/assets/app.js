/* =========================================================
   1. 站点配置 —— 换品牌只改这里
   ========================================================= */
const SITE = { brand: "玲珑玉 Lyra-Jade", today: "2026-11-18", pageSize: 30 };

/* =========================================================
   2. 多语言文案
   ========================================================= */
const I18N = {
  zh:{searchOrAsk:"搜索解读",loginSignup:"登录 / 免费注册",syncHint:"收藏、阅读进度跨设备同步",navJiedu:"AI 解读",changelog:"进化日志",
    themeSystem:"跟随系统",themeLight:"浅色",themeDark:"深色",themeNote:"",styleTitle:"风格",styleVivid:"鲜明",styleVividNote:"彩色封面，默认",styleCoss:"简约",styleCossNote:"黑白灰，适合长读",sysNow:"现在是{x}",
    login:"登录",member:"会员",subscribe:"订阅",search:"搜索",submit:"投稿",podFeed:"播客订阅源",
    eyebrow:"AI 信息侦查员 · 每日更新",h1a:"AI 精华，",h1b:"讲到你懂。",
    stats:"只用一手来源 · 每个数字回查原文 · 讲透不注水 · 已解读 <b>{n}</b> 篇",
    qPh:"搜标题或标签，比如「语音」「Agent」",all:"全部",byTime:"按时间",byLane:"按栏目",
    featured:"今日精选",readFull:"读全文",min:"{n} 分钟",verified:"已核对",
    countLine:"最新解读 · 共 <b>{n}</b> 篇，按发布时间排",countFiltered:"「{c}」· 共 <b>{n}</b> 篇",countSearch:"搜索「{q}」· 找到 <b>{n}</b> 篇",
    today:"今天",yesterday:"昨天",md:"{m} 月 {d} 日",dayMeta:"{md} · {w} · {n} 篇",headAbove:"，头条在上面",
    weeks:["星期日","星期一","星期二","星期三","星期四","星期五","星期六"],
    loadMore:"加载更多",noMore:"已经到底了",empty:"没有找到相关解读，换个关键词试试",
    lanePieces:"{n} 篇",seeAll:"看全部",archive:"全部 {n} 篇目录 · 按月份",ym:"{y} 年 {m} 月",
    pod:"播客",
    nPapers:"论文精读",paperEyebrow:"论文精读 · 一篇讲透一篇",paperH1a:"把论文",paperH1b:"真正读懂。",paperStats:"有深度，也让普通人看得懂 · 已精读 <b>{n}</b> 篇",paperCount:"已精读 <b>{n}</b> 篇，最新的在前",
    topicsLabel:"专题",topicEyebrow:"专题 · 按厂商看",topicH1b:"专题",topicStats:"{sub} · 共 <b>{n}</b> 篇解读，按发布时间排",countTopic:"「{c}」专题 · 共 <b>{n}</b> 篇",topicEmpty:"这个专题还没有解读，有新发布会第一时间补上。",
    grpDaily:"每天更新",grpLearn:"关于",grpCoop:"开发者",nRss:"RSS 订阅",nHow:"AI 生成说明",nApi:"内容 API",
    nToday:"今天",nMember:"会员计划",nBrief:"我的日报",nWeekly:"周报",nTopics:"专题",nPodcast:"播客",nTut:"教程与课程",nIdeas:"灵感库",nStudio:"我们出品",nAbout:"关于我们",tagMember:"会员",tagNew:"新",
    subTitle:"别靠刷到。",subText:"用 RSS 订阅，新解读一发布就送到你的阅读器。",subBtn:"RSS 订阅",
    footTag:"每天替你读完全球 AI，再陪你把它用起来。",footMotto:"保持好奇，继续创造",
    signupFree:"注册（免费）",google:"用 Google 账号登录",orEmail:"或用邮箱",emailPh:"你的邮箱",pwdPh:"密码",magic:"邮箱收登录链接",noAccount:"没有账号？免费注册 →",redeem:"有激活码？直接兑换会员 →",signup:"注册",
    demo:"演示版：还没接入后端",todo:"演示版：这个栏目还没搭建",
    searchPh:"搜索标题、厂商或栏目…",kNav:"选择",kOpen:"打开",kClose:"关闭",sArticles:"解读",sAsk:"问 AI 助手",
    askStub:"接入 AI 后，这里会基于站内全部解读直接回答「{q}」，并附上引用的文章。",recent:"最近更新",
    back:"返回 AI 解读",srcTitle:"已核对来源",related:"继续读",
    bodyH1:"发生了什么",bodyH2:"为什么值得关注",bodyH3:"怎么用起来",
    bodyP:"（示例正文）这里是文章正文的占位内容。接入 CMS 或 Markdown 文件后，会显示完整的解读：先用一两段讲清楚事情本身，再拆开关键数字和对比，最后给出普通人能直接上手的做法。",
    srcItems:["官方公告 / 发布博客","论文或技术报告原文","独立评测与第三方数据"]},
  en:{searchOrAsk:"Search explainers",loginSignup:"Log in / Sign up free",syncHint:"Sync bookmarks and progress across devices",navJiedu:"AI Explained",changelog:"Changelog",
    themeSystem:"System",themeLight:"Light",themeDark:"Dark",themeNote:"",styleTitle:"Style",styleVivid:"Vivid",styleVividNote:"Color covers, default",styleCoss:"Minimal",styleCossNote:"Black and white, easy on long reads",sysNow:"Currently {x}",
    login:"Log in",member:"Membership",subscribe:"Subscribe",search:"Search",submit:"Submit",podFeed:"Podcast feed",
    eyebrow:"Your AI scout · Updated daily",h1a:"The best of AI, ",h1b:"made clear.",
    stats:"Primary sources only · Every number checked against the original · No fluff · <b>{n}</b> explainers",
    qPh:"Search titles or tags, e.g. \"voice\", \"agent\"",all:"All",byTime:"By date",byLane:"By section",
    featured:"Today's pick",readFull:"Read",min:"{n} min",verified:"Checked",
    countLine:"Latest · <b>{n}</b> explainers, newest first",countFiltered:"\"{c}\" · <b>{n}</b> explainers",countSearch:"\"{q}\" · <b>{n}</b> results",
    today:"Today",yesterday:"Yesterday",md:"{mon} {d}",dayMeta:"{md} · {w} · {n}",headAbove:", top story above",
    weeks:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    loadMore:"Load more",noMore:"That's everything",empty:"Nothing found. Try another keyword.",
    lanePieces:"{n}",seeAll:"See all",archive:"All {n} explainers · by month",ym:"{mon} {y}",
    pod:"Podcast",
    nPapers:"Paper deep dives",paperEyebrow:"Paper deep dives · one paper at a time",paperH1a:"Papers, ",paperH1b:"truly understood.",paperStats:"In depth, in plain language · <b>{n}</b> explained so far",paperCount:"<b>{n}</b> explained, newest first",
    topicsLabel:"Topics",topicEyebrow:"Topic · by company",topicH1b:"explained",topicStats:"{sub} · <b>{n}</b> explainers, newest first",countTopic:"{c} · <b>{n}</b> explainers",topicEmpty:"No explainers on this topic yet. We'll cover the next release as soon as it lands.",
    grpDaily:"Daily",grpLearn:"About",grpCoop:"Developers",nRss:"RSS feed",nHow:"How we use AI",nApi:"Content API",
    nToday:"Today",nMember:"Membership",nBrief:"My brief",nWeekly:"Weekly",nTopics:"Topics",nPodcast:"Podcast",nTut:"Tutorials",nIdeas:"Idea library",nStudio:"Our projects",nAbout:"About us",tagMember:"Pro",tagNew:"New",
    subTitle:"Don't leave it to the feed.",subText:"Subscribe with RSS and new explainers land in your reader as soon as they're published.",subBtn:"RSS feed",
    footTag:"We read the world's AI news every day, then help you put it to work.",footMotto:"Stay curious, keep creating",
    signupFree:"Sign up (free)",google:"Continue with Google",orEmail:"or use email",emailPh:"Your email",pwdPh:"Password",magic:"Email me a login link",noAccount:"No account? Sign up free →",redeem:"Have a code? Redeem membership →",signup:"Sign up",
    demo:"Demo: backend not connected yet",todo:"Demo: this section isn't built yet",
    searchPh:"Search titles, companies or sections…",kNav:"navigate",kOpen:"open",kClose:"close",sArticles:"Explainers",sAsk:"Ask AI",
    askStub:"",recent:"Recently published",
    back:"Back to AI Explained",srcTitle:"Sources checked",related:"Keep reading",
    bodyH1:"What happened",bodyH2:"Why it matters",bodyH3:"How to use it",
    bodyP:"",
    srcItems:["Official announcement / blog","Original paper or tech report","Independent benchmarks and third-party data"]},
  ja:{searchOrAsk:"検索、または AI に質問",loginSignup:"ログイン / 無料登録",syncHint:"ブックマークと進捗をデバイス間で同期",navJiedu:"AI 解説",changelog:"更新履歴",
    themeSystem:"システムに従う",themeLight:"ライト",themeDark:"ダーク",themeNote:"記事ページでは右下の Aa から読書テーマを変更できます",sysNow:"現在：{x}",
    login:"ログイン",member:"メンバー",subscribe:"購読",search:"検索",submit:"投稿",podFeed:"ポッドキャスト配信",
    eyebrow:"AI 情報スカウト · 毎日更新",h1a:"AI のエッセンスを、",h1b:"わかるまで。",
    stats:"出典確認済み · 中英日で同時更新 · 解説 <b>{a}</b> 本、実践 <b>{b}</b> 本",
    qPh:"タイトルやタグで検索（例：音声、Agent）",all:"すべて",byTime:"新着順",byLane:"カテゴリ別",
    featured:"今日のピックアップ",readFull:"全文を読む",min:"{n} 分",verified:"確認済み",
    countLine:"最新の解説 · 全 <b>{n}</b> 本",countFiltered:"「{c}」· <b>{n}</b> 本",countSearch:"「{q}」· <b>{n}</b> 件",
    today:"今日",yesterday:"昨日",md:"{m} 月 {d} 日",dayMeta:"{md} · {w} · {n} 本",headAbove:"、トップは上に",
    weeks:["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"],
    loadMore:"もっと見る",noMore:"これで全部です",empty:"見つかりませんでした。別のキーワードでお試しください",
    lanePieces:"{n} 本",seeAll:"すべて見る",archive:"全 {n} 本の目次 · 月別",ym:"{y} 年 {m} 月",
    pod:"ポッドキャスト",
    grpDaily:"毎日更新",grpLearn:"学ぶ・作る",grpCoop:"お問い合わせ",
    nToday:"今日",nMember:"メンバープラン",nBrief:"マイ日報",nWeekly:"週報",nTopics:"特集",nPodcast:"ポッドキャスト",nTut:"チュートリアル",nIdeas:"アイデア集",nStudio:"制作物",nAbout:"私たちについて",tagMember:"会員",tagNew:"新",
    subTitle:"流し見に頼らない。",subText:"毎晩届く解説日報で、その日の新着をまとめてチェック。",subBtn:"無料で購読",
    footTag:"世界の AI を毎日読み、使えるところまで伴走します。",footMotto:"好奇心を持ち、創り続けよう",
    signupFree:"登録（無料）",google:"Google でログイン",orEmail:"またはメールで",emailPh:"メールアドレス",pwdPh:"パスワード",magic:"ログインリンクをメールで受け取る",noAccount:"アカウントがない？無料登録 →",redeem:"コードをお持ちの方 →",signup:"登録",
    demo:"デモ版：バックエンド未接続",todo:"デモ版：このページは準備中です",
    searchPh:"記事を検索、または質問…",kNav:"選択",kOpen:"開く",kClose:"閉じる",sArticles:"解説",sAsk:"AI に質問",
    askStub:"AI を接続すると、サイト内の全記事をもとに「{q}」に回答し、引用記事も表示します。",recent:"最近の更新",
    back:"AI 解説に戻る",srcTitle:"確認済みの出典",related:"続けて読む",
    bodyH1:"何が起きたか",bodyH2:"なぜ注目すべきか",bodyH3:"どう使うか",
    bodyP:"（サンプル本文）ここは本文のプレースホルダーです。CMS や Markdown を接続すると全文が表示されます。",
    srcItems:["公式発表 / ブログ","論文・技術レポート原文","第三者ベンチマーク"]}
};
const MON_EN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* 栏目定义：key、三语名称、封面主色相 */
const CATS = [
  {k:"product", zh:"产品发布", en:"Launches", ja:"新製品", hue:158},
  {k:"research",zh:"研究解读", en:"Research", ja:"研究解説", hue:220},
  {k:"deep",    zh:"深度",     en:"Deep dives",ja:"深掘り", hue:30},
  {k:"biz",     zh:"商业动态", en:"Business", ja:"ビジネス", hue:300},
  {k:"howto",   zh:"AI 实操",  en:"How-to",   ja:"AI 実践", hue:265},
  {k:"visual",  zh:"商业视觉实战",en:"Visual work",ja:"ビジュアル実践",hue:15},
  {k:"insight", zh:"洞察",     en:"Insights", ja:"インサイト",hue:190},
  {k:"paper",   zh:"论文精读", en:"Paper deep dives", ja:"論文精読", hue:48},
  {k:"other",   zh:"其他",     en:"Other",    ja:"その他", hue:95}
];
const HANDS_ON = new Set(["howto","visual"]); // 计入「实操库」的栏目

/* 侧栏 / 页脚导航：只放已经做好的页面；会员、日报、播客等做好后再加回来 */
const NAV = [
  {g:"grpDaily"},{t:"navJiedu",i:"book",on:true},{t:"nPapers",i:"cap",href:"papers.html",sec:"paper"},{t:"nRss",i:"rss",href:"rss.xml"},
  {g:"grpLearn"},{t:"nAbout",ava:true,href:"about.html"},{t:"nHow",i:"info",href:"about.html#ai"},
  {g:"grpCoop"},{t:"nApi",i:"code",href:"api/v1/articles.json",root:true}
];
const FOOT = { fDaily:[["navJiedu"],["nRss","rss.xml"]], fLearn:[["nAbout","about.html"],["nHow","about.html#ai"]], fCoop:[["nApi","api/v1/articles.json",true]] };

/* =========================================================
   3. 数据：由 build.mjs 注入 window.SITE_DATA
   ========================================================= */
const DATA = window.SITE_DATA || {articles:[], today:new Date().toISOString().slice(0,10)};
const BASE = window.SITE_BASE || "./";            /* 到网站根目录：资源、API */
const HOME = window.SITE_HOME || BASE;             /* 到本语言首页所在目录：首页、文章、关于、RSS */
SITE.today = DATA.today || SITE.today;
const ARTICLES = DATA.articles || [];
const TOPICS = DATA.topics || [];                    /* 专题（Claude、OpenAI、Gemini、Grok……），见 scripts/lib/topics.mjs */
const TOPIC = TOPICS.find(t=>t.k===DATA.topic) || null; /* 在专题页上：只看这个专题 */
const SECTION = DATA.section || null;                /* 在论文精读页上：只看论文精读 */
const NEWS = ARTICLES.filter(a=>a.cat!=="paper");    /* 论文精读只在论文精读页出现，首页（AI 解读）和专题页都不放 */
const POOL = TOPIC ? NEWS.filter(a=>(a.tp||[]).includes(TOPIC.k)) : SECTION ? ARTICLES.filter(a=>a.cat===SECTION) : NEWS;
const FEATURED = TOPIC || SECTION ? null : (NEWS.find(a=>a.slug===DATA.featured) || NEWS[0] || null);
const LIST = !!document.getElementById("feed");          // 列表页才有
const artUrl = a => `${HOME}a/${a.slug}.html`;

/* =========================================================
   4. 状态与工具
   ========================================================= */
const S = { lang:window.SITE_LANG==="en"?"en":"zh", cat:"all", view:"time", q:"", shown:SITE.pageSize, theme:document.documentElement.dataset.themeDefault||"dark", style:"vivid" };
try{ Object.assign(S, JSON.parse(localStorage.getItem("wg-prefs")||"{}")); S.q=""; S.shown=SITE.pageSize; S.cat="all"; }catch(e){}
S.lang=window.SITE_LANG==="en"?"en":"zh"; // 语言跟着页面走：中文在根目录，英文在 en/ 下
const save=()=>{try{localStorage.setItem("wg-prefs",JSON.stringify({lang:S.lang,view:S.view,theme:S.theme,style:S.style}))}catch(e){}};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const t=(k,v={})=>{let s=(I18N[S.lang][k]??I18N.zh[k]??k);if(typeof s==="string")for(const x in v)s=s.replaceAll(`{${x}}`,v[x]);return s};
const catName=k=>{const c=CATS.find(c=>c.k===k);return c?c[S.lang]:k};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const icon=n=>`<svg class="i"><use href="#i-${n}"/></svg>`;
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2200)}

function mdLabel(iso){const[y,m,d]=iso.split("-").map(Number);return S.lang==="en"?t("md",{mon:MON_EN[m-1],d}):t("md",{m,d})}
function short(iso){return iso.slice(5)}
function fmtDate(d){return d.toISOString().slice(0,10)}

/* 生成式封面：根据文章随机生成配色和版式，替换成真实图片时改这里 */
function cover(a){
  if(a.cv){ /* 按内容生成的封面：版式、配图在构建时定好，这里只上色 */
    const {html,layout,hue,light}=a.cv;
    const bg=light?`linear-gradient(160deg,hsl(${hue} 45% 97%),hsl(${hue} 32% 90%))`:`linear-gradient(150deg,hsl(${hue} 38% 14%),hsl(${(hue+28)%360} 42% 7%))`;
    const acc=light?`hsl(${hue} 70% 38%)`:`hsl(${hue} 85% 68%)`;
    const glow=`hsl(${hue} 80% ${light?82:38}% / .5)`;
    return `<div class="cover cv cv-${layout}${light?" light":""}" style="--cbg:${bg};--cacc:${acc};--cglow:${glow}">${html}</div>`;
  }
  const c=CATS.find(c=>c.k===a.cat)||CATS[0], hue=(c.hue+a.h%40-20+360)%360;
  const light=a.v===3;
  const bg=light?`linear-gradient(160deg,hsl(${hue} 40% 96%),hsl(${hue} 30% 90%))`:`linear-gradient(150deg,hsl(${hue} 35% 13%),hsl(${(hue+30)%360} 40% 7%))`;
  const acc=light?`hsl(${hue} 65% 42%)`:`hsl(${hue} 85% 68%)`;
  const glow=`hsl(${hue} 80% ${light?80:35}% / .55)`;
  const head=a.title.split(/[：:]/)[0];
  const tail=(a.title.split(/[：:]/)[1]||"").split(/[，,]/)[0];
  const num=(a.title.match(/[\d.]+\s*(倍|%|万|亿|秒|B)?/)||[""])[0];
  let deco="";
  if(a.v===0&&num) deco=`<div class="cbig">${esc(num)}</div>`;
  else if(a.v===1) deco=`<div class="bars"><i style="width:${60+a.h%35}%"></i><i style="width:${35+a.h%30}%"></i><i style="width:${15+a.h%20}%"></i></div>`;
  else if(a.v===2){let w="";for(let i=0;i<34;i++)w+=`<i style="height:${15+Math.abs(Math.sin(i*0.7+a.h))*85}%"></i>`;deco=`<div class="wave">${w}</div>`}
  else deco=`<div class="ring"></div>`;
  return `<div class="cover${light?" light":""}" style="--cbg:${bg};--cacc:${acc};--cglow:${glow}">
    <div><div class="ck">${esc(a.co)} · ${esc(catName(a.cat))}</div></div>
    <div><div class="ch">${esc(head.length>22?head.slice(0,22)+"…":head)}${tail?`<br><b>${esc(tail.slice(0,16))}</b>`:""}</div>${deco}</div>
  </div>`;
}

function card(a){
  return `<article class="card" data-id="${a.id}" data-href="${artUrl(a)}" tabindex="0">
    ${cover(a)}
    <div class="meta"><span>${t("min",{n:a.min})}</span><i></i><time datetime="${a.date}">${short(a.date)}</time></div>
    <h3>${esc(a.title)}</h3>
    ${a.pod?`<span class="pod">${icon("play")}${t("pod")} · ${a.pod}</span>`:""}
  </article>`;
}

/* =========================================================
   5. 渲染
   ========================================================= */
function filtered(){
  const q=S.q.trim().toLowerCase();
  return POOL.filter(a=>(S.cat==="all"||a.cat===S.cat)&&(!q||a.title.toLowerCase().includes(q)||catName(a.cat).toLowerCase().includes(q)||a.co.toLowerCase().includes(q)));
}

function renderStatic(){
  document.documentElement.lang={zh:"zh-CN",en:"en",ja:"ja"}[S.lang];
  $$("[data-t]").forEach(el=>el.textContent=t(el.dataset.t));
  $$("[data-ph]").forEach(el=>el.placeholder=t(el.dataset.ph));
  if(LIST)$("#q").placeholder=t("qPh");
  $$(".lang button").forEach(b=>b.classList.toggle("on",b.dataset.lang===S.lang));
  if(LIST)$("#heroStats").innerHTML=TOPIC?t("topicStats",{sub:esc(TOPIC.sub),n:POOL.length}):t("stats",{n:NEWS.length});
  if(LIST&&SECTION){$("[data-t=eyebrow]").textContent=t("paperEyebrow");$("[data-t=h1a]").textContent=t("paperH1a");$("[data-t=h1b]").textContent=t("paperH1b");$("#heroStats").innerHTML=t("paperStats",{n:POOL.length})}
  if(LIST&&TOPIC){$("[data-t=eyebrow]").textContent=t("topicEyebrow");$("[data-t=h1a]").textContent=TOPIC.name+" ";$("[data-t=h1b]").textContent=t("topicH1b")}
  // 专题条：链接到各专题页（专题页有自己的网址，方便分享和收藏）
  if(LIST&&SECTION){$("#topicBar")?.remove();$(".listing").classList.add("section-"+SECTION)}
  if(LIST&&!SECTION)$("#topicBar").innerHTML=`<span class="topics-h">${t("topicsLabel")}</span><div class="chips">`+
    `<a class="chip" href="${HOME}index.html" aria-pressed="${!TOPIC}">${t("all")}</a>`+
    TOPICS.map(x=>`<a class="chip" href="${HOME}t/${x.k}.html" aria-pressed="${TOPIC?.k===x.k}">${esc(x.name)}<span>${x.n}</span></a>`).join("")+`</div>`;
  // 侧栏
  $("#sideNav").innerHTML=NAV.map(n=>n.g?`<div class="side-group">${t(n.g)}</div>`:
    `<a href="${n.href?(n.root?BASE:HOME)+n.href:HOME+"index.html"}" class="${(n.on&&LIST&&!TOPIC&&!SECTION)||(n.sec&&n.sec===SECTION)?"on":""}" ${n.href?"":"data-home"}>${n.ava?`<img class="ava ava-img" src="${BASE}assets/brand/lyra-jade-emblem-160.webp" alt="">`:icon(n.i)}<span>${t(n.t)}</span></a>`+
    (n.t==="nRss"&&TOPICS.length?`<div class="side-group">${t("topicsLabel")}</div>`+TOPICS.map(x=>`<a href="${HOME}t/${x.k}.html" class="side-tp ${TOPIC?.k===x.k?"on":""}"><span class="tp-mark">${esc(x.name.slice(0,1))}</span><span>${esc(x.name)}</span><small>${x.n||""}</small></a>`).join(""):"")).join("")+
    `<div class="sub-card"><strong>${t("subTitle")}</strong><p>${t("subText")}</p><a class="btn btn-light btn-block" href="${HOME}rss.xml">${t("subBtn")}</a></div>`;
  // 页脚
  const li=arr=>arr.map(([k,h,root])=>`<li><a href="${h?(root?BASE:HOME)+h:HOME+"index.html"}" ${h?"":"data-home"}>${t(k)}</a></li>`).join("");
  for(const id in FOOT) $("#"+id).innerHTML=li(FOOT[id]);
  // 栏目筛选
  const cnt=k=>POOL.filter(a=>a.cat===k).length;
  if(LIST)$("#chips").innerHTML=`<button class="chip" data-cat="all" aria-pressed="${S.cat==="all"}">${t("all")}</button>`+
    CATS.filter(c=>cnt(c.k)>0).map(c=>`<button class="chip" data-cat="${c.k}" aria-pressed="${S.cat===c.k}">${c[S.lang]}<span>${cnt(c.k)}</span></button>`).join("");
  $$(".seg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===S.view));
  // 主题菜单
  $$("#themeMenu [data-theme]").forEach(b=>b.classList.toggle("on",b.dataset.theme===S.theme));
  $$("#themeMenu [data-style]").forEach(b=>b.classList.toggle("on",b.dataset.style===S.style));
  $("#sysNow").textContent=t("sysNow",{x:matchMedia("(prefers-color-scheme: dark)").matches?t("themeDark"):t("themeLight")});
}

function renderFeatured(){
  const show=!!FEATURED&&S.cat==="all"&&!S.q;
  $("#featBox").innerHTML=show?`<div class="label">${t("featured")}</div>
  <section class="feat">
    <div>
      <div class="tags"><span class="tag">${catName(FEATURED.cat)}</span>${FEATURED.verified?`<span class="verified">${icon("check")}${t("verified")}</span>`:""}<span class="mono muted">№ ${FEATURED.no??""} · ${esc(FEATURED.co)}</span></div>
      <h2><a href="${artUrl(FEATURED)}">${esc(FEATURED.title)}</a></h2>
      <p>${esc(FEATURED.summary)}</p>
      <div class="row"><a class="btn btn-light" href="${artUrl(FEATURED)}">${t("readFull")}</a><span>${short(FEATURED.date)} · ${t("min",{n:FEATURED.min})}</span></div>
    </div>
    <a href="${artUrl(FEATURED)}" tabindex="-1">${cover(FEATURED)}</a>
  </section>`:"";
}

function renderTime(list){
  const head = S.q?t("countSearch",{q:esc(S.q),n:list.length}):S.cat!=="all"?t("countFiltered",{c:catName(S.cat),n:list.length}):TOPIC?t("countTopic",{c:esc(TOPIC.name),n:list.length}):SECTION?t("paperCount",{n:list.length}):t("countLine",{n:list.length});
  if(!list.length) return `<p class="count-line">${head}</p><div class="empty">${TOPIC&&!S.q&&S.cat==="all"?t("topicEmpty"):t("empty")}</div>`;
  const vis=list.slice(0,S.shown).filter(a=>!(FEATURED&&S.cat==="all"&&!S.q&&a.id===FEATURED.id));
  const groups=[];vis.forEach(a=>{const g=groups.at(-1);g&&g.date===a.date?g.items.push(a):groups.push({date:a.date,items:[a]})});
  const total=d=>list.filter(a=>a.date===d).length;
  const td=new Date(SITE.today+"T12:00:00Z"); const yd=new Date(td); yd.setUTCDate(yd.getUTCDate()-1);
  let html=`<p class="count-line">${head}</p>`;
  for(const g of groups){
    const dd=new Date(g.date+"T12:00:00Z");
    const name=g.date===SITE.today?t("today"):g.date===fmtDate(yd)?t("yesterday"):mdLabel(g.date);
    const hasFeat=!!FEATURED&&S.cat==="all"&&!S.q&&g.date===FEATURED.date;
    html+=`<section class="day"><h2 class="day-h"><strong>${name}</strong><small>${t("dayMeta",{md:short(g.date),w:t("weeks")[dd.getUTCDay()],n:total(g.date)})}${hasFeat?t("headAbove"):""}</small></h2>
      <div class="grid">${g.items.map(card).join("")}</div></section>`;
  }
  html+=`<div class="more">${S.shown<list.length?`<button class="btn btn-ghost" id="loadMore">${t("loadMore")}</button>`:`<span class="muted">${t("noMore")}</span>`}</div>`;
  return html;
}

function renderLanes(list){
  if(!list.length) return `<div class="empty">${t("empty")}</div>`;
  const cats=S.cat==="all"?CATS:CATS.filter(c=>c.k===S.cat);
  return cats.map(c=>{
    const items=list.filter(a=>a.cat===c.k); if(!items.length) return "";
    return `<section class="lane"><div class="lane-h"><strong>${c[S.lang]}</strong><small>${t("lanePieces",{n:items.length})}</small><span class="sp"></span>
      <button class="round" data-scroll="-1" aria-label="上一组">${icon("chev-l")}</button><button class="round" data-scroll="1" aria-label="下一组">${icon("chev-r")}</button>
      <a href="#" class="all" data-cat-all="${c.k}">${t("seeAll")}</a></div>
      <div class="track">${items.slice(0,16).map(card).join("")}</div></section>`;
  }).join("");
}

function renderArchive(){
  $("#archTitle").textContent=t("archive",{n:POOL.length});
  if(!$("#archive").open){$("#archBody").innerHTML="";return}
  const months={};POOL.forEach(a=>{(months[a.date.slice(0,7)]??=[]).push(a)});
  $("#archBody").innerHTML=Object.entries(months).map(([ym,items])=>{
    const[y,m]=ym.split("-").map(Number);
    return `<div class="month"><h4>${S.lang==="en"?t("ym",{mon:MON_EN[m-1],y}):t("ym",{y,m})}<small>${t("lanePieces",{n:items.length})}</small></h4>
      <div class="toc">${items.map(a=>`<a href="${artUrl(a)}"><span>${short(a.date)}</span><span>${esc(a.title)}</span><span>${catName(a.cat)}</span></a>`).join("")}</div></div>`;
  }).join("");
}

function renderFeed(){
  const list=filtered();
  renderFeatured();
  $("#feed").innerHTML=S.view==="time"?renderTime(list):renderLanes(list);
}

function renderAll(){renderStatic();if(LIST){renderFeed();renderArchive()}}

/* =========================================================
   6. 主题
   ========================================================= */
/* 风格：鲜明（默认）或简约（coss ui 风格，规则在 assets/themes/coss.css，限定在 html.style-coss 下） */
const STYLE_FONTS="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap";
function applyStyle(){
  const on=S.style==="coss";
  document.documentElement.classList.toggle("style-coss",on);
  if(on&&!document.querySelector(`link[href="${STYLE_FONTS}"]`)){const l=document.createElement("link");l.rel="stylesheet";l.href=STYLE_FONTS;document.head.appendChild(l)}
}
function applyTheme(){
  const dark=S.theme==="dark"||(S.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark",dark);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{applyTheme();renderStatic()});

/* =========================================================
   7. 搜索弹窗（⌘K）
   ========================================================= */
let sAct=0;
function renderSearch(){
  const q=$("#sq").value.trim(), ql=q.toLowerCase();
  const hits=(q?ARTICLES.filter(a=>a.title.toLowerCase().includes(ql)||a.co.toLowerCase().includes(ql)||catName(a.cat).toLowerCase().includes(ql)):ARTICLES).slice(0,8);
  const hl=s=>q?esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),m=>`<mark>${m}</mark>`):esc(s);
  sAct=Math.min(sAct,Math.max(hits.length-1,0));
  $("#sres").innerHTML=`<div class="grp">${q?t("sArticles"):t("recent")}</div>`+
    (hits.length?hits.map((a,i)=>`<a href="${artUrl(a)}" class="${i===sAct?"act":""}"><span class="tag">${catName(a.cat)}</span><span class="t">${hl(a.title)}</span><span class="muted mono" style="font-size:11px">${short(a.date)}</span></a>`).join(""):`<div class="empty" style="padding:24px">${t("empty")}</div>`);
}
function openSearch(){closeAll();$("#searchScrim").classList.add("show");$("#sq").value="";sAct=0;renderSearch();setTimeout(()=>$("#sq").focus(),20)}
function closeAll(){$$(".scrim").forEach(s=>s.classList.remove("show"));$("#themeMenu").classList.remove("show")}

/* =========================================================
   8. 事件
   ========================================================= */
/* 分享：手机（触屏）上用系统分享面板，里面有微信、X 等；电脑上展开菜单（X、复制链接、微信扫码） */
document.addEventListener("click",e=>{
  const open=e.target.closest("[data-share-open]"), box=e.target.closest("[data-share]");
  if(!box) $$(".share.open").forEach(s=>{s.classList.remove("open");s.querySelector("[data-share-open]").setAttribute("aria-expanded","false")});
  if(open){
    const d=box.dataset;
    if(navigator.share&&matchMedia("(pointer:coarse)").matches){navigator.share({title:d.title,text:d.text,url:d.url}).catch(()=>{});return}
    $$(".share.open").forEach(s=>{if(s!==box)s.classList.remove("open")});
    const on=box.classList.toggle("open");open.setAttribute("aria-expanded",on);return;
  }
  if(e.target.closest("[data-share-copy]")){
    const d=box.dataset, txt=`${d.title} ${d.url}`;
    const done=()=>{toast(S.lang==="en"?"Link copied":"链接已复制");box.classList.remove("open")};
    (navigator.clipboard?.writeText(txt)||Promise.reject()).then(done).catch(()=>{const t=document.createElement("textarea");t.value=txt;document.body.appendChild(t);t.select();try{document.execCommand("copy");done()}catch(_){}t.remove()});
  }
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$$(".share.open").forEach(s=>s.classList.remove("open"))});

document.addEventListener("click",e=>{
  const el=e.target.closest("[data-cat],[data-view],[data-lang],[data-theme],[data-style],[data-open-search],[data-open-login],[data-subscribe],[data-todo],[data-home],[data-fake],[data-close],[data-tab],[data-tabto],[data-scroll],[data-cat-all],[data-goto],#loadMore,.card,#themeBtn");
  if(!e.target.closest(".theme-wrap")) $("#themeMenu").classList.remove("show");
  if(!el) return;
  const d=el.dataset;
  if(el.classList.contains("card")){location.href=el.dataset.href;return}
  if(el.id==="themeBtn"){$("#themeMenu").classList.toggle("show");return}
  if(el.id==="loadMore"){S.shown+=SITE.pageSize;renderFeed();return}
  e.preventDefault?.();
  if(d.cat){S.cat=d.cat;S.shown=SITE.pageSize;renderStatic();renderFeed();return}
  if(d.catAll){S.cat=d.catAll;S.view="time";S.shown=SITE.pageSize;save();renderStatic();renderFeed();$(".filters").scrollIntoView({behavior:"smooth"});return}
  if(d.view){S.view=d.view;save();renderStatic();renderFeed();return}
  if(d.lang){S.lang=d.lang;save();renderAll();return}
  if(d.theme){S.theme=d.theme;save();applyTheme();renderStatic();return}
  if(d.style){S.style=d.style;save();applyStyle();renderStatic();return}
  if("openSearch" in d){openSearch();return}
  if("subscribe" in d){toast(t("demo"));return}
  if("todo" in d){toast(t("todo"));return}
  if("close" in d){closeAll();return}
  if(d.goto){document.getElementById(d.goto)?.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(d.scroll){const tr=el.closest(".lane").querySelector(".track");tr.scrollBy({left:tr.clientWidth*.9*(+d.scroll)});return}
  if("home" in d){if(!LIST||TOPIC||SECTION){location.href=HOME+"index.html";return}  /* 只有首页本身才原地回到顶部；论文精读页、专题页要真的跳回首页 */window.scrollTo({top:0,behavior:"smooth"});document.body.classList.remove("side-open");return}
});
document.addEventListener("keydown",e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openSearch();return}
  if(e.key==="Escape"){closeAll();document.body.classList.remove("side-open");return}
  if(e.key==="Enter"&&e.target.classList?.contains("card")){location.href=e.target.dataset.href}
  if($("#searchScrim").classList.contains("show")){
    const items=$$("#sres a");
    if(e.key==="ArrowDown"){e.preventDefault();sAct=Math.min(sAct+1,items.length-1);items.forEach((a,i)=>a.classList.toggle("act",i===sAct));items[sAct]?.scrollIntoView({block:"nearest"})}
    if(e.key==="ArrowUp"){e.preventDefault();sAct=Math.max(sAct-1,0);items.forEach((a,i)=>a.classList.toggle("act",i===sAct));items[sAct]?.scrollIntoView({block:"nearest"})}
    if(e.key==="Enter"&&items[sAct]){e.preventDefault();location.href=items[sAct].getAttribute("href");closeAll()}
  }
});
$$(".scrim").forEach(s=>s.addEventListener("click",e=>{if(e.target===s)closeAll()}));
$("#sres").addEventListener("click",e=>{if(e.target.closest("a"))closeAll()});
$("#sq").addEventListener("input",()=>{sAct=0;renderSearch()});
let qT;if(LIST)$("#q").addEventListener("input",e=>{clearTimeout(qT);qT=setTimeout(()=>{S.q=e.target.value;S.shown=SITE.pageSize;renderFeed()},120)});
if(LIST)$("#archive").addEventListener("toggle",renderArchive);
$("#closeSide").addEventListener("click",()=>{if(innerWidth<=860)document.body.classList.remove("side-open");else document.body.classList.add("side-off")});
$("#openSide").addEventListener("click",()=>{if(innerWidth<=860)document.body.classList.add("side-open");else document.body.classList.remove("side-off")});
$("#sideScrim").addEventListener("click",()=>document.body.classList.remove("side-open"));
$("#toTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
addEventListener("scroll",()=>$("#toTop").classList.toggle("show",scrollY>900),{passive:true});

/* 启动 */
applyTheme();
applyStyle();
renderAll();

/* 小白版的连接线：宽屏时旁注在正文左侧空白，从每条旁注画一条线连到它解释的那一块（合并的卡里每一条各连一根）；悬停时高亮这一对 */
(function(){
  const wraps=$$(".pl-wrap"),reader=$("#reader");if(!wraps.length||!reader)return;
  const mq=matchMedia("(min-width:1560px)"),NS="http://www.w3.org/2000/svg";
  let layer;
  const pairs=()=>wraps.map(w=>{
    const id=w.dataset.pl,blk=[...w.children].find(x=>!x.matches(".plain"));
    const note=w.classList.contains("pl-grouped")?$(`.pl-item[data-pl="${id}"]`):w.querySelector(":scope>.plain");
    return{id,w,blk,note};
  }).filter(x=>x.blk&&x.note);
  function draw(){
    layer?.remove();layer=null;
    if(!mq.matches)return;
    const R=reader.getBoundingClientRect();
    layer=document.createElementNS(NS,"svg");layer.setAttribute("class","pl-layer");layer.setAttribute("aria-hidden","true");
    let html="";
    pairs().forEach(({id,blk,note})=>{
      const card=note.closest(".plain")||note,C=card.getBoundingClientRect(),N=note.getBoundingClientRect(),B=blk.getBoundingClientRect();
      if(!N.height||!B.height)return;
      const x1=C.right-R.left,y1=N.top-R.top+(note===card?22:16),x2=B.left-R.left,y2=B.top-R.top+Math.min(26,B.height/2),dx=x2-x1;
      if(dx<8)return;
      html+=`<g data-pl="${id}"><path d="M${x1} ${y1} C${x1+dx*.55} ${y1} ${x2-dx*.45} ${y2} ${x2-4} ${y2}"/><circle cx="${x1+3}" cy="${y1}" r="3"/><circle cx="${x2-4}" cy="${y2}" r="4"/></g>`;
    });
    layer.innerHTML=html;reader.appendChild(layer);
  }
  function hot(id,on){
    layer?.querySelector(`g[data-pl="${id}"]`)?.classList.toggle("hot",on);
    const w=$(`.pl-wrap[data-pl="${id}"]`);w?.classList.toggle("pl-hot",on);
    (w?.classList.contains("pl-grouped")?$(`.pl-item[data-pl="${id}"]`):w?.querySelector(":scope>.plain"))?.classList.toggle("hot",on);
  }
  pairs().forEach(({id,blk,note})=>[blk,note].forEach(el=>{el.addEventListener("mouseenter",()=>hot(id,true));el.addEventListener("mouseleave",()=>hot(id,false))}));
  let t;const later=()=>{clearTimeout(t);t=setTimeout(draw,60)};
  draw();addEventListener("resize",later);mq.addEventListener?.("change",later);
  $$(".plain img").forEach(i=>i.complete||i.addEventListener("load",later));
  document.fonts?.ready.then(later);
  if(window.ResizeObserver)new ResizeObserver(later).observe(reader);
})();
