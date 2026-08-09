let host = 'https://radio.hellyell.com';
let headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

let classes = [
    {type_id: 'foreign-music', type_name: '国际音乐台'},
    {type_id: 'chinese-music', type_name: '中文音乐台'},
    {type_id: 'news-comprehensive', type_name: '新闻综合台'},
    {type_id: 'huaijiu-musiclist', type_name: '怀旧电台'},
    {type_id: 'qiche-musiclist', type_name: '汽车电台'}
];

const _find_station_name = async play_url => {
    if (!play_url) return 'HellYell电台';
    try {
        let all_classes = ['foreign-music', 'chinese-music', 'news-comprehensive', 'huaijiu-musiclist', 'qiche-musiclist'];
        for (let c of all_classes) {
            let resp = await req(`${host}/${c}.json`, { headers, timeout: 10000 });
            let stations = JSON.parse(resp.content || '[]');
            for (let s of stations) {
                if (s.url === play_url) return s.name;
            }
        }
    } catch (e) {}
    return 'HellYell电台';
};

const init = async () => {};

const home = async () => {
    return JSON.stringify({ class: classes });
};

const homeVod = async () => {
    try {
        let list_data = [];
        let resp = await req(`${host}/foreign-music.json`, { headers, timeout: 10000 });
        let stations = JSON.parse(resp.content || '[]');
        for (let i = 0; i < Math.min(12, stations.length); i++) {
            let station = stations[i];
            let remark = station.tag || (station.recommended ? '🔥推荐' : '在线电台');
            list_data.push({
                vod_id: station.url,
                vod_name: station.name,
                vod_pic: `${host}/favicon.ico`,
                vod_remarks: remark
            });
        }
        return JSON.stringify({ list: list_data });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
};

const category = async (tid, pg, filter, extend) => {
    try {
        let list_data = [];
        let class_id = tid || 'chinese-music';
        let resp = await req(`${host}/${class_id}.json`, { headers, timeout: 10000 });
        let stations = JSON.parse(resp.content || '[]');
        for (let station of stations) {
            let remark = station.tag || (station.recommended ? '⭐推荐' : '在线电台');
            list_data.push({
                vod_id: station.url,
                vod_name: station.name,
                vod_pic: `${host}/favicon.ico`,
                vod_remarks: remark
            });
        }
        return JSON.stringify({
            page: 1,
            pagecount: 1,
            limit: 100,
            total: list_data.length,
            list: list_data
        });
    } catch (e) {
        return JSON.stringify({ page: 1, pagecount: 1, limit: 100, total: 0, list: [] });
    }
};

const detail = async id => {
    try {
        let play_url = id;
        let name = await _find_station_name(play_url);
        return JSON.stringify({
            list: [{
                vod_id: play_url,
                vod_name: name,
                vod_pic: `${host}/favicon.ico`,
                vod_play_from: '直播流',
                vod_play_url: `直播$${play_url}`
            }]
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
};

const play = async (flag, id, vipFlags) => {
    try {
        let play_headers = { ...headers };
        if (id && id.includes('music.163.com')) {
            play_headers['Referer'] = 'https://music.163.com/';
        }
        return JSON.stringify({
            parse: 0,
            url: id,
            header: play_headers,
            jx: 0
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: id, jx: 0 });
    }
};

const search = async (key, fpg) => {
    return JSON.stringify({ list: [] });
};

export default { init, home, homeVod, category, detail, search, play };
