let host = 'https://www.4c44.com';
let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": host + "/"
};

/* ---------- 工具函数 ---------- */
const e64 = text => btoa(unescape(encodeURIComponent(text)));
const d64 = text => {
    try { return decodeURIComponent(escape(atob(text))); } catch(e) { return text; }
};

const _get_image = (url, is_singer = false, is_mv = false) => {
    if (!url) return "";
    if (url.startsWith('//')) url = 'https:' + url;
    else if (url.startsWith('/')) url = host + url;
    else if (!url.startsWith('http')) url = host + '/' + url;
    if (is_singer) url = url.replace(/param=200y200/g, 'param=500y500').replace(/param=300y300/g, 'param=500y500');
    if (is_mv) url = url.replace(/\?imageView=1&thumbnail=800y/g, '?imageView=1&thumbnail=1280y720');
    return url;
};

const _clean_song_name = name => {
    if (!name) return "";
    return name.replace(/\s*-$/, '').replace(/^-\s*/, '').replace(/\s+/g, ' ').trim();
};

const _clean = text => {
    if (!text) return "";
    return text.replace(/(世纪音乐网|MP3免费下载|LRC动态歌词下载|高清MV|车载MV|夜店视频|热门榜单|全部歌曲|第\d+页|刷新|首页|免责声明|版权|联系邮箱)/gi, '').trim();
};

const _fetch = async url => {
    let full_url = url.startsWith('http') ? url : host + url;
    for (let i = 0; i < 3; i++) {
        try {
            let resp = await req(full_url, { headers, timeout: 15000 });
            let html = resp.content || '';
            if (html.includes('安全人机验证')) {
                let csrf = html.match(/name="csrf_token" value="([^"]+)"/);
                if (csrf) {
                    let vresp = await req(full_url, {
                        method: 'POST',
                        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                        data: `csrf_token=${encodeURIComponent(csrf[1])}&human_check=on`,
                        timeout: 15000
                    });
                    let vhtml = vresp.content || '';
                    if (!vhtml.includes('安全人机验证')) return vhtml;
                }
                return "";
            }
            return html;
        } catch (e) {}
    }
    return "";
};

const _verify_home = async () => {
    try {
        let resp = await req(host, { headers, timeout: 15000 });
        let html = resp.content || '';
        if (html.includes('安全人机验证') || html.includes('csrf_token')) {
            let csrf = html.match(/name="csrf_token" value="([^"]+)"/);
            if (csrf) {
                await req(host, {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
                    data: `csrf_token=${encodeURIComponent(csrf[1])}&human_check=on`,
                    timeout: 15000
                });
            }
        }
    } catch (e) {}
};

