/** Only company and application reference are allowed in notification previews. */
export type ApplicationKind = "b2b_customer" | "supplier";
export function makeBusinessApplicationAlert(input: {
  kind: ApplicationKind; id: number; companyName?: string | null; reapplied?: boolean;
}) {
  if (!Number.isSafeInteger(input.id) || input.id <= 0) throw new Error("Invalid application id");
  const name = String(input.companyName || "").trim().replace(/\s+/g," ").slice(0,90) || "Yeni firma";
  const supplier = input.kind === "supplier";
  return {
    title: supplier
      ? input.reapplied ? "Tedarikçi yeniden başvurusu" : "Yeni tedarikçi başvurusu"
      : input.reapplied ? "Firma yeniden başvurusu" : "Yeni firma başvurusu",
    body: name + " · " + (supplier ? "Pazaryeri" : "Üyelik") + " onayı bekliyor.",
    data: supplier
      ? {type:"supplier_application",supplierId:String(input.id)}
      : {type:"b2b_application",applicationId:String(input.id)},
  };
}
