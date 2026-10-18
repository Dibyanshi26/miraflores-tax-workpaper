// Types for the raw, immutable data packet (okafor_lindqvist_2025_packet.json).
// These mirror the packet's `readme` section. The packet is pipeline output:
// it holds no reviews, notes, sign-offs or decisions - those live in the event log.

export type ValueType =
  | "money" | "date" | "text" | "integer" | "quantity" | "percent"
  | "boolean" | "code" | "ssn" | "ein" | "account_number";

export interface Position { x0: number; y0: number; x1: number; y1: number }

export interface ExtractedValue {
  id: string;
  document_id: string;
  page: number;
  field: string;
  label: string;
  value: string | number | boolean | null;
  value_type: ValueType;
  text_as_read: string;
  position: Position | null;
  confidence: number;
}

export interface DocumentPage {
  page: number;
  printed_content: string;
}

export interface DocumentExtraction {
  status: "extracted" | "partial" | "not_extracted";
  values: number;
  reason: string | null;
}

export interface PacketDocument {
  id: string;
  title: string;
  document_type: string;
  issuer: string;
  belongs_to: string;
  tax_year: number;
  received_at: string;
  uploaded_by: "client" | "firm";
  file_name: string;
  page_count: number;
  pages: DocumentPage[];
  marked_corrected?: boolean;
  extraction: DocumentExtraction;
}

export interface HouseholdPerson {
  id: string;
  role: string;
  name: string;
  ssn: string;
  dob: string;
  relationship?: string;
  months_lived_with_you?: number;
  full_time_student?: boolean;
  occupation?: string;
  ip_pin?: string;
  phone?: string;
  email?: string;
  contact?: Record<string, string>;
}

export interface HouseholdAddress { from: string; to: string | null; address: string; type: string }
export interface Residency { state: string; from: string; to: string | null; status: string }

export interface Household {
  filing_status: string;
  tax_year: number;
  entered_by: string;
  people: HouseholdPerson[];
  addresses: HouseholdAddress[];
  residency: Residency[];
  bank_account_for_refund_or_payment: Record<string, string>;
  prior_year_agi_for_esignature: number;
  related_returns: { who: string; return: string; prepared_by: string; in_this_packet: boolean | string }[];
}

export interface QuestionnaireItem { id: string; question: string; answer: string; answered_by: string; answered_at: string }
export interface MessageItem { id: string; sent_at: string; from: string; to: string; text: string }
export interface CallNote { id: string; date: string; participants: string[]; notes: string[] }

export interface Client {
  questionnaire: QuestionnaireItem[];
  messages: MessageItem[];
  call_notes: CallNote[];
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  credential?: string;
  sensitive_data_clearance: boolean;
  active_from?: string;
  note?: string;
}

export interface ClientUser { id: string; name: string; role: string }

export interface StarterStandards {
  note: string;
  verification_types: string[];
  variance_review: { compare_to: string; flag_if_change_over_percent: number; and_over_amount: number };
  review_levels: string[];
  rules: string[];
  required_steps: string[];
}

export interface Firm {
  name: string;
  staff: StaffMember[];
  firm_identity: Record<string, unknown>;
  client_users: ClientUser[];
  assignment_at_start: { preparer: string; reviewer: string; partner: string };
  deadlines: { what: string; date: string }[];
  budget_hours: Record<string, number>;
  starter_standards: StarterStandards;
}

export interface PriorYearReturn {
  prepared_by: string;
  filed: string;
  residency: string;
  dependents: unknown[];
  lines: Record<string, string | number>;
  line_labels: Record<string, string>;
  line_sources: Record<string, string>;
  notes?: string[];
  K1_1120S?: Record<string, unknown>;
  K1_1065?: Record<string, unknown>;
}

export interface AssetRecord {
  asset_id: string;
  description: string;
  activity: string;
  cost: number;
  land_value?: number;
  placed_in_service: string;
  method: string;
  life_years: number;
  disposed: Record<string, unknown> | null;
  federal: Record<string, number>;
  california: Record<string, number>;
  amt_difference?: number;
  sources: string[];
}

export interface PriorYears {
  return_2024: PriorYearReturn;
  prior_preparer_workpaper: Record<string, unknown>;
  asset_records: AssetRecord[];
  basis_records: Record<string, Record<string, unknown>[]>;
  carryovers_into_2025: Record<string, unknown>;
}

