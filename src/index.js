const {
  errors: { ValidationError },
} = require("@strapi/utils");
const types = ["map", "map-zone", "grenade", "script"];
module.exports = {
  register({ strapi }) {
    strapi.documents.use(async (context, next) => {
      const name = context.uid.split("::")[1]?.split(".")[0];
      if (
        !types.includes(name) ||
        !["create", "update", "publish"].includes(context.action)
      )
        return next();
      // Validate the resulting draft inside the same transaction, rolling back invalid edits.
      return strapi.db.transaction(async () => {
        const publishing =
          context.action === "publish" || context.params.status === "published";
        if (context.action === "publish") {
          const draft = await strapi.documents(context.uid).findOne({
            documentId: context.params.documentId,
            status: "draft",
            populate: "*",
          });
          await validate(strapi, context.uid, name, draft, true);
          return next();
        }
        // Published writes are split into draft validation and publication atomically.
        if (publishing) context.params.status = "draft";
        const result = await next();
        const draft = await strapi.documents(context.uid).findOne({
          documentId: result.documentId,
          status: "draft",
          populate: "*",
        });
        await validate(strapi, context.uid, name, draft, publishing);
        if (publishing)
          return strapi
            .documents(context.uid)
            .publish({ documentId: result.documentId });
        return result;
      });
    });
  },
};
async function validate(strapi, uid, name, d, publishing) {
  if (!d) throw new ValidationError("Draft not found");
  if (!d.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug))
    throw new ValidationError(
      "Slug must contain lowercase letters, digits and hyphens",
    );
  if (name !== "map" && !d.map) throw new ValidationError("Map is required");
  // Serialize uniqueness checks per collection; draft and published copies share documentId.
  await strapi.db.connection.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
    uid,
  ]);
  const filters = {
    slug: d.slug,
    documentId: { $ne: d.documentId },
    ...(name === "map" ? {} : { map: { documentId: d.map.documentId } }),
  };
  const duplicate = await strapi
    .documents(uid)
    .findFirst({ status: "draft", filters });
  if (duplicate)
    throw new ValidationError("Slug must be unique within the map");
  for (const field of name === "grenade"
    ? ["fromZone", "targetZone"]
    : name === "script"
      ? ["zone"]
      : []) {
    if (d[field]) {
      const z = await strapi.documents("api::map-zone.map-zone").findOne({
        documentId: d[field].documentId,
        status: "draft",
        populate: { map: true },
      });
      if (!z || z.map?.documentId !== d.map.documentId)
        throw new ValidationError(`${field} must belong to the selected map`);
    }
  }
  if (name === "script")
    for (const g of d.relatedGrenades || []) {
      const row = await strapi.documents("api::grenade.grenade").findOne({
        documentId: g.documentId,
        status: "draft",
        populate: { map: true },
      });
      if (row?.map?.documentId !== d.map.documentId)
        throw new ValidationError(
          "Related grenades must belong to the selected map",
        );
    }
  if (name === "map-zone") {
    for (const [kind, fields] of [
      ["grenade", ["fromZone", "targetZone"]],
      ["script", ["zone"]],
    ]) {
      const refs = await strapi.documents(`api::${kind}.${kind}`).findMany({
        status: "draft",
        filters: {
          $or: fields.map((f) => ({ [f]: { documentId: d.documentId } })),
        },
        populate: { map: true },
      });
      if (refs.some((r) => r.map?.documentId !== d.map.documentId))
        throw new ValidationError("Zone is used by content on another map");
    }
  }
  if (name === "grenade") {
    const refs = await strapi.documents("api::script.script").findMany({
      status: "draft",
      filters: { relatedGrenades: { documentId: d.documentId } },
      populate: { map: true },
    });
    if (refs.some((r) => r.map?.documentId !== d.map.documentId))
      throw new ValidationError("Grenade is used by a script on another map");
  }
  if (publishing) {
    for (const f of name === "map"
      ? ["cover"]
      : name === "grenade"
        ? ["images"]
        : name === "script"
          ? ["video", "thumbnail"]
          : []) {
      if (!d[f] || (Array.isArray(d[f]) && !d[f].length))
        throw new ValidationError(`${f} is required for publication`);
    }
  }
}
