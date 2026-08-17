const HOST = 'https://wapi.kuwo.cn';

function request(url, headers) {
    try {
        let res = fetch(url, {headers: headers || {}});
        let text = '';
        if (typeof res === 'string') {
            text = res;
        } else if (res && typeof res === 'object') {
            text = res.content || res.body || res.data || JSON.stringify(res);
        }
        if (!text || text.length === 0) return {};
        text = text.trim();
        if (text.charAt(0) === '<') return {};
        return JSON.parse(text);
    } catch(e) {
        return {};
    }
}

function init(ext) {
}

// 判断是否为纯歌名（不含任何括号）
function isPureSongName(name) {
    if (!name) return false;
    // 核心规则：只要歌名里带任何括号，一律过滤掉
    // 包括：() [] {} 【】 《》 〈〉 「」 『』
    return !/[\(\)\[\]\{\}【】《》〈〉「」『』]/.test(name);
}

function home(filter) {
    let cateId = [
        {type_name: "华语男", type_id: "1"},
        {type_name: "华语女", type_id: "2"},
        {type_name: "华语组合", type_id: "3"},
        {type_name: "日韩男", type_id: "4"},
        {type_name: "日韩女", type_id: "5"},
        {type_name: "日韩组合", type_id: "6"},
        {type_name: "欧美男", type_id: "7"},
        {type_name: "欧美女", type_id: "8"},
        {type_name: "欧美组合", type_id: "9"},
        {type_name: "其他", type_id: "0"}
    ];
    return JSON.stringify({class: cateId});
}

function homeVod() {
    return categoryContent("1", 1, false, {});
}

function categoryContent(tid, pg, filter, extend) {
    pg = parseInt(pg) || 1;
    let result = {list: [], page: pg, pagecount: 9999, limit: 90, total: 999999};
    let url = HOST + "/api/www/artist/artistInfo?category=" + tid + "&prefix=&pn=" + pg + "&rn=30";
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.kuwo.cn/'
    };
    
    let data = request(url, headers);
    if (data && data.data && data.data.artistList) {
        let list = data.data.artistList;
        for (let i = 0; i < list.length; i++) {
            let item = list[i];
            let pic = item.pic300 || item.pic || item.pic120 || '';
            result.list.push({
                vod_id: String(item.id || ''),
                vod_name: String(item.name || ''),
                vod_pic: String(pic),
                vod_remarks: String(item.musicNum || '')
            });
        }
    }
    return JSON.stringify(result);
}

function detailContent(ids) {
    // TVBox 可能传入字符串而非数组
    let rid;
    if (typeof ids === 'string') {
        rid = ids;
    } else if (Array.isArray(ids)) {
        rid = ids[0];
    } else {
        rid = String(ids);
    }
    
    let result = {};
    let info_url = HOST + "/api/www/artist/artist?artistid=" + rid;
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.kuwo.cn/'
    };
    
    try {
        let info_data = request(info_url, headers).data || {};
        let artist_name = info_data.name || '';
        let all_songs = getArtistSongs(rid);
        let artist_info = (info_data.info || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        if (all_songs.length > 300) all_songs = all_songs.slice(0, 300);
        
        // 统一格式：歌曲名-歌手名$rid，只保留纯歌曲名
        let play_arr = [];
        for (let i = 0; i < all_songs.length; i++) {
            let song = all_songs[i];
            let name = (song.name || '').replace(/[$#]/g, '').trim();
            let song_id = song.rid || '';
            
            // 双重保险：只保留纯歌曲名（不带任何括号）
            if (!name || !isPureSongName(name)) continue;
            
            // 统一格式：歌曲名-歌手名$rid
            play_arr.push(name + '-' + artist_name + '$' + song_id);
        }
        
        result.list = [{
            vod_id: rid,
            vod_name: artist_name,
            vod_pic: info_data.pic300 || info_data.pic || '',
            vod_content: artist_info || "暂无歌手简介",
            vod_remarks: "歌曲 : " + all_songs.length + "首",
            vod_actor: artist_name,
            vod_play_from: "酷我音乐",
            vod_play_url: play_arr.join('#')
        }];
    } catch(e) {
        result.list = [{
            vod_id: rid,
            vod_name: "加载失败",
            vod_content: "加载歌手信息失败",
            vod_remarks: "加载失败",
            vod_actor: "未知",
            vod_play_from: "酷我音乐",
            vod_play_url: ""
        }];
    }
    return JSON.stringify(result);
}

function getArtistSongs(rid) {
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.kuwo.cn/'
    };
    let songs = [];
    for (let page = 1; page <= 10; page++) {
        try {
            let url = HOST + "/api/www/artist/artistMusic?artistid=" + rid + "&pn=" + page + "&rn=30";
            let data = request(url, headers);
            if (data && data.code === 200) {
                let song_list = (data.data || {}).list || [];
                if (song_list.length === 0) break;
                for (let i = 0; i < song_list.length; i++) {
                    let song = song_list[i];
                    let songName = String(song.name || '').trim();
                    // 只保留纯歌曲名：非空且不带任何括号
                    if (songName && isPureSongName(songName)) {
                        songs.push({
                            name: songName,
                            rid: String(song.rid || ''),
                            album: String(song.album || ''),
                            duration: String(song.duration || '')
                        });
                    }
                }
                if (songs.length >= 300) { songs = songs.slice(0, 300); break; }
            }
        } catch(e) {}
    }
    return songs;
}

function getLyric(rid) {
    if (!rid) return null;
    try {
        let url = "https://kuwo.cn/openapi/v1/www/lyric/getlyric?musicId=" + rid;
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.kuwo.cn/'
        };
        let data = request(url, headers);
        if (data && data.data && data.data.lrclist) {
            let lines = [];
            for (let i = 0; i < data.data.lrclist.length; i++) {
                let item = data.data.lrclist[i];
                let t = parseFloat(item.time || 0);
                let m = Math.floor(t / 60);
                let s = Math.floor(t % 60);
                let cs = Math.floor((t % 1) * 100);
                let time_str = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + '.' + (cs < 10 ? '0' : '') + cs;
                lines.push('[' + time_str + ']' + (item.lineLyric || ''));
            }
            return lines.join('\n');
        }
    } catch(e) {}
    return null;
}

