import type { SourcePageLink, SourcePageSnapshot } from "@keiba-ai-assistant/models";

/** レースページ内のリンクから、馬詳細ページらしいURLだけを重複なく抽出する。 */
export const findHorseDetailLinks = (racePage: SourcePageSnapshot): SourcePageLink[] => {
  const seen = new Set<string>();
  const horseLinks: SourcePageLink[] = [];

  for (const link of racePage.links) {
    const href = normalizeHorseDetailHref(link.href);
    if (href === null || seen.has(href)) {
      continue;
    }

    seen.add(href);
    horseLinks.push({ ...link, href });
  }

  return horseLinks;
};

/** netKeibaの馬詳細ページURLであれば、PC版の馬詳細URLに正規化して返す。 */
export const normalizeHorseDetailHref = (href: string): string | null => {
  const url = parseUrl(href);
  if (url === null) {
    return null;
  }

  const horseId = extractHorseId(url);
  if (horseId === null) {
    return null;
  }

  return buildHorseDetailUrl(horseId);
};

/** netKeibaの馬詳細ページURLから血統ページURLを作る。 */
export const buildHorsePedigreeHref = (horseDetailHref: string): string | null => {
  const url = parseUrl(horseDetailHref);
  if (url === null) {
    return null;
  }

  const horseId = extractHorseId(url);
  if (horseId === null) {
    return null;
  }

  return buildHorsePedigreeUrl(horseId);
};

/** netKeibaの馬詳細ページURLから馬IDを読み取る。 */
export const readHorseIdFromDetailHref = (horseDetailHref: string): string | null => {
  const url = parseUrl(horseDetailHref);
  if (url === null) {
    return null;
  }

  return extractHorseId(url);
};

/** 文字列をURLとして解釈できる場合だけURLを返す。 */
const parseUrl = (href: string): URL | null => {
  try {
    return new URL(href);
  } catch {
    return null;
  }
};

/** PC版とSP版モーダルのリンク形式から馬IDを抽出する。 */
const extractHorseId = (url: URL): string | null => {
  const pathHorseId = url.pathname.match(/^\/horse\/([0-9A-Za-z]+)\/?$/)?.[1];
  if (pathHorseId !== undefined) {
    return pathHorseId;
  }

  const queryHorseId = url.searchParams.get("horse_id");
  if (queryHorseId !== null && /^[0-9A-Za-z]+$/.test(queryHorseId)) {
    return queryHorseId;
  }

  return null;
};

/** 馬IDからPC版の馬詳細URLを作る。 */
const buildHorseDetailUrl = (horseId: string): string => {
  return `https://db.netkeiba.com/horse/${horseId}/`;
};

/** 馬IDからPC版の血統ページURLを作る。 */
const buildHorsePedigreeUrl = (horseId: string): string => {
  return `https://db.netkeiba.com/horse/ped/${horseId}/`;
};
