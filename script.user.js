// ==UserScript==
// @name         KrunkerHak Detect
// @namespace    https://github.com/DaAwesomeRazor
// @version      0.1
// @description  An extension that detects krunker hackers in game
// @author       RazorGaming
// @require      https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @match        https://krunker.io/*
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==
const {
    encode,
    decode
} = msgpack;

unsafeWindow.msgpack = msgpack;

var _WebSocket = WebSocket;

unsafeWindow.WebSocket = function(url) {
    const ws = new _WebSocket(url);
    unsafeWindow.webSocket = ws;
    return ws;
}

class Server {
    constructor() {
        this.queue = new Set();
        this.prog = false;
        this.ws = null;

        this.connect();
    }

    connect() {
        this.ws = new WebSocket('wss://krunker_social.krunker.io/ws');
        this.ws.binaryType = 'arraybuffer';
        this.ws.onmessage = buf => {

            const data = decode(new Uint8Array(buf.data))[1][2];
            if (data !== "Error" && data) {
                this.queue.delete(data.player_name);
                HackDetect.handlePlayer(data);
            }
            this.prog = false;
            this.handleQueue();
        };
    }

    closeSocket() {
        if (this.ws && this.ws.readyState == 1) {
            this.ws.close();
            this.ws = null;
        }
    }

    getProfile(user) {
        if (this.prog) {
            this.queue.add(user);
            return;
        }
        console.log('getting ' + user)
        this.ws.send(encode(['r', ['profile', user, '', null]]));
        this.prog = true;
    }

    handleQueue() {
        if (this.queue.size >= 1) this.getProfile(Array.from(this.queue)[0]);
    }
}

unsafeWindow.KrunkerSocial = class extends Server {
    getUser(user) {
        this.getProfile(user);
    }

    getLevel(data) {
        if (!data || typeof data !== 'object' || !data.player_score) return new Error('MUST_SUPPLY', 'data fetched from user');
        const score = data.player_score;
        return Math.max(1, Math.floor(0.03 * Math.sqrt(score)));
    }

    getPlayTime(data) {
        if (!data || typeof data !== 'object' || !data.player_timeplayed) return new Error('MUST_SUPPLY', 'data fetched from user');
        const time = data.player_timeplayed;
        let str = '';
        const minutes = Math.floor(Math.floor(time / 1000) / 60) % 60;
        const hours = Math.floor(Math.floor(Math.floor(time / 1000) / 60) / 60) % 24;
        const days = Math.floor(Math.floor(Math.floor(Math.floor(time / 1000) / 60) / 60) / 24);
        if (days) str += `${days}d `;
        if (hours) str += `${hours}h `;
        if (minutes) str += `${minutes}m`;
        return str;
    }

    getKDR(data) {
        if (!data || typeof data !== 'object' || !data.player_kills || !data.player_deaths) return new Error('MUST_SUPPLY', 'data fetched from user');
        const KDR = data.player_kills / data.player_deaths || 0;
        return KDR.toFixed(2);
    }

    getWL(data) {
        if (!data || typeof data !== 'object' || !data.player_wins || !data.player_games_played) return new Error('MUST_SUPPLY', 'data fetched from user');
        const WL = data.player_wins / data.player_games_played || 0;
        return WL.toFixed(2);
    }

    getSPK(data) {
        if (!data || typeof data !== 'object' || !data.player_score || !data.player_kills) return new Error('MUST_SUPPLY', 'data fetched from user');
        const SPK = data.player_score / data.player_kills || 0;
        return SPK.toFixed(2);
    }

    getSimplified(data) {
        return {
            name: data.player_name,
            id: data.player_id,
            score: data.player_score,
            level: this.getLevel(data),
            kills: data.player_kills,
            deaths: data.player_deaths,
            kdr: this.getKDR(data),
            spk: this.getSPK(data),
            totalGamesPlayed: data.player_games_played,
            wins: data.player_wins,
            loses: data.player_games_played - data.player_wins,
            wl: this.getWL(data),
            playTime: this.getPlayTime(data),
            krunkies: data.player_funds,
            clan: data.player_clan ? data.player_clan : 'No Clan',
            featured: data.player_featured ? data.player_featured : 'No',
            hacker: data.player_hack ? data.player_hack : 'No'
        };
    }
}


function Error() {

}

Error.prototype = {};


unsafeWindow.HackDetect = class {
    static init() {
        this.api = new KrunkerSocial();
        this.players = new Set();
		this.hackers = new Set();

		this.myStats = null;
		this.myName = null;
        setInterval(this.getUsers.bind(this), 1000);
    }

    static getUsers() {
		this.hackers.forEach(hacker => {
            Array.from($("#chatList").children()).forEach(child => {
                const text = $(child).text()
                if (text.indexOf(hacker) >=0 && text.indexOf("HACKER") < 0) {
                    child.innerHTML = child.innerHTML.replace(hacker, hacker + '<span style="color:#64b5f6">[HACKER]</span> ')
                }
            })
        })

        const players = new Set();
        Array.from($("#leaderContainer").children()).forEach(child => {
            if ($(child).find(".leaderName")[0]) {
                let name = $(child).find(".leaderName")[0].innerHTML;
                if (name.indexOf("<span") >= 0) name = name.split("<span")[0];
                if (name.indexOf("Guest") < 0 && name !== "check_circle") players.add(name);
            } else if ($(child).find(".leaderNameM")[0]) {
				let name = $(child).find(".leaderNameM")[0].innerHTML;
                if (name.indexOf("<span") >= 0) name = name.split("<span")[0];
                if (name.indexOf("Guest") < 0 && name !== "check_circle") {
					this.myName = name;
					players.add(name);
				}
			}

        })
        let difference = new Set([...players].filter(x => !this.players.has(x)));

        difference.forEach(player => this.checkPlayer(player));

        this.players = players;
    }

    static checkPlayer(player) {
        const user = this.api.getUser(player);

    }

    static handlePlayer(stats) {
        if (stats.player_name == this.myName) {
			this.myStats = stats;
			this.players.forEach(player => {
				this.checks(player);
			})
		}
        if (stats.player_hack) {
            $("#chatList").append(`<div class="chatItem"><span class="chatMsg"><span style="color:#64b5f6">${stats.player_name}</span> is a flagged <span style="color:#eb5656">HACKER</span></span></div><br>`)
			this.hackers.add(stats.player_name);
            if (stats.player_name !== this.myName) webSocket.send(encode(["c", ["/kick " + stats.player_name]]));
		}
		if (this.myStats) this.checks(stats.player_name);
    }

	static checks(name) {
        //Checks for the future

	}

}

HackDetect.init()
