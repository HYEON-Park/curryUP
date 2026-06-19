import axios from "axios";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface SearchResult {
  title: string;
  snippet: string;
}

export async function webSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const response = await axios.get<string>("https://html.duckduckgo.com/html/", {
    params: { q: query },
    headers: { "User-Agent": USER_AGENT },
    timeout: 15000,
  });
  const $ = cheerio.load(response.data);
  const results: SearchResult[] = [];

  $(".result__a").each((i, el) => {
    if (i >= limit) return;
    const title = $(el).text().trim();
    const snippet = $(el).closest(".result").find(".result__snippet").first().text().trim();
    if (title) results.push({ title, snippet });
  });

  return results;
}
