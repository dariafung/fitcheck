import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { ItemWearRow } from "@/components/calendar/item-wear-row";
import { isReadOnly } from "@/lib/auth/session";
import { getClosetItem } from "@/lib/closet/items";
import { categoryLabel, tagGroups } from "@/lib/closet/tags";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { tempUnitFor } from "@/lib/profile/temp-setting";
import { readSize, sizeText } from "@/lib/resale/size";
import { BuyerMatches } from "./buyer-matches";
import { DeleteItem } from "./delete-item";
import { FeelingForm } from "./feeling-form";
import { EditDetailsButton, ItemEditor } from "./item-editor";
import { ItemImage } from "./item-image";
import { ItemSize } from "./item-size";
import { PassOnToggle } from "./pass-on-toggle";

export async function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const userId = await currentUserId();
  const [item, readOnly, unit] = await Promise.all([
    getClosetItem(createServerClient(), userId, id),
    isReadOnly(),
    tempUnitFor(userId),
  ]);
  if (!item) notFound();

  const [cover, ...more] = item.imageUrls;
  const byline = [item.brand, categoryLabel(item.category)].filter(Boolean).join(" · ");
  const status = item.status === "passing_on" ? "passing_on" : "active";
  const details = { title: item.title, brand: item.brand, size: item.size, tags: item.tags, imageUrls: item.imageUrls };
  // Accessories aren't matched with buyers.
  const findsBuyers = status === "passing_on" && item.category !== "accessory";

  return (
    <ItemEditor itemId={item.id} details={details} tempUnit={unit}>
      <div className="grid gap-x-4 gap-y-10 md:grid-cols-12">
        <div className="flex flex-col gap-4 md:col-span-6 lg:col-span-6">
          <ItemImage
            src={cover ?? null}
            alt={item.title}
            category={item.category}
            swatch={item.swatch}
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
          />
          {more.length > 0 && (
            <ul className="grid grid-cols-4 gap-4">
              {more.map((src, i) => (
                <li key={src}>
                  <ItemImage
                    src={src}
                    alt={`${item.title}, photo ${i + 2}`}
                    category={item.category}
                    swatch={null}
                    sizes="160px"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The Row's product column: narrow, quiet, held in view while the photo scrolls. */}
        <div className="flex flex-col gap-16 md:col-span-6 md:col-start-7 lg:col-span-4 lg:col-start-8 md:sticky md:top-10 md:self-start">
          <div className="flex flex-col gap-8">
            <div>
              <h1 className="text-title font-medium">{item.title}</h1>
              <p className="mt-2 text-sm text-ink-2">{byline}</p>
            </div>

            {status === "passing_on" && (
              <div className="flex flex-col gap-3">
                <p className="notice">Passing on. It&apos;s left out of your outfits and buy checks.</p>
                <ItemSize
                  itemId={item.id}
                  size={item.size}
                  readable={item.size !== null && readSize(item.size, item.tags.category) !== null}
                  readOnly={readOnly}
                />
              </div>
            )}

            <dl className="border-t border-line text-sm">
              {tagGroups(item.tags, unit).map((group) => (
                <div key={group.label} className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line py-3">
                  <dt className="text-ink-2">{group.label}</dt>
                  <dd className="flex flex-wrap gap-x-1">
                    {group.values.map((value) => (
                      <span key={value} className="after:content-[','] last:after:content-none">
                        {value}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
              {status === "active" && item.size && (
                <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-line py-3">
                  <dt className="text-ink-2">Size</dt>
                  <dd>{sizeText(item.size)}</dd>
                </div>
              )}
              <ItemWearRow itemId={item.id} />
            </dl>

            {!readOnly && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <EditDetailsButton />
                <PassOnToggle itemId={item.id} status={status} size={item.size} />
              </div>
            )}

            {item.tags.notes && <p className="text-base">{item.tags.notes}</p>}

            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text self-start text-ink"
              >
                See it at {item.retailer ?? "the store"}
              </a>
            )}
          </div>

          {findsBuyers && <BuyerMatches itemId={item.id} size={item.size} />}

          {readOnly ? (
            <ReadOnlyFeeling text={item.feeling?.text ?? null} />
          ) : (
            <FeelingForm itemId={item.id} initialText={item.feeling?.text ?? null} />
          )}

          {!readOnly && (
            <div className="border-t border-line pt-4">
              <DeleteItem itemId={item.id} />
            </div>
          )}
        </div>
      </div>
    </ItemEditor>
  );
}

// The demo account sees the feeling but can't write one.
function ReadOnlyFeeling({ text }: { text: string | null }) {
  return (
    <section aria-labelledby="feeling-heading" className="flex flex-col gap-3">
      <h2 id="feeling-heading" className="text-lg font-medium">
        How it feels
      </h2>
      {text && <p className="font-serif text-lg whitespace-pre-wrap">{text}</p>}
      <ReadOnlyNote />
    </section>
  );
}

export function ItemDetailSkeleton() {
  return (
    <div className="grid gap-x-4 gap-y-10 md:grid-cols-12" aria-busy="true" aria-label="Loading item">
      <div className="aspect-[4/5] bg-tile motion-safe:animate-pulse md:col-span-6" />
      <div className="flex flex-col gap-3 md:col-span-6 md:col-start-7 lg:col-span-4 lg:col-start-8">
        <div className="h-8 w-2/3 bg-tile motion-safe:animate-pulse" />
        <div className="h-4 w-1/3 bg-tile motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
