let host = 'https://www.qtfm.cn';
let headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.qtfm.cn/'
};
let m_headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'Referer': 'https://m.qtfm.cn/'
};

let class_name = [
    '广东','浙江','北京','天津','河北','上海','山西','内蒙古',
    '辽宁','吉林','黑龙江','江苏','安徽','福建','江西','山东',
    '河南','湖北','湖南','广西','海南','重庆','四川','贵州',
    '云南','陕西','甘肃','宁夏','新疆','西藏','青海',
    '资讯','音乐','交通','经济','文艺','都市','体育','双语',
    '综合','生活','旅游','曲艺','方言'
];
let class_url = [
    '217','99','3','5','7','83','19','31','44','59','69','85',
    '111','129','139','151','169','187','202','239','254','257',
    '259','281','291','316','327','351','357','308','342',
    '433','442','429','439','432','441','430','431','440',
    '438','435','436','434'
];

const init = async () => {};

const home = async () => {
    let classes = [];
    for (let i = 0; i < class_name.length; i++) {
        classes.push({ type_id: class_url[i], type_name: class_name[i] });
    }
    return JSON.stringify({ class: classes });
};

const homeVod = async () => {
    return JSON.stringify({ list: [] });
};

const category = async (tid, pg, filterable, extend) => {
    let page = parseInt(pg || 1);
    let url = `${host}/radiopage/${tid}/${page}/`;
    let videos = [];
    try {
        let resp = await req(url, { headers, timeout: 15000 });
        let html = resp.content || '';
        if (!html) return JSON.stringify({ page: page, pagecount: page, limit: 12, total: 0, list: [] });
        let items = [];
        let regex = /<div class="content-item-root c-itemS radio">([\s\S]*?)<\/div>\s*<\/div>/g;
        let m;
        while ((m = regex.exec(html)) !== null) items.push(m[1]);
        for (let item of items) {
            let title_match = item.match(/<div class="itemTitleRadio" title="([^"]*)"/);
            let title = title_match ? title_match[1] : '';
            if (!title) {
                let tm = item.match(/<span>([^<]*)<\/span>/);
                title = tm ? tm[1].trim() : '未知电台';
            }
            let pic_match = item.match(/<img[^>]*src="(\/\/[^"]+)"/);
            let pic = pic_match ? 'https:' + pic_match[1] : '';
            let desc_match = item.match(/<div class="descRadio[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            let desc = desc_match ? desc_match[1].replace(/<[^>]+>/g, '').trim() : '';
            let href_match = item.match(/<a class="link" href="(\/radios\/\d+)"/);
            let vod_id = href_match ? host + href_match[1] : '';
            if (vod_id) {
                videos.push({ vod_id, vod_name: title, vod_pic: pic, vod_remarks: desc });
            }
        }
        let has_next = html.includes('paging-item-a') && html.includes('下一页');
        return JSON.stringify({
            page: page,
            pagecount: has_next ? page + 1 : page,
            limit: 12,
            total: has_next ? 9999 : videos.length,
            list: videos
        });
    } catch (e) {
        return JSON.stringify({ page: page, pagecount: page, limit: 12, total: 0, list: [] });
    }
};

const detail = async id => {
    let videos = [];
    try {
        let vid = id;
        let radio_id = vid.replace(/\/$/, '').split('/').pop();
        let m_url = `https://m.qtfm.cn/channels/${radio_id}/`;
        let resp = await req(m_url, { headers: m_headers, timeout: 15000 });
        let html = resp.content || '';
        let title = '', pic = '', desc = '';
        if (html) {
            let script_match = html.match(/window\.__initStores=({.*?});?<\/script>/);
            if (script_match) {
                try {
                    let data = JSON.parse(script_match[1]);
                    let basic = data.ChannelStore?.basicInfo || {};
                    title = basic.name || '';
                    pic = basic.cover || '';
                    desc = basic.desc || '';
                } catch (e) {}
            }
            if (!title) {
                let nm = html.match(/"name":"([^"]+)"/);
                if (nm) title = nm[1];
            }
            if (!pic) {
                let cm = html.match(/"cover":"([^"]+)"/);
                if (cm) pic = cm[1];
            }
            if (!desc) {
                let dm = html.match(/"desc":"([^"]+)"/);
                if (dm) desc = dm[1];
            }
        }
        if (pic && pic.includes('!200')) pic = pic.replace('!200', '');
        
        // 修正：移除无效的 HLS 线路，仅保留 MP3 直链
        let play_url = `https://lhttp.qtfm.cn/live/${radio_id}/64k.mp3`;
        
        videos.push({
            vod_id: vid,
            vod_name: title || `电台-${radio_id}`,
            vod_pic: pic,
            vod_content: desc,
            vod_play_from: '蜻蜓FM',
            vod_play_url: `${title || radio_id}$${play_url}`
        });
    } catch (e) {}
    return JSON.stringify({ list: videos });
};

const play = async (flag, id, vipFlags) => {
    // 修正：明确标识 jx: 0，避免播放器尝试解析直链
    return JSON.stringify({
        parse: 0,
        jx: 0,
        playUrl: '',
        url: id,
        header: headers
    });
};

const search = async (key, _, pg = "1") => {
    let url = `https://www.qtfm.cn/search/${encodeURIComponent(key)}/`;
    let videos = [];
    try {
        let resp = await req(url, { headers, timeout: 15000 });
        let html = resp.content || '';
        if (html) {
            let regex = /<a class="link" href="(\/radios\/(\d+))"[^>]*>[\s\S]*?<img[^>]*src="(\/\/[^"]+)"[^>]*>[\s\S]*?<div[^>]*class="itemTitle[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
            let m;
            while ((m = regex.exec(html)) !== null) {
                let href = m[1];
                let rid = m[2];
                let pic = m[3];
                let title = m[4].replace(/<[^>]+>/g, '').trim();
                let pic_url = pic.startsWith('//') ? 'https:' + pic : pic;
                videos.push({
                    vod_id: host + href,
                    vod_name: title,
                    vod_pic: pic_url,
                    vod_remarks: '搜索'
                });
            }
        }
    } catch (e) {}
    return JSON.stringify({ list: videos, page: parseInt(pg) });
};

export default { init, home, homeVod, category, detail, search, play };