function playerContent(flag, id, vipFlags) {
    // id 也可能被传入为数组
    let rid;
    if (typeof id === 'string') {
        rid = id;
    } else if (Array.isArray(id)) {
        rid = id[0];
    } else {
        rid = String(id);
    }
    
    let result = {};
    let qualities = [];
    let quality_list = [["无损FLAC", 2000, "flac"], ["高品质320K", 320, "mp3"], ["标准128K", 128, "mp3"]];
    let headers = {'User-Agent': 'Mozilla/5.0 (Linux; Android 10)', 'Referer': 'https://www.kuwo.cn/'};
    
    for (let i = 0; i < quality_list.length; i++) {
        try {
            let api_url = "https://nmobi.kuwo.cn/mobi.s?f=web&user=0&source=kwplayer_ar_4.4.2.7_B_nuoweida_vh.apk&type=convert_url_with_sign&rid=" + rid + "&bitrate=" + quality_list[i][1] + "&format=" + quality_list[i][2];
            let data = request(api_url, headers);
            if (data && data.code === 200 && data.data && data.data.url) {
                qualities.push([quality_list[i][0], data.data.url]);
            }
        } catch(e) {}
    }
    
    if (qualities.length === 0) {
        result.parse = 0;
        result.playUrl = "";
        result.url = "";
        result.header = {};
        return JSON.stringify(result);
    }
    
    let urls = [];
    for (let i = 0; i < qualities.length; i++) {
        urls.push(qualities[i][0]);
        urls.push(qualities[i][1]);
    }
    
    let lyric_text = getLyric(rid);
    result.parse = 0;
    result.playUrl = urls[1] || "";
    result.url = urls;
    result.header = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Referer": "https://www.wo.cn/"};
    
    if (lyric_text) {
        result.content = lyric_text;
        result.lyric = lyric_text;
        result.lrc = lyric_text;
        result.subtitle = lyric_text;
        result.hasLyric = true;
    } else {
        result.content = "暂无歌词";
        result.hasLyric = false;
    }
    return JSON.stringify(result);
}

function searchContent(key, quick, pg) {
    pg = pg ? parseInt(pg) : 1;
    let result = {list: [], page: pg, pagecount: 9999, limit: 30, total: 999999};
    let wd = encodeURIComponent(key);
    let page_num = (pg - 1) * 30;
    let url = "https://search.kuwo.cn/r.s?client=kt&pn=" + page_num + "&rn=30&all=" + wd + "&vipver=1&ft=artist&encoding=utf8&rformat=json&mobi=1";
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.kuwo.cn/'
    };
    
    try {
        let data = request(url, headers);
        if (data && data.abslist) {
            let base_path = data.BASEPICPATH || 'https://img1.kuwo.cn/star/starheads/';
            for (let i = 0; i < data.abslist.length; i++) {
                let item = data.abslist[i];
                let pic = item.hts_PICPATH || (item.PICPATH ? base_path + item.PICPATH : '');
                result.list.push({
                    vod_id: String(item.ARTISTID || item.DC_TARGETID || ''),
                    vod_name: String(item.ARTIST || ''),
                    vod_pic: String(pic),
                    vod_remarks: String(item.SONGNUM || '')
                });
            }
        }
    } catch(e) {}
    return JSON.stringify(result);
}

function searchContentPage(key, quick, pg) {
    return searchContent(key, quick, pg);
}

function localProxy(param) {
    return null;
}

function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: categoryContent,
        detail: detailContent,
        play: playerContent,
        search: searchContent,
        searchContentPage: searchContentPage,
        localProxy: localProxy
    };
}