const _extract_home_items = html => {
    let items = [];
    let seen = new Set();
    if (!html) return items;
    let blocks = [];
    let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = liRegex.exec(html)) !== null) blocks.push(m[1]);
    for (let block of blocks) {
        let mp3 = block.match(/href="(\/mp3\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/);
        if (mp3) {
            let href = mp3[1], name = mp3[3].trim();
            let singer = (block.match(/class="singer"[^>]*>([^<]+)</) || ['', ''])[1].trim();
            let pic = (block.match(/<img[^>]*src="([^"]+)"/) || ['', ''])[1];
            let vod_id = host + href;
            if (seen.has(vod_id)) continue;
            seen.add(vod_id);
            items.push({
                vod_id: vod_id,
                vod_name: _clean(singer ? `${singer} - ${name}` : name),
                vod_pic: _get_image(pic),
                vod_remarks: "歌曲"
            });
            if (items.length >= 30) break;
        }
    }
    if (!items.length) {
        let all = [...html.matchAll(/href="(\/mp3\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
        for (let mm of all.slice(0, 30)) {
            let vod_id = host + mm[1];
            if (seen.has(vod_id)) continue;
            seen.add(vod_id);
            items.push({ vod_id, vod_name: _clean(mm[3].trim()), vod_pic: "", vod_remarks: "歌曲" });
        }
    }
    return items;
};

const _build_mv_url = (area, type_, sort, pg) => {
    const area_map = {index: "index", neidi: "neidi", gangtai: "gangtai", oumei: "oumei", hanguo: "hanguo", riben: "riben"};
    const type_map = {index: "index", guanfang: "guanfang", yuansheng: "yuansheng", xianchang: "xianchang", wangyi: "wangyi"};
    const sort_map = {new: "new", hot: "hot", rise: "rise"};
    let a = area_map[area] || "index";
    let t = type_map[type_] || "index";
    let s = sort_map[sort] || "new";
    if (pg === 1) {
        if (a === "index" && t === "index") return `/mvlist/index/index/${s}.html`;
        else if (a !== "index" && t === "index") return `/mvlist/${a}/index/${s}.html`;
        else if (a === "index" && t !== "index") return `/mvlist/index/${t}/${s}.html`;
        else return `/mvlist/${a}/${t}/${s}.html`;
    } else {
        if (a === "index" && t === "index") return `/mvlist/index/index/${s}/${pg}.html`;
        else if (a !== "index" && t === "index") return `/mvlist/${a}/index/${s}/${pg}.html`;
        else if (a === "index" && t !== "index") return `/mvlist/index/${t}/${s}/${pg}.html`;
        else return `/mvlist/${a}/${t}/${s}/${pg}.html`;
    }
};

const _fetch_play_data = async (song_id, play_type) => {
    try {
        let d = new Date();
        let YmdHi = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
        let key = YmdHi + "4c44";
        let post_headers = {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
        };
        let resp = await req(`${host}/js/play.php`, {
            method: 'POST',
            headers: post_headers,
            data: `id=${encodeURIComponent(song_id)}&type=${encodeURIComponent(play_type)}&key=${encodeURIComponent(key)}`,
            timeout: 10000
        });
        let data = JSON.parse(resp.content || '{}');
        if (data.msg === 1 && data.url) {
            return { url: data.url, lrc: data.lrc || "", pic: data.pic || "", title: data.title || "" };
        }
    } catch (e) {}
    return null;
};

/* ---------- 核心接口 ---------- */
const init = async () => {
    await _verify_home();
};

const home = async () => {
    const classes = [
        {type_name: "首页推荐", type_id: "home"},
        {type_name: "排行榜", type_id: "rank_list"},
        {type_name: "歌单", type_id: "playlist"},
        {type_name: "歌手", type_id: "singer"},
        {type_name: "MV", type_id: "mv"}
    ];
    const filters = {
        singer: [
            {key: "sex", name: "性别", value: [{n: "女歌手", v: "girl"}, {n: "男歌手", v: "male"}, {n: "乐队组合", v: "band"}]},
            {key: "area", name: "地区", value: [{n: "华语", v: "huayu"}, {n: "欧美", v: "oumei"}, {n: "韩国", v: "hanguo"}, {n: "日本", v: "ribrn"}]},
            {key: "char", name: "字母", value: [{n: "全部", v: "index"}].concat([...Array(26)].map((_, i) => ({n: String.fromCharCode(65 + i), v: String.fromCharCode(97 + i)})))}
        ],
        mv: [
            {key: "area", name: "地区", value: [{n: "全部", v: "index"}, {n: "内地", v: "neidi"}, {n: "港台", v: "gangtai"}, {n: "欧美", v: "oumei"}, {n: "韩国", v: "hanguo"}, {n: "日本", v: "riben"}]},
            {key: "type", name: "类型", value: [{n: "全部", v: "index"}, {n: "官方版", v: "guanfang"}, {n: "原声", v: "yuansheng"}, {n: "现场版", v: "xianchang"}, {n: "网易出品", v: "wangyi"}]},
            {key: "sort", name: "排序", value: [{n: "最新", v: "new"}, {n: "最热", v: "hot"}, {n: "上升最快", v: "rise"}]}
        ],
        playlist: [
            {key: "lang", name: "语种", value: [{n: "全部", v: "index"}, {n: "华语", v: "huayu"}, {n: "欧美", v: "oumei"}, {n: "日语", v: "riyu"}, {n: "韩语", v: "hanyu"}, {n: "粤语", v: "yueyu"}]},
            {key: "style", name: "风格", value: [{n: "流行", v: "liuxing"}, {n: "摇滚", v: "yaogun"}, {n: "民谣", v: "minyao"}, {n: "电子", v: "dianzi"}, {n: "舞曲", v: "wuqu"}, {n: "说唱", v: "shuochang"}, {n: "轻音乐", v: "qingyinle"}, {n: "爵士", v: "jueshi"}, {n: "乡村", v: "xiangcun"}, {n: "R&B/Soul", v: "soul"}, {n: "古典", v: "gudian"}, {n: "古风", v: "gufeng"}]}
        ]
    };
    let list = _extract_home_items(await _fetch("/"));
    return JSON.stringify({ class: classes, filters: filters, list });
};

const homeVod = async () => {
    let list = _extract_home_items(await _fetch("/"));
    return JSON.stringify({ list });
};

const category = async (tid, pg, _, extend) => {
    pg = parseInt(pg || 1);
    let items = [];

    if (tid === "home") {
        let list = _extract_home_items(await _fetch("/"));
        return JSON.stringify({ list, page: pg, pagecount: 1, limit: 30, total: list.length });
    }

    if (tid === "rank_list") {
        const rank_list = [
            {id: "rise", name: "音乐飙升榜"}, {id: "new", name: "新歌排行榜"}, {id: "original", name: "音乐原创榜"},
            {id: "top", name: "Top热歌榜"}, {id: "douyin", name: "抖音热歌榜"}, {id: "kuaishou", name: "快手热歌榜"},
            {id: "zwdj", name: "中文DJ榜"}, {id: "hot", name: "网络热歌榜"}, {id: "japan", name: "日本歌曲榜"},
            {id: "oumei", name: "欧美新歌榜"}, {id: "korea", name: "韩国音乐榜"}, {id: "america", name: "美国音乐榜"},
            {id: "acg", name: "ACG新歌榜"}, {id: "acgyx", name: "ACG游戏榜"}, {id: "acgdm", name: "ACG动画榜"},
            {id: "omtop", name: "欧美热歌榜"}, {id: "dian", name: "电子舞曲榜"}, {id: "uktop", name: "UK排行榜"},
            {id: "gudian", name: "古典音乐榜"}, {id: "raptop", name: "RAP说唱榜"}, {id: "dytop", name: "电音热歌榜"},
            {id: "qianli", name: "潜力热歌榜"}, {id: "yytop", name: "粤语金曲榜"}, {id: "ystop", name: "影视金曲榜"},
            {id: "xyztop", name: "小语种热歌"}, {id: "djtop", name: "串烧舞曲榜"}, {id: "ktvtop", name: "KTV点唱榜"},
            {id: "chetop", name: "车载嗨曲榜"}, {id: "aytop", name: "熬夜修仙榜"}, {id: "sqtop", name: "睡前放松榜"}
        ];
        let start = (pg - 1) * 30;
        let end = start + 30;
        for (let rank of rank_list.slice(start, end)) {
            items.push({ vod_id: `rank_${rank.id}`, vod_name: rank.name, vod_pic: "", vod_remarks: "排行榜" });
        }
        let total_pages = Math.ceil(rank_list.length / 30);
        return JSON.stringify({ list: items, page: pg, pagecount: total_pages, limit: 30, total: rank_list.length });
    }

    if (tid === "playlist") {
        let lang = extend.lang || "index";
        let style = extend.style || "";
        let url;
        if (lang !== "index") url = `/playlists/${lang}.html`;
        else if (style) url = `/playlists/${style}.html`;
        else url = "/playlists/index.html";
        if (pg > 1) url = url.replace(/\.html$/, `/${pg}.html`);
        let html = await _fetch(url);
        if (html) {
            let blocks = [];
            let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
            let m;
            while ((m = liRegex.exec(html)) !== null) blocks.push(m[1]);
            for (let block of blocks) {
                let href_match = block.match(/href="(\/playlist\/([^"]+)\.html)"/);
                if (!href_match) continue;
                let href = href_match[1];
                let name_match = block.match(/title="([^"]+)"/) || block.match(/>([^<]+)<\/a>/);
                let name = name_match ? name_match[1].trim() : "";
                let pic_match = block.match(/<img[^>]*src="([^"]+)"/);
                let pic = pic_match ? pic_match[1] : "";
                items.push({
                    vod_id: host + href,
                    vod_name: _clean(name),
                    vod_pic: _get_image(pic),
                    vod_remarks: "歌单"
                });
            }
        }
        return JSON.stringify({ list: items, page: pg, pagecount: pg + 1, limit: 30, total: 9999 });
    }

    if (tid === "singer") {
        let sex = extend.sex || "girl";
        let area = extend.area || "huayu";
        let char = extend.char || "index";
        let url;
        if (char !== "index") url = pg === 1 ? `/singerlist/${area}/${sex}/${char}.html` : `/singerlist/${area}/${sex}/${char}/${pg}.html`;
        else url = pg === 1 ? `/singerlist/${area}/${sex}/index.html` : `/singerlist/${area}/${sex}/index/${pg}.html`;
        let html = await _fetch(url);
        if (html) {
            let blocks = [];
            let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
            let m;
            while ((m = liRegex.exec(html)) !== null) blocks.push(m[1]);
            for (let block of blocks) {
                let href_match = block.match(/href="(\/singer\/([^"]+)\.html)"/);
                if (href_match) {
                    let href = href_match[1];
                    let name_match = block.match(/title="([^"]+)"/) || block.match(/<div class="name"><a[^>]*>([^<]+)<\/a>/) || block.match(/>([^<]+)<\/a>/);
                    let name = name_match ? name_match[1].trim() : "";
                    let pic_match = block.match(/<img[^>]*src="([^"]+)"/);
                    let pic = pic_match ? pic_match[1] : "";
                    items.push({
                        vod_id: host + href,
                        vod_name: _clean(name),
                        vod_pic: _get_image(pic, true),
                        vod_remarks: "歌手"
                    });
                }
            }
        }
        return JSON.stringify({ list: items, page: pg, pagecount: pg + 1, limit: 30, total: 9999 });
    }

    if (tid === "mv") {
        let area = extend.area || "index";
        let type_ = extend.type || "index";
        let sort = extend.sort || "new";
        let url = _build_mv_url(area, type_, sort, pg);
        let html = await _fetch(url);
        if (html) {
            let blocks = [];
            let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
            let m;
            while ((m = liRegex.exec(html)) !== null) blocks.push(m[1]);
            for (let block of blocks) {
                let mp4_match = block.match(/href="(\/mp4\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/);
                if (mp4_match) {
                    let href = mp4_match[1];
                    let mv_id = mp4_match[2];
                    let name = mp4_match[3].trim();
                    let pic_match = block.match(/<img[^>]*src="([^"]+)"/);
                    let pic = pic_match ? pic_match[1] : "";
                    items.push({
                        vod_id: host + href,
                        vod_name: _clean_song_name(name),
                        vod_pic: _get_image(pic, false, true),
                        vod_remarks: "MV",
                        _mv_id: mv_id
                    });
                }
            }
        }
        return JSON.stringify({ list: items, page: pg, pagecount: pg + 1, limit: 30, total: 9999 });
    }

    return JSON.stringify({ list: items, page: pg, pagecount: 999, limit: 30, total: 9999 });
};

