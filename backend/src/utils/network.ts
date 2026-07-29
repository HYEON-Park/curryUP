import os from "node:os";

// 같은 네트워크의 다른 기기(폰 등)에서 접속·이메일 인증 링크 클릭이 가능하도록,
// localhost 대신 이 PC의 LAN IPv4를 base URL로 쓴다.
// 사설 대역 선호 순위: 192.168.* > 10.* > 그 외(172.16~31.* 가상스위치 등은 후순위).
export function getLanIp(): string | null {
  const candidates: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] ?? []) {
      if (info.family === "IPv4" && !info.internal) candidates.push(info.address);
    }
  }
  if (candidates.length === 0) return null;
  const rank = (ip: string): number => {
    if (ip.startsWith("192.168.")) return 0;
    if (ip.startsWith("10.")) return 1;
    return 2;
  };
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0];
}

// 이메일 인증 링크 등 외부에서 접근할 base URL.
// APP_BASE_URL(.env)로 명시 가능하며, 없으면 LAN IP(없으면 localhost)로 자동 구성한다.
export function getBaseUrl(port: number | string): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const ip = getLanIp() ?? "localhost";
  return `http://${ip}:${port}`;
}
