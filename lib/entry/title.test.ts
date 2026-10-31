import { describe, expect, it } from "vitest";
import { cleanTitle } from "./title";

describe("cleanTitle", () => {
  it("drops a store note after an asterisk at the end", () => {
    expect(cleanTitle('Speed Up High-Rise Short 4" *Updated', "lululemon")).toBe('Speed Up High-Rise Short 4"');
    expect(cleanTitle("Softstreme High-Rise Pant *Regular", "lululemon")).toBe("Softstreme High-Rise Pant");
    expect(cleanTitle("Swiftly Tech Short-Sleeve Shirt 2.0 *Waist Length", "lululemon")).toBe(
      "Swiftly Tech Short-Sleeve Shirt 2.0",
    );
  });

  it("keeps an asterisk that is not a note at the end", () => {
    expect(cleanTitle("Align* High-Rise Pant", "lululemon")).toBe("Align* High-Rise Pant");
  });

  it("drops ® ™ © signs", () => {
    expect(cleanTitle("Supima® Long Sleeve T-Shirt", "UNIQLO")).toBe("Supima Long Sleeve T-Shirt");
    expect(cleanTitle("Coolmax™ Sock ©", undefined)).toBe("Coolmax Sock");
  });

  it("drops the brand at the start, in any case and with a separator", () => {
    expect(cleanTitle("Hollister Feel Good Oversized Hoodie", "HOLLISTER")).toBe("Feel Good Oversized Hoodie");
    expect(cleanTitle("Hollister Feel Good Low-Rise Baggy Sweatpants", "Hollister")).toBe(
      "Feel Good Low-Rise Baggy Sweatpants",
    );
    expect(cleanTitle("lululemon - Align Pant", "lululemon")).toBe("Align Pant");
    expect(cleanTitle("Hollister: Logo Tee", "HOLLISTER")).toBe("Logo Tee");
  });

  it("knows several-word brands and the built-in aliases", () => {
    expect(cleanTitle("Abercrombie & Fitch Essential Tee", "ABERCROMBIE & FITCH")).toBe("Essential Tee");
    expect(cleanTitle("A&F Essential Tee", "Abercrombie & Fitch")).toBe("Essential Tee");
    expect(cleanTitle("Hollister Co. Logo Hoodie", "HOLLISTER")).toBe("Logo Hoodie");
  });

  it("keeps the brand when it is the whole name or starts a collaboration", () => {
    expect(cleanTitle("Hollister", "HOLLISTER")).toBe("Hollister");
    expect(cleanTitle("adidas x Wales Bonner Samba", "adidas")).toBe("adidas x Wales Bonner Samba");
  });

  it("keeps a brand that is not at the start, or with no brand known", () => {
    expect(cleanTitle("Feel Good Hollister Hoodie", "HOLLISTER")).toBe("Feel Good Hollister Hoodie");
    expect(cleanTitle("Hollister Feel Good Oversized Hoodie", undefined)).toBe("Hollister Feel Good Oversized Hoodie");
  });

  it("writes an all-caps name in title case", () => {
    expect(cleanTitle("FAUX SUEDE BELTED JACKET", "ZARA")).toBe("Faux Suede Belted Jacket");
    expect(cleanTitle("SUPIMA® LONG SLEEVE T-SHIRT", "ZARA")).toBe("Supima Long Sleeve T-Shirt");
    expect(cleanTitle("V-NECK T-SHIRT", "ZARA")).toBe("V-Neck T-Shirt");
    expect(cleanTitle("JAPAN PRO", "ASICS")).toBe("Japan Pro");
    expect(cleanTitle("SOFT RUCHED LOAFERS", "ZARA")).toBe("Soft Ruched Loafers");
    expect(cleanTitle("WOMEN'S FLEECE SHORTS", undefined)).toBe("Women's Fleece Shorts");
  });

  it("keeps small words lowercase unless first", () => {
    expect(cleanTitle("BELTED JACKET WITH POCKETS", "ZARA")).toBe("Belted Jacket with Pockets");
    expect(cleanTitle("THE MADE-TO-ORDER COAT", undefined)).toBe("The Made-to-Order Coat");
  });

  it("keeps words with no vowel in caps, taking them for acronyms", () => {
    expect(cleanTitle("ZW COLLECTION HIGH-RISE STRAIGH...", "ZARA")).toBe("ZW Collection High-Rise Straigh...");
    expect(cleanTitle("TRF WIDE-LEG JEANS", "ZARA")).toBe("TRF Wide-Leg Jeans");
  });

  it("drops the brand before deciding the case", () => {
    expect(cleanTitle("ZARA FAUX SUEDE JACKET", "ZARA")).toBe("Faux Suede Jacket");
    expect(cleanTitle("HOLLISTER Feel Good Hoodie", "HOLLISTER")).toBe("Feel Good Hoodie");
  });

  it("leaves a name with any lowercase letter as it is", () => {
    expect(cleanTitle("100% Cotton Crew Baby Tee", "HOLLISTER")).toBe("100% Cotton Crew Baby Tee");
    expect(cleanTitle("Men's Tree Runner", "Allbirds")).toBe("Men's Tree Runner");
    expect(cleanTitle("ZW Collection High-Rise Jeans", "ZARA")).toBe("ZW Collection High-Rise Jeans");
  });

  it("tidies spaces and never returns an empty name", () => {
    expect(cleanTitle("  Feel   Good  Hoodie ", undefined)).toBe("Feel Good Hoodie");
    expect(cleanTitle("®", undefined)).toBe("®");
  });
});
