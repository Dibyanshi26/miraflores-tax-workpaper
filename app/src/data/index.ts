import type {
  Packet, PacketDocument, ExtractedValue, ReturnVersion, ReturnLine, VersionAsset,
} from "../types/packet";

export interface PacketIndex {
  packet: Packet;
  documentsById: Map<string, PacketDocument>;
  evById: Map<string, ExtractedValue>;
  evByDocument: Map<string, ExtractedValue[]>;
  versionsByName: Map<string, ReturnVersion>;
  versionOrder: string[];
  latestVersion: ReturnVersion;
  linesByVersionKey: Map<string, Map<string, ReturnLine>>; // version -> line key -> line
  assetsByVersionId: Map<string, Map<string, VersionAsset>>;
  qaById: Map<string, Packet["client"]["questionnaire"][number]>;
  msgById: Map<string, Packet["client"]["messages"][number]>;
  callById: Map<string, Packet["client"]["call_notes"][number]>;
  staffById: Map<string, Packet["firm"]["staff"][number]>;
  clientUserById: Map<string, Packet["firm"]["client_users"][number]>;
  personById: Map<string, Packet["household"]["people"][number]>;
}

export function buildIndex(packet: Packet): PacketIndex {
  const documentsById = new Map(packet.documents.map((d) => [d.id, d]));
  const evById = new Map(packet.extracted_values.map((v) => [v.id, v]));
  const evByDocument = new Map<string, ExtractedValue[]>();
  for (const v of packet.extracted_values) {
    const arr = evByDocument.get(v.document_id) ?? [];
    arr.push(v);
    evByDocument.set(v.document_id, arr);
  }

  const versionsByName = new Map(packet.return_versions.map((v) => [v.version, v]));
  const versionOrder = [...packet.return_versions.map((v) => v.version)].sort();
  const latestVersion = packet.return_versions[packet.return_versions.length - 1];

  const linesByVersionKey = new Map<string, Map<string, ReturnLine>>();
  const assetsByVersionId = new Map<string, Map<string, VersionAsset>>();
  for (const v of packet.return_versions) {
    linesByVersionKey.set(v.version, new Map(v.lines.map((l) => [l.key, l])));
    assetsByVersionId.set(v.version, new Map(v.assets.map((a) => [a.asset_id, a])));
  }

  const qaById = new Map(packet.client.questionnaire.map((q) => [q.id, q]));
  const msgById = new Map(packet.client.messages.map((m) => [m.id, m]));
  const callById = new Map(packet.client.call_notes.map((c) => [c.id, c]));
  const staffById = new Map(packet.firm.staff.map((s) => [s.id, s]));
  const clientUserById = new Map(packet.firm.client_users.map((c) => [c.id, c]));
  const personById = new Map(packet.household.people.map((p) => [p.id, p]));

  return {
    packet, documentsById, evById, evByDocument, versionsByName, versionOrder,
    latestVersion, linesByVersionKey, assetsByVersionId, qaById, msgById, callById,
    staffById, clientUserById, personById,
  };
}

// Resolve any readme-documented reference string to a human description + navigable target.
export interface ResolvedRef {
  kind: string;
  id: string;
  label: string;
  href?: string; // in-app route, when navigable
}