const _get_rank_playlist = async rank_type => {
    let eps = [];
    for (let page of [1, 2]) {
        let url = page === 1 ? `/list/${rank_type}.html` : `/list/${rank_type}/${page}.html`;
        let html = await _fetch(url);
        if (!html) continue;
        let matches = [...html.matchAll(/href="(\/mp3\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
        for (let mm of matches) {
            let name = _clean_song_name(mm[3].trim());
            let play_url = `music://${host}/data/down.php?ac=music&id=${mm[2]}`;
            eps.push(`${name}$${e64('0@@@@' + play_url)}`);
        }
        if (eps.length >= 50) break;
    }
    return eps.length ? eps.join('#') : null;
};

const detail = async id => {
    let url = id;

    if (url.includes("rank_")) {
        let rank_type = url.split("rank_")[1];
        let playlist = await _get_rank_playlist(rank_type);
        if (playlist) {
            let song_count = playlist.split('#').length;
            return JSON.stringify({
                list: [{
                    vod_id: url,
                    vod_name: `排行榜-${rank_type}`,
                    vod_pic: "",
                    vod_content: `共${song_count}首`,
                    vod_play_from: "排行榜",
                    vod_play_url: playlist
                }]
            });
        } else {
            return JSON.stringify({
                list: [{
                    vod_id: url,
                    vod_name: `排行榜-${rank_type}`,
                    vod_pic: "",
                    vod_content: "暂无歌曲",
                    vod_play_from: "排行榜",
                    vod_play_url: `暂无$${e64('0@@@@' + host)}`
                }]
            });
        }
    }

    if (url.includes("/mp4/")) {
        let html = await _fetch(url);
        if (!html) return JSON.stringify({ list: [] });
        let video_id_match = url.match(/\/mp4\/([^/]+)\.html/);
        let video_id = video_id_match ? video_id_match[1] : "";
        let name_match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        let name = name_match ? name_match[1].replace(/<[^>]+>/g, '').trim() : "MV";
        name = _clean_song_name(name);
        let pic_match = html.match(/<div class="singer_info"[^>]*>[\s\S]*?<div class="pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/) ||
                         html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*pic[^"]*"/) ||
                         html.match(/<img[^>]*src="([^"]+)"/);
        let pic = pic_match ? pic_match[1] : "";
        let play_url = `mp4://${host}/data/down.php?ac=vplay&id=${video_id}&q=1080`;
        let playlist = [`${name}$${e64('0@@@@' + play_url)}`];
        for (let page = 1; page <= 3; page++) {
            let cat_url = _build_mv_url("index", "index", "hot", page);
            let cat_html = await _fetch(cat_url);
            if (!cat_html) continue;
            let matches = [...cat_html.matchAll(/href="(\/mp4\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
            for (let mm of matches) {
                if (mm[2] === video_id) continue;
                let mv_name = _clean_song_name(mm[3].trim());
                let mv_play = `mp4://${host}/data/down.php?ac=vplay&id=${mm[2]}&q=1080`;
                let entry = `${mv_name}$${e64('0@@@@' + mv_play)}`;
                if (!playlist.includes(entry)) playlist.push(entry);
                if (playlist.length >= 30) break;
            }
            if (playlist.length >= 30) break;
        }
        return JSON.stringify({
            list: [{
                vod_id: url,
                vod_name: name,
                vod_pic: _get_image(pic, false, true),
                vod_content: `MV · 共${playlist.length}个`,
                vod_play_from: "MV播放",
                vod_play_url: playlist.join('#')
            }]
        });
    }

    if (url.includes("/mp3/")) {
        let html = await _fetch(url);
        if (!html) return JSON.stringify({ list: [] });
        let song_id_match = url.match(/\/mp3\/([^/]+)\.html/);
        let song_id = song_id_match ? song_id_match[1] : "";
        let name_match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        let name = name_match ? name_match[1].replace(/<[^>]+>/g, '').trim() : "歌曲";
        name = _clean_song_name(name);
        let pic_match = html.match(/<img[^>]*src="([^"]+)"/);
        let pic = pic_match ? pic_match[1] : "";
        let play_url = `music://${host}/data/down.php?ac=music&id=${song_id}`;
        return JSON.stringify({
            list: [{
                vod_id: url,
                vod_name: name,
                vod_pic: _get_image(pic),
                vod_content: "",
                vod_play_from: "歌曲",
                vod_play_url: `${name}$${e64('0@@@@' + play_url)}`
            }]
        });
    }

    if (url.includes("/singer/")) {
        let html = await _fetch(url);
        if (!html) return JSON.stringify({ list: [] });
        let name_match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        let name = name_match ? name_match[1].replace(/<[^>]+>/g, '').trim() : "歌手";
        name = _clean(name);
        let pic_match = html.match(/<div class="singer_info"[^>]*>[\s\S]*?<div class="pic"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/) ||
                         html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*pic[^"]*"/) ||
                         html.match(/<img[^>]*src="([^"]+)"/);
        let pic = pic_match ? pic_match[1] : "";
        let songs = [];
        for (let page = 1; page <= 3; page++) {
            let page_url = url;
            if (page > 1) {
                if (url.endsWith('.html')) page_url = url.replace('.html', `_${page}.html`);
                else page_url = url.replace(/\/$/, '') + `/${page}.html`;
            }
            let page_html = await _fetch(page_url);
            if (!page_html) break;
            let matches = [...page_html.matchAll(/href="(\/mp3\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
            for (let mm of matches) {
                let song_name = _clean_song_name(mm[3].trim());
                let play_url = `music://${host}/data/down.php?ac=music&id=${mm[2]}`;
                songs.push(`${song_name}$${e64('0@@@@' + play_url)}`);
            }
            if (!page_html.match(/下一页|下页/)) break;
            if (songs.length >= 100) break;
        }
        let mvs = [];
        let mv_link_match = html.match(/href="(\/singer\/[^"]*video[^"]*\.html)"/);
        if (mv_link_match) {
            let mv_html = await _fetch(mv_link_match[1]);
            if (mv_html) {
                let mv_matches = [...mv_html.matchAll(/href="(\/mp4\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
                for (let mm of mv_matches.slice(0, 20)) {
                    let mv_name = _clean_song_name(mm[3].trim());
                    let mv_play = `mp4://${host}/data/down.php?ac=vplay&id=${mm[2]}&q=1080`;
                    mvs.push(`${mv_name}$${e64('0@@@@' + mv_play)}`);
                }
            }
        }
        let play_from = [];
        let play_url = [];
        if (songs.length) { play_from.push(`歌曲(${songs.length}首)`); play_url.push(songs.join('#')); }
        if (mvs.length) { play_from.push(`MV(${mvs.length}部)`); play_url.push(mvs.join('#')); }
        if (!play_from.length) { play_from.push("暂无"); play_url.push(`暂无$${e64('0@@@@' + url)}`); }
        return JSON.stringify({
            list: [{
                vod_id: url,
                vod_name: name,
                vod_pic: _get_image(pic, true),
                vod_content: "",
                vod_play_from: play_from.join('$$$'),
                vod_play_url: play_url.join('$$$')
            }]
        });
    }

    if (url.includes("/playlist/")) {
        let html = await _fetch(url);
        if (!html) return JSON.stringify({ list: [] });
        let name_match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        let name = name_match ? name_match[1].replace(/<[^>]+>/g, '').trim() : "歌单";
        name = _clean(name);
        let pic_match = html.match(/<img[^>]*src="([^"]+)"/);
        let pic = pic_match ? pic_match[1] : "";
        let songs = [];
        let matches = [...html.matchAll(/href="(\/mp3\/([^"]+)\.html)"[^>]*>([^<]+)<\/a>/g)];
        for (let mm of matches) {
            let song_name = _clean_song_name(mm[3].trim());
            let play_url = `music://${host}/data/down.php?ac=music&id=${mm[2]}`;
            songs.push(`${song_name}$${e64('0@@@@' + play_url)}`);
        }
        return JSON.stringify({
            list: [{
                vod_id: url,
                vod_name: name,
                vod_pic: _get_image(pic),
                vod_content: `共${songs.length}首`,
                vod_play_from: "歌单",
                vod_play_url: songs.length ? songs.join('#') : `暂无$${e64('0@@@@' + url)}`
            }]
        });
    }

    return JSON.stringify({ list: [{ vod_id: url, vod_name: "未知", vod_pic: "", vod_content: "" }] });
};

const search = async (wd, _, pg = 1) => {
    let url = `/so.php?wd=${encodeURIComponent(wd)}&page=${pg}`;
    let html = await _fetch(url);
    let items = [];
    if (html) {
        let blocks = [];
        let liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let m;
        while ((m = liRegex.exec(html)) !== null) blocks.push(m[1]);
        for (let block of blocks) {
            let href_match = block.match(/href="(\/(mp3|mp4|playlist|singer)\/([^"]+)\.html)"/);
            if (href_match) {
                let href = href_match[1];
                let kind = href_match[2];
                let name_match = block.match(/title="([^"]+)"/) || block.match(/>([^<]{2,})<\/a>/);
                let name = name_match ? name_match[1].trim() : "未知";
                let pic_match = block.match(/<img[^>]*src="([^"]+)"/);
                let pic = pic_match ? pic_match[1] : "";
                let remarks = kind === "mp3" ? "歌曲" : kind === "mp4" ? "MV" : kind === "playlist" ? "歌单" : "歌手";
                items.push({
                    vod_id: host + href,
                    vod_name: _clean(name),
                    vod_pic: _get_image(pic),
                    vod_remarks: remarks
                });
            }
        }
    }
    return JSON.stringify({ list: items, page: parseInt(pg), pagecount: parseInt(pg) + 1, limit: 30, total: 9999 });
};

