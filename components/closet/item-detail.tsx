import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReadOnlyNote } from "@/components/auth/read-only-note";
import { isReadOnly } from "@/lib/auth/session";
import { getClosetItem } from "@/lib/closet/items";
import { categoryLabel, tagGroups } from "@/lib/closet/tags";
import { currentUserId } from "@/lib/db/current-user";
import { createServerClient } from "@/lib/db/server";
import { DeleteItem } from "./delete-item";
import { FeelingForm } from "./feeling-form";
import { ItemImage } from "./item-image";
import { TempRangeEditor } from "./temp-range-editor";

export async function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const [item, readOnly] = await Promise.all([
    currentUserId().then((userId) => getClosetItem(createServerClient(), userId, id)),
    isReadOnly(),
  ]);
  if (!item) notFound();

  const [cover, ...more] = item.imageUrls;
  const byline = [item.brand, categoryLabel(item.category)].filter(Boolean).join(" · ");

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <ItemImage
          src={cover ?? null}
          alt={item.title}
          category={item.category}
          swatch={item.swatch}
          sizes="(min-width: 768px) 360px, 100vw"
          aspect="aspect-square md:aspect-[3/4]"
          priority
        />
        {more.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {more.map((src, i) => (
              <li key={src}>
                <ItemImage
                  src={src}
                  alt={`${item.title}, photo ${i + 2}`}
                  category={item.category}
                  swatch={null}
                  sizes="90px"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">{item.title}</h1>
            <p className="mt-1 text-sm text-foreground/60">{byline}</p>
          </div>

          <dl className="flex flex-col gap-2.5 text-sm">
            {tagGroups(item.tags).map((group) => (
              <div key={group.label} className="flex gap-3">
                <dt className="w-16 shrink-0 pt-0.5 text-foreground/60">{group.label}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {group.values.map((value) => (
                    <span
                      key={value}
                      className="rounded-full bg-black/[.05] px-2.5 py-0.5 dark:bg-white/[.08]"
                    >
                      {value}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          <div className="text-sm">
            <TempRangeEditor itemId={item.id} initial={item.tempRangeF} readOnly={readOnly} />
          </div>

          {item.tags.notes && <p className="text-sm text-foreground/80">{item.tags.notes}</p>}

          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start text-sm underline underline-offset-4"
            >
              See it at {item.retailer ?? "the store"}
            </a>
          )}
        </div>

        {readOnly ? (
          <ReadOnlyFeeling text={item.feeling?.text ?? null} />
        ) : (
          <FeelingForm itemId={item.id} initialText={item.feeling?.text ?? null} />
        )}

        {!readOnly && <DeleteItem itemId={item.id} />}
      </div>
    </div>
  );
}

// The demo account sees the feeling but can't write one.
function ReadOnlyFeeling({ text }: { text: string | null }) {
  return (
    <section aria-labelledby="feeling-heading" className="flex flex-col gap-3">
      <h2 id="feeling-heading" className="text-lg font-semibold">
        How it feels
      </h2>
      {text && (
        <p className="w-full whitespace-pre-wrap rounded-xl bg-black/[.04] p-4 leading-relaxed dark:bg-white/[.06]">
          {text}
        </p>
      )}
      <ReadOnlyNote />
    </section>
  );
}

export function ItemDetailSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" aria-busy="true" aria-label="Loading item">
      <div className="aspect-[3/4] animate-pulse rounded-xl bg-black/[.06] dark:bg-white/[.08]" />
      <div className="flex flex-col gap-3">
        <div className="h-7 w-2/3 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-black/[.06] dark:bg-white/[.08]" />
      </div>
    </div>
  );
}
