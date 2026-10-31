// Brand spellings: a built-in list of common clothing and shoe brands,
// written as on each brand's logo, and the matching that lines up a brand
// the model read (or the user is typing) with the user's own spellings and
// this list. No server-only imports: the item card bundles this file.

export interface Brand {
  name: string;
  aliases?: string[];
}

// "unsure" marks a logo spelling we could not confirm.
export const BRANDS: Brand[] = [
  // Fast fashion and the mall.
  { name: "ZARA" },
  { name: "H&M", aliases: ["HM"] },
  { name: "UNIQLO" },
  { name: "GAP" },
  { name: "OLD NAVY" },
  { name: "BANANA REPUBLIC" },
  { name: "J.CREW" },
  { name: "Madewell" }, // unsure
  { name: "EVERLANE" },
  { name: "ARITZIA" },
  { name: "ABERCROMBIE & FITCH", aliases: ["A&F", "Abercrombie"] }, // unsure
  { name: "HOLLISTER", aliases: ["Hollister Co.", "Hollister California"] }, // unsure
  { name: "AMERICAN EAGLE", aliases: ["American Eagle Outfitters", "AE"] }, // unsure
  { name: "aerie" },
  { name: "URBAN OUTFITTERS", aliases: ["UO"] },
  { name: "FREE PEOPLE" },
  { name: "ANTHROPOLOGIE" },
  { name: "FOREVER 21", aliases: ["F21"] },
  { name: "MANGO" },
  { name: "COS" },
  { name: "& Other Stories", aliases: ["Other Stories"] },
  { name: "MASSIMO DUTTI" },
  { name: "Bershka" },
  { name: "PULL&BEAR" },
  { name: "Stradivarius" }, // unsure
  { name: "TOPSHOP" },
  { name: "asos" },
  { name: "SHEIN" },
  { name: "Brandy Melville" }, // unsure
  { name: "Princess Polly" }, // unsure
  { name: "Reformation" }, // unsure
  { name: "EXPRESS" },
  { name: "LOFT", aliases: ["Ann Taylor LOFT"] },
  { name: "ANN TAYLOR" },
  { name: "CLUB MONACO" },
  { name: "Quince" }, // unsure
  { name: "SKIMS" },
  { name: "GOOD AMERICAN" },
  // Denim and classics.
  { name: "Levi's", aliases: ["Levi Strauss", "Levi Strauss & Co."] },
  { name: "Wrangler" },
  { name: "Lee" },
  { name: "AGOLDE" },
  { name: "Citizens of Humanity" }, // unsure
  { name: "Lucky Brand" },
  { name: "GUESS" },
  { name: "CALVIN KLEIN", aliases: ["CK"] },
  { name: "TOMMY HILFIGER" },
  { name: "Ralph Lauren", aliases: ["Polo Ralph Lauren"] }, // unsure
  { name: "LACOSTE" },
  { name: "Carhartt", aliases: ["Carhartt WIP"] }, // unsure
  { name: "Dickies" },
  { name: "Champion" },
  // Sport and outdoor.
  { name: "NIKE" },
  { name: "adidas" },
  { name: "lululemon", aliases: ["lululemon athletica"] },
  { name: "UNDER ARMOUR" },
  { name: "PUMA" },
  { name: "Reebok" },
  { name: "new balance" },
  { name: "ASICS" }, // unsure
  { name: "FILA" },
  { name: "Athleta" }, // unsure
  { name: "alo", aliases: ["Alo Yoga"] }, // unsure
  { name: "VUORI" },
  { name: "OUTDOOR VOICES" }, // unsure
  { name: "GYMSHARK" },
  { name: "FABLETICS" },
  { name: "Beyond Yoga" }, // unsure
  { name: "SWEATY BETTY" }, // unsure
  { name: "THE NORTH FACE", aliases: ["North Face", "TNF"] },
  { name: "patagonia" },
  { name: "Columbia", aliases: ["Columbia Sportswear"] },
  { name: "ARC'TERYX" },
  { name: "CANADA GOOSE" },
  { name: "MONCLER" },
  { name: "Stüssy" },
  // Shoes.
  { name: "CONVERSE" },
  { name: "VANS" },
  { name: "On", aliases: ["On Running"] },
  { name: "HOKA", aliases: ["Hoka One One"] },
  { name: "Brooks", aliases: ["Brooks Running"] }, // unsure
  { name: "saucony" },
  { name: "SALOMON" },
  { name: "allbirds" },
  { name: "SKECHERS" },
  { name: "BIRKENSTOCK" },
  { name: "crocs" },
  { name: "UGG" },
  { name: "DR. MARTENS", aliases: ["Doc Martens"] },
  { name: "Timberland" },
  { name: "STEVE MADDEN" },
  { name: "Sam Edelman" }, // unsure
  { name: "Clarks" },
  { name: "Keds" },
  { name: "Superga" },
  { name: "VEJA" },
  { name: "GOLDEN GOOSE" },
  { name: "Teva" },
  { name: "SOREL" },
  { name: "HUNTER" },
  // Designer.
  { name: "COACH" },
  { name: "kate spade", aliases: ["kate spade new york"] },
  { name: "MICHAEL KORS" },
  { name: "TORY BURCH" },
  { name: "theory" },
  { name: "Vince" }, // unsure
  { name: "SANDRO" },
  { name: "maje" },
  { name: "REISS" },
  { name: "ALLSAINTS" },
  { name: "GANNI" },
  { name: "TOTEME" },
  { name: "Acne Studios" },
  { name: "JACQUEMUS" },
  { name: "Max Mara" }, // unsure
  { name: "BURBERRY" },
  { name: "GUCCI" },
  { name: "PRADA" },
  { name: "MIU MIU" },
  { name: "LOUIS VUITTON", aliases: ["LV"] },
  { name: "CHANEL" },
  { name: "DIOR" },
  { name: "SAINT LAURENT", aliases: ["YSL", "Yves Saint Laurent"] },
  { name: "BALENCIAGA" },
  { name: "BOTTEGA VENETA" },
  { name: "LOEWE" },
  { name: "CELINE" },
  { name: "VERSACE" },
  { name: "FENDI" },
  { name: "GIVENCHY" },
  { name: "VALENTINO" },
];

