import { exec } from "node:child_process";
import notifier from "node-notifier";

function openUrl(url: string): void {
  // Windows 전용: 기본 브라우저로 URL을 연다.
  exec(`start "" "${url}"`);
}

export function notifyWithLink(options: { title: string; message: string; url: string }): void {
  notifier.notify({ title: options.title, message: options.message });
  notifier.once("click", () => openUrl(options.url));
}
