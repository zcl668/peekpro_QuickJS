import req from '../../util/req.js';

const KEY = 'hellyell_radio';
const NAME = 'HellYell电台';
const HOST = 'https://radio.hellyell.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT = 10000;

const CLASSES = [
    { type_id: 'foreign-music', type_name: '国际音乐台' },
    { type_id: 'chinese-music', type_name: '中文音乐台' },
    { type_id: 'news-comprehensive', type_name: '新闻综合台' },
    { type_id: 'huaijiu-musiclist', type_name: '怀旧电台' },
    { type_id: 'qiche-musiclist', type_name: '汽车电台' }
];

const ALL_CLASSES = ['foreign-music', 'chinese-music', 'news-comprehensive', 'huaijiu-musiclist', 'qiche-musiclist'];

async function init() {
    return {};
}

async function home() {
    return { class: CLASSES };
}

async function homeVod() {
    try {
        const list = [];
        const url = HOST + '/foreign-music.json';
        const resp = await req.get(url, {
            headers: { 'User-Agent': UA },
            timeout: TIMEOUT
        });
        const stations = resp.data || [];
        
        for (let i = 0; i < Math.min(12, stations.length); i++) {
            const station = stations[i];
            let remark = '在线电台';
            if (station.recommended === true) {
                remark = '🔥推荐';
            } else if (station.tag) {
                remark = station.tag;
            }
            list.push({
                vod_id: station.url,
                vod_name: station.name,
                vod_pic: HOST + '/favicon.ico',
                vod_remarks: remark
            });
        }
        return { list };
    } catch {
        return { list: [] };
    }
}

async function category(reqIn) {
    try {
        const body = reqIn?.body || {};
        const tid = body.id || body.tid || 'chinese-music';
        const list = [];
        const url = HOST + '/' + tid + '.json';
        const resp = await req.get(url, {
            headers: { 'User-Agent': UA },
            timeout: TIMEOUT
        });
        const stations = resp.data || [];
        
        for (const station of stations) {
            let remark = '在线电台';
            if (station.tag) {
                remark = station.tag;
            } else if (station.recommended === true) {
                remark = '⭐推荐';
            }
            list.push({
                vod_id: station.url,
                vod_name: station.name,
                vod_pic: HOST + '/favicon.ico',
                vod_remarks: remark
            });
        }
        
        return {
            page: 1,
            pagecount: 1,
            limit: 100,
            total: list.length,
            list
        };
    } catch {
        return { page: 1, pagecount: 1, limit: 100, total: 0, list: [] };
    }
}

async function getStationName(playUrl) {
    try {
        for (const c of ALL_CLASSES) {
            const url = HOST + '/' + c + '.json';
            const resp = await req.get(url, {
                headers: { 'User-Agent': UA },
                timeout: TIMEOUT
            });
            const stations = resp.data || [];
            for (const s of stations) {
                if (s.url === playUrl) {
                    return s.name;
                }
            }
        }
        return null;
    } catch {
        return null;
    }
}

async function detail(reqIn) {
    try {
        const body = reqIn?.body || {};
        let ids = body.id;
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        
        const list = [];
        for (const rawId of ids.filter(Boolean)) {
            let playUrl = rawId;
            let name = '电台';
            
            // 尝试从对象中提取
            if (typeof rawId === 'object') {
                playUrl = rawId.vod_id || rawId.id || '';
                name = rawId.vod_name || rawId.name || '电台';
            }
            
            if ((name === '电台' || !name) && playUrl) {
                const foundName = await getStationName(playUrl);
                if (foundName) name = foundName;
            }
            
            if (name === '电台' || !name) {
                name = 'HellYell电台';
            }
            
            list.push({
                vod_id: playUrl,
                vod_name: name,
                vod_pic: HOST + '/favicon.ico',
                vod_play_from: '直播流',
                vod_play_url: '直播$' + playUrl
            });
        }
        
        return { list };
    } catch {
        return { list: [] };
    }
}

async function play(reqIn) {
    try {
        const body = reqIn?.body || {};
        const id = String(body.id || '').trim();
        const headers = { 'User-Agent': UA };
        if (id && id.includes('music.163.com')) {
            headers['Referer'] = 'https://music.163.com/';
        }
        return {
            parse: 0,
            url: id,
            header: JSON.stringify(headers),
            jx: 0
        };
    } catch {
        return { parse: 0, url: '', jx: 0 };
    }
}

async function search() {
    return { list: [] };
}

export default function createSpider() {
    return {
        meta: {
            key: KEY,
            name: NAME,
            type: 3
        },
        api: async (fastify) => {
            fastify.post('/init', init);
            fastify.post('/home', home);
            fastify.post('/homeVod', homeVod);
            fastify.post('/category', category);
            fastify.post('/detail', detail);
            fastify.post('/play', play);
            fastify.post('/search', search);
        },
        check: async () => true
    };
}