export interface IrsTransaction { date: string; code: string; description: string; amount: number }
export interface IrsTranscriptSnapshot { as_of: string; transactions: IrsTransaction[] }
export interface AgencyNotice {
  id: string; agency: string; type: string; tax_year: number; dated: string;
  summary?: string; status?: string; response_due?: string; document?: string;
  items_under_examination?: string[];
}
export interface EfileSubmission {
  date: string; jurisdiction: string; submission_id: string;
  status: "rejected" | "accepted" | "not_transmitted" | string;
  errors?: { code: string; message: string }[];
}

export interface TaxAgencyRecords {
  irs_account_transcript_2025: IrsTranscriptSnapshot[];
  ftb_account: { as_of: string; tax_year_2025_payments: unknown[]; tax_year_2024_payments_after_filing: unknown[] };
  notices: AgencyNotice[];
  efile: EfileSubmission[];
}

export interface TimelineEvent {
  id: string;
  at: string;
  event: string;
  actor: string | null;
  detail: string | null;
  refs: string[];
}

export interface EngineReference {
  parameters: Record<string, unknown>;
  rules: Record<string, string>;
}

export interface TaxEffectRate { federal_per_dollar: number; california_per_dollar: number }

export interface ReturnLine {
  key: string;
  jurisdiction: "federal" | "california";
  form: string;
  line: string;
  label: string;
  value: number | string;
  rule?: string;
  inputs?: string[];
  sources?: string[];
  note?: string | null;
}

export interface Diagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  refs: string[];
}

export interface ChangeFromPrevious {
  key: string;
  change: "added" | "changed" | "removed";
  old: unknown;
  new: unknown;
}

export interface VersionAsset {
  asset_id: string;
  description: string;
  activity: string;
  cost: number;
  land_value_not_depreciated?: number;
  placed_in_service: string;
  method: string;
  life_years: number;
  federal: { prior_accumulated: number; depreciation_2025: number; accumulated_end: number };
  california: { prior_accumulated: number; depreciation_2025: number; accumulated_end: number };
  amt: { depreciation_2025: number; difference_from_regular: number };
  disposed: Record<string, unknown> | null;
  sources: string[];
}

export interface ReturnVersion {
  version: string;
  computed_at: string;
  trigger: string;
  documents_used: string[];
  documents_superseded: string[];
  summary: { federal: Record<string, number>; california: Record<string, number> };
  tax_effect_rates: Record<string, TaxEffectRate>;
  carryovers_out: { federal: Record<string, number>; california: Record<string, number> };
  assets: VersionAsset[];
  diagnostics: Diagnostic[];
  changes_from_previous: ChangeFromPrevious[];
  lines: ReturnLine[];
}

export interface WhatIfScenarioTotals {
  agi?: number;
  total_agi?: number;
  ca_agi?: number;
  taxable_income?: number;
  total_tax: number;
  payments: number;
  balance_due: number;
  penalty: number;
}

export interface WhatIfAlternative {
  id: string;
  description: string;
  base_version: string;
  choices?: Record<string, unknown>;
  federal: { base: WhatIfScenarioTotals; alternative: WhatIfScenarioTotals; total_tax_change: number; penalty_change?: number };
  california: { base: WhatIfScenarioTotals; alternative: WhatIfScenarioTotals; total_tax_change: number; penalty_change?: number };
  changed_lines: { key: string; old: unknown; new: unknown }[];
}

export interface WhatIf {
  alternatives: WhatIfAlternative[];
  extension: {
    computed_at: string;
    based_on_version: string;
    federal: Record<string, unknown>;
    california: Record<string, unknown>;
  };
}

export interface Packet {
  packet: { name: string; version: string; generated: string; client_id: string };
  readme: Record<string, unknown>;
  household: Household;
  documents: PacketDocument[];
  extracted_values: ExtractedValue[];
  client: Client;
  firm: Firm;
  prior_years: PriorYears;
  tax_agency_records: TaxAgencyRecords;
  timeline: TimelineEvent[];
  engine_reference: EngineReference;
  return_versions: ReturnVersion[];
  what_if: WhatIf;
  planning_reference_2026: Record<string, unknown>;
  post_filing_rates: Record<string, unknown>;
  fx_rates: Record<string, unknown>;
}
