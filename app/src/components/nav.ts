import type { RoleId } from "../types/domain";

export interface NavItem {
  to: string;
  label: string;
  hideFor?: RoleId[]; // roles that don't see this in the nav
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Home" },
      { to: "/return-summary", label: "Return summary" },
      { to: "/checks", label: "Checks", hideFor: ["client"] },
    ],
  },
  {
    title: "Areas",
    items: [
      { to: "/area/intake_and_engagement", label: "Intake & engagement", hideFor: ["client"] },
      { to: "/area/wages_and_stock_compensation", label: "Wages & stock comp", hideFor: ["client"] },
      { to: "/area/investments_and_digital_assets", label: "Investments & digital assets", hideFor: ["client"] },
      { to: "/area/business", label: "Business", hideFor: ["client"] },
      { to: "/area/rentals_and_sale", label: "Rentals & sale", hideFor: ["client"] },
      { to: "/area/pass_throughs_and_basis", label: "Pass-throughs & basis", hideFor: ["client"] },
      { to: "/area/deductions_and_credits", label: "Deductions & credits", hideFor: ["client"] },
      { to: "/area/california", label: "California", hideFor: ["client"] },
    ],
  },
  {
    title: "Detail records",
    items: [
      { to: "/documents", label: "Documents" },
      { to: "/sales", label: "Sales detail", hideFor: ["client"] },
      { to: "/depreciation", label: "Depreciation", hideFor: ["client"] },
      { to: "/books-to-tax", label: "Books → tax", hideFor: ["client"] },
      { to: "/state-split", label: "State split", hideFor: ["client"] },
      { to: "/reconciliations", label: "Reconciliations", hideFor: ["client"] },
    ],
  },
  {
    title: "Process",
    items: [
      { to: "/changes", label: "Changes & versions", hideFor: ["client"] },
      { to: "/what-ifs", label: "What-ifs", hideFor: ["client"] },
      { to: "/review", label: "Review notes & sign-offs", hideFor: ["client"] },
    ],
  },
  {
    title: "People & filing",
    items: [
      { to: "/client-portal", label: "Client portal" },
      { to: "/filing", label: "Filing lifecycle" },
      { to: "/carryforward", label: "Carryforward / 2026" },
    ],
  },
  {
    title: "Firm",
    items: [
      { to: "/firm-admin", label: "Firm admin", hideFor: ["client", "preparer", "preparer_no_clearance", "reviewer", "quality_reviewer"] },
    ],
  },
];