function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[&+]/g, " and ");
}

// What two spellings must share to be the same brand: case, spaces,
// punctuation and accents don't count, and & means and.
// "H & M", "h&m" and "H and M" are all "handm".
export function brandKey(text: string): string {
  return plain(text).replace(/[^a-z0-9]/g, "");
}

function words(text: string): string[] {
  return plain(text).split(/[^a-z0-9]+/).filter(Boolean);
}

// Every key of the built-in list (names and aliases) → its entry.
const BUILT_IN = new Map<string, Brand>();
for (const brand of BRANDS) {
  for (const spelling of [brand.name, ...(brand.aliases ?? [])]) BUILT_IN.set(brandKey(spelling), brand);
}

// Spellings of one brand share a group: the built-in entry when there is
// one (so an alias and the name group together), else the key.
function group(key: string): string {
  return BUILT_IN.get(key)?.name ?? key;
}

export interface SavedBrand {
  brand: string;
  // When the item was saved (ISO); breaks ties between spellings.
  savedAt: string;
}

// The user's brands from their saved items: one spelling per brand, the
// most saved brand first. Of several spellings of one brand, the built-in
// one wins, then the most used, then the latest.
export function savedBrandNames(rows: SavedBrand[]): string[] {
  const groups = new Map<string, { count: number; latest: string; spellings: Map<string, { count: number; latest: string }> }>();
  for (const { brand, savedAt } of rows) {
    const name = brand.trim();
    const key = brandKey(name);
    if (!key) continue;
    const id = group(key);
    const entry = groups.get(id) ?? { count: 0, latest: "", spellings: new Map() };
    entry.count++;
    if (savedAt > entry.latest) entry.latest = savedAt;
    const spelling = entry.spellings.get(name) ?? { count: 0, latest: "" };
    spelling.count++;
    if (savedAt > spelling.latest) spelling.latest = savedAt;
    entry.spellings.set(name, spelling);
    groups.set(id, entry);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.latest.localeCompare(a.latest))
    .map(([id, { spellings }]) => {
      if (spellings.has(id)) return id;
      return [...spellings.entries()].sort(
        ([, a], [, b]) => b.count - a.count || b.latest.localeCompare(a.latest),
      )[0][0];
    });
}

// A brand the model read, in the user's spelling if they have saved that
// brand, else the built-in spelling, else as read. Nothing fuzzy: only
// spellings with the same key (or aliases of one entry) match.
export function alignBrand(brand: string | undefined, saved: string[]): string | undefined {
  const text = brand?.trim();
  if (!text) return undefined;
  const key = brandKey(text);
  if (!key) return text;
  const own =
    saved.find((s) => brandKey(s) === key) ?? saved.find((s) => group(brandKey(s)) === group(key));
  return own ?? BUILT_IN.get(key)?.name ?? text;
}

export const MAX_BRAND_SUGGESTIONS = 8;

const BUILT_IN_SORTED = [...BRANDS]
  .sort((a, b) => brandKey(a.name).localeCompare(brandKey(b.name)))
  .map((b) => ({ name: b.name, spellings: [b.name, ...(b.aliases ?? [])] }));

// Brands to offer while typing: the user's own first, then the built-in
// list. Within each, spellings that start with what was typed come before
// ones where a later word does ("fitch"), and aliases count ("hm" → H&M).
export function suggestBrands(query: string, saved: string[], limit = MAX_BRAND_SUGGESTIONS): string[] {
  const typed = brandKey(query);
  if (!typed) return [];
  const rank = (spellings: string[]): number | null => {
    if (spellings.some((s) => brandKey(s).startsWith(typed))) return 0;
    if (spellings.some((s) => words(s).some((w, i) => i > 0 && w.startsWith(typed)))) return 1;
    return null;
  };
  const taken = new Set<string>();
  const pick = (candidates: { name: string; spellings: string[] }[]) =>
    candidates
      .flatMap((c, order) => {
        const id = group(brandKey(c.name));
        if (taken.has(id)) return [];
        taken.add(id);
        const r = rank(c.spellings);
        return r === null ? [] : [{ name: c.name, r, order }];
      })
      .sort((a, b) => a.r - b.r || a.order - b.order)
      .map((c) => c.name);
  const own = pick(
    saved.map((name) => {
      const entry = BUILT_IN.get(brandKey(name));
      return { name, spellings: [name, ...(entry ? [entry.name, ...(entry.aliases ?? [])] : [])] };
    }),
  );
  const builtIn = pick(BUILT_IN_SORTED);
  return [...own, ...builtIn].slice(0, limit);
}