export function resolveRef(idx: PacketIndex, ref: string): ResolvedRef {
  if (ref.startsWith("ev-")) {
    const ev = idx.evById.get(ref);
    return { kind: "extracted_value", id: ref, label: ev ? `${ev.label}: ${ev.text_as_read || ev.value}` : ref, href: ev ? `/documents/${ev.document_id}?ev=${ref}` : undefined };
  }
  if (/^D\d+$/.test(ref)) {
    const doc = idx.documentsById.get(ref);
    return { kind: "document", id: ref, label: doc ? doc.title : ref, href: `/documents/${ref}` };
  }
  if (ref.startsWith("qa-")) {
    const qa = idx.qaById.get(ref);
    return { kind: "questionnaire", id: ref, label: qa ? qa.question : ref, href: `/client-portal#${ref}` };
  }
  if (ref.startsWith("msg-")) {
    const m = idx.msgById.get(ref);
    return { kind: "message", id: ref, label: m ? m.text.slice(0, 60) : ref, href: `/client-portal#${ref}` };
  }
  if (ref.startsWith("call-")) {
    const c = idx.callById.get(ref);
    return { kind: "call_note", id: ref, label: c ? `Call ${c.date}` : ref, href: `/client-portal#${ref}` };
  }
  if (ref.startsWith("py:/")) {
    return { kind: "prior_year", id: ref, label: `Prior year: ${ref.slice(4)}` };
  }
  if (ref.startsWith("agency:/")) {
    return { kind: "agency", id: ref, label: `Agency record: ${ref.slice(8)}` };
  }
  if (ref.startsWith("asset:")) {
    const assetId = ref.slice(6);
    return { kind: "asset", id: assetId, label: assetId, href: `/depreciation/${assetId}` };
  }
  if (ref.startsWith("household:")) {
    const pid = ref.slice(10);
    const p = idx.personById.get(pid);
    return { kind: "household", id: pid, label: p ? p.name : pid };
  }
  if (ref.startsWith("ref:param.")) {
    return { kind: "parameter", id: ref, label: ref.slice(10) };
  }
  if (ref.startsWith("ref:fx.")) {
    return { kind: "fx", id: ref, label: ref.slice(7) };
  }
  if (ref.startsWith("timeline:") || /^tl-\d+$/.test(ref)) {
    return { kind: "timeline", id: ref, label: ref, href: `/changes#${ref}` };
  }
  if (ref.startsWith("doc:")) {
    return { kind: "document_page", id: ref, label: ref };
  }
  // line key form <form>.<line>
  if (/^[A-Za-z0-9]+\.[A-Za-z0-9.]+$/.test(ref)) {
    return { kind: "line", id: ref, label: ref, href: `/return-summary?line=${ref}` };
  }
  return { kind: "unknown", id: ref, label: ref };
}

// As-of visibility: a document is only "received" once its received_at has passed the
// clock. Applied everywhere a document (or its content) could appear - the documents
// index, the viewer, search, and Home's unaccounted-documents list - so the timeline
// slider actually replays the season instead of only gating the Filing/Changes views.
export function isDocumentVisible(doc: PacketDocument, asOf: string): boolean {
  return doc.received_at <= asOf;
}

export function visibleDocuments(idx: PacketIndex, asOf: string): PacketDocument[] {
  return idx.packet.documents.filter((d) => isDocumentVisible(d, asOf));
}

export interface SourceUsage {
  evToLines: Map<string, string[]>; // ev id -> v3 line keys that cite it
  docToLines: Map<string, string[]>; // document id -> v3 line keys that cite any of its values
}

// Reverse index of return_versions[].lines[].sources, scoped to v3 (what "landed" means
// today). Lets Documents answer "where did this land, or why didn't it" without any
// hardcoded knowledge of which documents are duplicates or superseded.
export function buildSourceUsage(idx: PacketIndex, version = "v3"): SourceUsage {
  const evToLines = new Map<string, string[]>();
  const docToLines = new Map<string, string[]>();
  const lines = idx.versionsByName.get(version)?.lines ?? [];
  for (const l of lines) {
    for (const src of l.sources ?? []) {
      if (!src.startsWith("ev-")) continue;
      const arr = evToLines.get(src) ?? [];
      arr.push(l.key);
      evToLines.set(src, arr);
      const ev = idx.evById.get(src);
      if (ev) {
        const darr = docToLines.get(ev.document_id) ?? [];
        if (!darr.includes(l.key)) darr.push(l.key);
        docToLines.set(ev.document_id, darr);
      }
    }
  }
  return { evToLines, docToLines };
}

// A document has a "disposition" - it's accounted for - when any of:
//  - it landed in at least one v3 return line (via buildSourceUsage)
//  - it's been superseded by a corrected version (documents_superseded)
//  - its extraction carries a reason explaining why it wasn't (fully) extracted
//    (e.g. "page 32 wasn't read by the pipeline" - already explained and, for Meridian,
//    already surfaced as the MERIDIAN-MISSING-LOT check, so it shouldn't also read as an
//    unexplained gap on Home)
//  - it's cited as evidence by an independent check
// What's left after that - signed engagement letters, IDs, informational forms nothing
// else references - is a genuinely open "is this accounted for" question.
export function accountedForDocumentIds(idx: PacketIndex, checkEvidenceRefs: string[]): Set<string> {
  const usage = buildSourceUsage(idx);
  const ids = new Set<string>();
  for (const d of idx.packet.documents) {
    if (d.extraction.reason) ids.add(d.id);
    if ((usage.docToLines.get(d.id)?.length ?? 0) > 0) ids.add(d.id);
  }
  for (const docId of idx.latestVersion.documents_superseded) ids.add(docId);
  for (const ref of checkEvidenceRefs) {
    if (/^D\d+$/.test(ref)) ids.add(ref);
  }
  return ids;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function fmtMoneyCents(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}
