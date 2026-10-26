// Test-only closet for the pairing logic: a work-heavy wardrobe of 19 items
// (5 tops, 4 bottoms, 2 one-pieces, 4 shoes, 3 outerwear, 1 accessory). The
// seed persona has only 3 items, too few to exercise the rules.
import { toClosetItem, type ClosetItem } from "./types";

// Raw tags as stored in items.ai_tags. Only the fields pairing reads are
// typed; `seasons` is filled in for schemas that still require it.
export interface FixtureTags {
  category: "top" | "bottom" | "one_piece" | "shoes" | "outerwear" | "accessory";
  formality: number;
  occasions: ("work" | "social" | "sport" | "home")[];
  colors?: { name: string }[];
  colorFamily?: string;
  tempRangeF?: { min: number; max: number };
}

export function makeItem(id: string, title: string, tags: FixtureTags): ClosetItem {
  const raw = { colors: [], materials: [], seasons: [], ...tags };
  const item = toClosetItem(id, title, raw);
  if (!item) throw new Error(`Invalid fixture tags for ${title}`);
  return item;
}

const c = (name: string) => [{ name }];

export const SAMPLE_CLOSET: ClosetItem[] = [
  makeItem("f06222fb-82ba-483b-8359-3f0d12337f88", "White cotton button-down", {
    category: "top", colors: c("white"), colorFamily: "white", formality: 3,
    tempRangeF: { min: 55, max: 85 }, occasions: ["work", "social"],
  }),
  makeItem("ad173eac-0b0b-4ef7-8505-421a7a8b1613", "Black knit sweater", {
    category: "top", colors: c("black"), colorFamily: "black", formality: 3,
    tempRangeF: { min: 30, max: 60 }, occasions: ["work", "social"],
  }),
  makeItem("432a90cd-60bd-4366-ac59-26c059c7e8cf", "Gray crewneck tee", {
    category: "top", colors: c("heather gray"), colorFamily: "gray", formality: 1,
    tempRangeF: { min: 60, max: 95 }, occasions: ["home", "sport", "social"],
  }),
  makeItem("4d134f0f-fd44-4706-b612-3e6a469f986e", "Hot pink silk camisole", {
    category: "top", colors: c("hot pink"), colorFamily: "pink", formality: 3,
    tempRangeF: { min: 70, max: 95 }, occasions: ["social"],
  }),
  makeItem("3462b3ea-a8a6-41da-9eb5-704d37a8656a", "Navy sports tank", {
    category: "top", colors: c("navy"), colorFamily: "navy", formality: 1,
    tempRangeF: { min: 65, max: 95 }, occasions: ["sport"],
  }),
  makeItem("2fbebb8f-3099-4889-af8b-346cc7de573d", "Dark straight-leg jeans", {
    category: "bottom", colors: c("indigo"), colorFamily: "denim", formality: 2,
    tempRangeF: { min: 20, max: 80 }, occasions: ["work", "social"],
  }),
  makeItem("ad372297-ddda-4065-a206-3d4896daed1c", "Black tailored trousers", {
    category: "bottom", colors: c("black"), colorFamily: "black", formality: 4,
    tempRangeF: { min: 30, max: 75 }, occasions: ["work"],
  }),
  makeItem("d8fc4d41-fd8b-4d02-befb-2acfa5026406", "Red pleated midi skirt", {
    category: "bottom", colors: c("red"), colorFamily: "red", formality: 3,
    tempRangeF: { min: 50, max: 85 }, occasions: ["work", "social"],
  }),
  makeItem("7abdf754-db3a-49f5-91cf-a8f8988ed975", "Black leggings", {
    category: "bottom", colors: c("black"), colorFamily: "black", formality: 1,
    occasions: ["sport", "home"],
  }),
  makeItem("41d1f581-0108-4997-a3e9-5c06feafd0ef", "Navy wrap dress", {
    category: "one_piece", colors: c("navy"), colorFamily: "navy", formality: 3,
    tempRangeF: { min: 55, max: 85 }, occasions: ["work", "social"],
  }),
  makeItem("12ec02a3-1581-4b27-bc7f-7d61388a0227", "Cream linen sundress", {
    category: "one_piece", colors: c("cream"), colorFamily: "cream", formality: 2,
    tempRangeF: { min: 72, max: 100 }, occasions: ["social", "home"],
  }),
  makeItem("dda762cd-90be-4e73-9a53-696319f9b220", "White leather sneakers", {
    category: "shoes", colors: c("white"), colorFamily: "white", formality: 2,
    tempRangeF: { min: 40, max: 90 }, occasions: ["social", "home"],
  }),
  makeItem("0ac227eb-d87c-4edc-bd99-815e88993365", "Black ankle boots", {
    category: "shoes", colors: c("black"), colorFamily: "black", formality: 3,
    tempRangeF: { min: 10, max: 60 }, occasions: ["work", "social"],
  }),
  makeItem("a6963ef8-8fc6-4d5b-af0b-4f7d6ceaa21a", "Running shoes", {
    category: "shoes", colors: c("gray"), colorFamily: "gray", formality: 1,
    occasions: ["sport"],
  }),
  makeItem("644bf735-edcc-4ef8-ae1d-b9721829d1e0", "Tan block-heel sandals", {
    category: "shoes", colors: c("tan"), colorFamily: "brown", formality: 3,
    tempRangeF: { min: 70, max: 100 }, occasions: ["social", "work"],
  }),
  makeItem("93cf3279-cbb5-4b82-a81d-a3b3223db846", "Camel wool coat", {
    category: "outerwear", colors: c("camel"), colorFamily: "brown", formality: 4,
    tempRangeF: { min: 0, max: 50 }, occasions: ["work", "social"],
  }),
  makeItem("16816343-a0f6-4a25-b1df-f763b64a9897", "Denim jacket", {
    category: "outerwear", colors: c("light blue"), colorFamily: "denim", formality: 2,
    tempRangeF: { min: 45, max: 68 }, occasions: ["social", "home"],
  }),
  makeItem("5d7f0eaf-8e55-46fc-a528-cede369a2fd1", "Black puffer jacket", {
    category: "outerwear", colors: c("black"), colorFamily: "black", formality: 2,
    tempRangeF: { min: -10, max: 40 }, occasions: ["home", "sport"],
  }),
  makeItem("395737a1-5511-421a-bec5-fdb2aa7982d9", "Gold hoop earrings", {
    category: "accessory", colors: c("gold"), colorFamily: "yellow", formality: 3,
    occasions: ["work", "social"],
  }),
];