const play = async (flag, id, vipFlags) => {
    let raw = d64(id);
    let parts = raw.split("@@@@");
    raw = parts[parts.length - 1];
    let urlParts = raw.split("|||");
    let url = urlParts[0].replace("\\/", "/");

    let result = {
        parse: 0,
        url: url,
        header: {
            "User-Agent": headers["User-Agent"],
            "Referer": host + "/"
        }
    };

    let is_music = url.includes("ac=music") || url.includes("/mp3/");
    let is_mv = url.includes("ac=vplay") || url.includes("/mp4/");

    if (is_music) {
        let song_id = null;
        let m = url.match(/id=([^&]+)/);
        if (m) song_id = m[1];
        else if (url.includes("/mp3/")) {
            m = url.match(/\/mp3\/([^/]+)\.html/);
            if (m) song_id = m[1];
        }
        if (song_id) {
            let play_data = await _fetch_play_data(song_id, "music");
            if (play_data && play_data.url) {
                result.url = play_data.url;
                if (play_data.lrc) result.lrc = play_data.lrc;
                if (play_data.pic) {
                    result.pic = play_data.pic;
                    result.cover = play_data.pic;
                    result.vod_pic = play_data.pic;
                }
            }
        }
    } else if (is_mv) {
        let video_id = null;
        let m = url.match(/id=([^&]+)/);
        if (m) video_id = m[1];
        else if (url.includes("/mp4/")) {
            m = url.match(/\/mp4\/([^/]+)\.html/);
            if (m) video_id = m[1];
        }
        if (video_id) {
            let play_data = await _fetch_play_data(video_id, "mv");
            if (play_data && play_data.url) {
                result.url = play_data.url;
                if (play_data.pic) {
                    result.pic = play_data.pic;
                    result.cover = play_data.pic;
                    result.vod_pic = play_data.pic;
                }
            } else {
                let clean_url = url.replace(/^(music|mp4):\/\//, '');
                result.url = clean_url;
            }
        }
        result.header = {
            "User-Agent": headers["User-Agent"],
            "Referer": host + "/",
            "Accept": "*/*",
            "Accept-Encoding": "identity",
            "Connection": "keep-alive"
        };
    }

    return JSON.stringify(result);
};

export default { init, home, homeVod, category, detail, search, play };
