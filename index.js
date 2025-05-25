// baş kaldıranın başını sikeriz
"use strict";
const tls = require("tls"), WebSocket = require("ws"), extractJsonFromString = require("extract-json-from-string");
const axios = require("axios"), config = require("./config.js"), fs = require('fs');

let vanity;
const guilds = {}, token = config.token, guildId = config.guildid, webhookURL = config.webhookURL;
let mfa = "";

try {
  const mfaData = JSON.parse(fs.readFileSync('mfa.json', 'utf-8'));
  mfa = mfaData.token;
  console.log("[MFA] Loaded");
} catch (e) { console.log("[MFA] Not found or invalid"); }

const tlsSocket = tls.connect({
  host: "canary.discord.com", port: 443, minVersion: "TLSv1.2", maxVersion: "TLSv1.3",
  ciphers: 'ECDHE+AESGCM:ECDHE+CHACHA20', servername: "canary.discord.com", rejectUnauthorized: false
});

tlsSocket.on("data", async data => {
  const ext = await extractJsonFromString(data.toString());
  const find = ext.find(e => e.code) || ext.find(e => e.message);
  if (find) try { await axios.post(webhookURL, { content: `@everyone böyle işlerin sonu yok ${vanity} \n\`\`\`json\n${JSON.stringify(find)}\`\`\`` }); } catch (e) {}
});

tlsSocket.on("error", () => {}).on("end", () => {}).on("secureConnect", () => connectWebSocket(tlsSocket));

function connectWebSocket(tlsSocket) {
  const websocket = new WebSocket("wss://gateway.discord.gg/");
  websocket.onclose = () => setTimeout(() => connectWebSocket(tlsSocket), 5000);
  websocket.onerror = () => websocket.close();

  websocket.onmessage = async message => {
    const { d, op, t } = JSON.parse(message.data);

    if (t === "GUILD_UPDATE" || t === "GUILD_DELETE") {
      const find = t === "GUILD_UPDATE" ? guilds[d.guild_id] : guilds[d.id];
      const shouldSend = t === "GUILD_UPDATE" ? (find && find !== d.vanity_url_code) : find;
      
      if (shouldSend) {
        const requestBody = JSON.stringify({ code: find });
        const PATCH_TEMPLATE = `PATCH /api/v6/guilds/${guildId}/vanity-url HTTP/1.1\r\nHost: canary.discord.com\r\nAuthorization: ${token}\r\nUser-Agent: Ultra/1.0\r\nX-Super-Properties: eyJicm93c2VyIjoiQ2hyb21lIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiQ2hyb21lIiwiY2xpZW50X2J1aWxkX251bWJlciI6MzU1NjI0fQ==\r\nContent-Type: application/json\r\nAccept: */*\r\nConnection: keep-alive\r\nCache-Control: no-cache\r\nX-Discord-MFA-Authorization: ${mfa}\r\nContent-Length: ${requestBody.length}\r\n\r\n`;
        
        const patchRequest = Buffer.concat([Buffer.from(PATCH_TEMPLATE), Buffer.from(requestBody)]);
        tlsSocket.write(patchRequest);
        tlsSocket.write(patchRequest);
        vanity = `${find} ${t.toLowerCase()}`;
      }
    } else if (t === "READY") {
      d.guilds.forEach((guild) => { if (guild.vanity_url_code) guilds[guild.id] = guild.vanity_url_code; });
      Object.entries(guilds).forEach(([guildId, vanityUrlCode]) => {
        console.log("\x1b[35m[ Made By Stezy ] \x1b[37m ||\x1b[31m", `GuildId : ${guildId}\x1b[37m || \x1b[34mVanity :  ${vanityUrlCode}`);
      });
    }

    if (op === 10) {
      console.log("WebSocket connected");
      websocket.send(JSON.stringify({
        op: 2, d: { token: token, intents: 1, properties: { os: "Linux", browser: "Firefox", device: "Stezy" } }
      }));
      
      const heartbeatInterval = setInterval(() => {
        if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify({ op: 1, d: {}, s: null, t: "heartbeat" }));
        else clearInterval(heartbeatInterval);
      }, d.heartbeat_interval);
      
      websocket.addEventListener('close', () => clearInterval(heartbeatInterval));
    } else if (op === 7) websocket.close();
  };
}

setInterval(async () => {
  try {
    const data = JSON.parse(fs.readFileSync('mfa.json', 'utf-8'));
    if (mfa !== data.token) { mfa = data.token; console.log("[MFA] Updated"); }
  } catch (e) {}
}, 10000);