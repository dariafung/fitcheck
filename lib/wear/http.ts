import { OUTFIT_ERRORS, type OutfitError } from "./messages";

const STATUS: Record<OutfitError, number> = {
  bad_request: 400,
  not_found: 404,
  too_old: 400,
  unknown_items: 400,
  duplicate: 409,
  day_full: 409,
  calendar_off: 409,
};

// The calendar routes' error answer: a code the page can match and the copy
// to show.
export function outfitErrorResponse(error: OutfitError): Response {
  return Response.json({ error, message: OUTFIT_ERRORS[error] }, { status: STATUS[error] });
}
