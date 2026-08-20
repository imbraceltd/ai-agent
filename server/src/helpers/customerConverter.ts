// ---------- Types ----------
type Segment = "retail" | "corp";

export interface CustomerProfilePayload {
  segment: Segment;
  customer_id: string;
  profile: {
    aum_hkd: number;
    aum_tier?: string | null;
    years_of_relationship: number;
    branch_code?: string | null;
    assignment?: {
      i_i_sales_masked?: string | null;
      trader_masked?: string | null;
      to_masked?: string | null;
    };
  };
  org?: {
    company_owner_flag?: boolean | null;
    num_related_company?: number | null;
    household_aum_hkd?: number | null;
    line_of_business?: string | null;
    business_category?: string | null;
    business_type?: string | null;
    entity_type?: string | null;
    incorporation_place?: string | null;
    incorporation_date?: string | null; // ISO-8601: YYYY-MM-DD
    number_of_employees?: number | null;
    is_sme?: boolean | null;
    sales_turnover?: number | null;
    liability_group_id?: string | null;
  };
  balances: {
    deposits: {
      hkd_casa: number;
      mcy_casa_hkd_equiv: number;
      hkd_fd: number;
      mcy_fd_hkd_equiv: number;
    };
    investment_hkd: number;
    loans: {
      total_loan: number;
      secured_loan?: number | null;
      unsecured_loan?: number | null;
    };
    overdraft?: {
      secured?: { liability: number | null; limit: number | null };
      unsecured?: { liability: number | null; limit: number | null };
    };
    card: { liability: number; limit: number };
  };
  consents_and_channel?: {
    deposit_consent?: boolean | null;
    smart_banking?: boolean | null;
    broker_account?: boolean | null;
  };
  suitability: {
    rpq_risk_level: string;
    rpq_effective_date: string;
    rpq_expiry_date: string;
    is_rpq_valid: boolean;
    professional_investor?: {
      is_pi: boolean | null;
      effective_date: string | null;
      expiry_date: string | null;
    };
    spi?: {
      is_spi: boolean | null;
      effective_date: string | null;
      expiry_date: string | null;
    };
    derivative_knowledge?: boolean | null;
    vulnerable_customer?: boolean | null;
  };
  derived: {
    casa_total: number;
    fd_total: number;
    deposit_total: number;
    liability_total: number;
    net_position_proxy: number;
    deposit_share_in_aum: number;
    investment_share_in_aum: number;
    mcy_share_in_deposits: number;
    leverage_ratio: number;
    od_util_secured?: number | null;
    od_util_unsecured?: number | null;
    od_util_max: number;
    card_utilization: number;
    tenure_bucket: "0-1y" | "1-3y" | "3-5y" | "5y+";
  };
  signals: {
    gate_rpq_block: boolean;
    gate_vulnerable_low_complex_only: boolean;
    pi_active: boolean;
    spi_active: boolean;
    derivatives_allowed: boolean;
    broker_available: boolean;
    excess_casa_cash: boolean;
    mcy_concentration_high: boolean;
    high_od_utilization: boolean;
    high_card_utilization: boolean;
    high_leverage: boolean;
    rpq_expiring_soon: boolean;
  };
}

// ---------- Utils ----------
const toBool = (v: unknown): boolean | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(s)) return true;
  if (["n", "no", "false", "0"].includes(s)) return false;
  return null;
};

// Parse number robust: "12,345.67" / "12.345,67" / "12345.67" / "12345"
const toNum = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const s = String(v).trim();
  if (!s) return fallback;

  // Try US style first: remove thousands commas
  const us = Number(s.replace(/,/g, ""));
  if (!Number.isNaN(us)) return us;

  // Try EU style: dots as thousand, comma as decimal
  const eu = Number(s.replace(/\./g, "").replace(",", "."));
  if (!Number.isNaN(eu)) return eu;

  return fallback;
};

// Normalize many date formats to ISO (YYYY-MM-DD). Returns "" if invalid/null.
const toISO = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  let s = String(v).trim();
  if (!s) return "";

  // If already ISO or ISO datetime, standardize to date part
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // yyyyMMdd
  const ymd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  // dd.MM.yyyy or dd/MM/yyyy
  const dmyDot = s.match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  if (dmyDot) {
    const [_, dd, mm, yyyy] = dmyDot;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Try Date parser as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
};

const daysUntil = (isoDate: string, todayISO: string): number => {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const t = new Date(todayISO + "T00:00:00Z").getTime();
  const d = new Date(isoDate + "T00:00:00Z").getTime();
  return Math.round((d - t) / (1000 * 60 * 60 * 24));
};

const bucketTenure = (years: number): CustomerProfilePayload["derived"]["tenure_bucket"] => {
  if (years < 1) return "0-1y";
  if (years < 3) return "1-3y";
  if (years < 5) return "3-5y";
  return "5y+";
};

// ---------- Converter ----------
/**
 * Convert raw CORP (or RETAIL) row to CustomerProfilePayload.
 * - Robust parsing of numbers & dates
 * - Computes all derived metrics & signals
 */
export function convertToCustomerProfilePayload(
  input: any,
  opts?: {
    schemaVersion?: string;
    segment?: Segment; // default: inferred (falls back to 'corp')
    todayISO?: string; // default: today (local) for RPQ gates
  }
): CustomerProfilePayload {
  const row = input?.data ?? input ?? {};
  const todayISO =
    opts?.todayISO ??
    new Date().toISOString().slice(0, 10); // YYYY-MM-DD local->UTC-safe enough for gating

  // Segment inference (simple heuristic)
  const inferredSegment: Segment =
    opts?.segment ??
    (row["Total AUM Primary Owner"] !== undefined || row["AUM_TIER"] !== undefined
      ? "retail"
      : "corp");

  // ---------- Profile ----------
  const aum =
    inferredSegment === "retail"
      ? toNum(row["Total AUM Primary Owner"])
      : toNum(row["AUM"]);
  const aumTier =
    inferredSegment === "retail" ? row["AUM_TIER"] ?? null : row["AUM Tier"] ?? null;

  const years = toNum(
    inferredSegment === "retail"
      ? row["Years of Relationship With Bank"]
      : row["Years of Relationship"]
  );

  const branchCode =
    inferredSegment === "retail" ? row["Branch Code"] ?? null : row["Assigned Branch"] ?? null;

  const assignment = {
    i_i_sales_masked: row["I&I Sales Masked"] ?? null,
    trader_masked: row["Trader Masked"] ?? null,
    to_masked: row["TO Masked"] ?? null,
  };

  // ---------- Org (mostly CORP) ----------
  const org = {
    company_owner_flag:
      toBool(row["Company Owner Flag"]), // retail only, will be null for corp
    num_related_company:
      row["No. of Related Company"] !== undefined ? toNum(row["No. of Related Company"]) : null,
    household_aum_hkd:
      row["Total AUM Primary Owner"] !== undefined ? toNum(row["Total AUM Primary Owner"]) : null,
    line_of_business: row["Line of business"] ?? null,
    business_category: row["Business Category"] ?? null,
    business_type: row["Business Type"] ?? null,
    entity_type: row["Entity type"] ?? null,
    incorporation_place: row["Incorporation place"] ?? null,
    incorporation_date: toISO(row["Incorporation date"]) || null,
    number_of_employees:
      row["Number of employees"] !== undefined ? toNum(row["Number of employees"]) : null,
    is_sme: toBool(row["SME"]),
    sales_turnover: row["Sales Turnover"] !== undefined ? toNum(row["Sales Turnover"]) : null,
    liability_group_id: row["Liability Group ID"] ?? null,
  };

  // ---------- Balances ----------
  const hkdCasa = toNum(row["HKD CASA"]);
  const mcyCasa = toNum(row["MCY CASA (HKD Equivalent)"]);
  const hkdFd = toNum(row["HKD FD"]);
  const mcyFd = toNum(row["MCY FD (HKD Equivalent)"]);

  const investmentHKD =
    inferredSegment === "retail" ? toNum(row["Investment Account Balance"]) : toNum(row["Investment"]);

  const loanTotal =
    inferredSegment === "retail" ? toNum(row["Loan Account Balance"]) : toNum(row["Loan"]);

  const securedLoan = toNum(row["Secured Loan Liability"], 0);
  const unsecuredLoan = toNum(row["Unsecured Loan Liability"], 0);

  const odSecLiab = toNum(row["Secured Overdraft Liability"], 0);
  const odSecLimit = toNum(row["Secured Overdraft Limit"], 0);
  const odUnsecLiab = toNum(row["Unsecured Overdraft Liability"], 0);
  const odUnsecLimit = toNum(row["Unsecured Overdraft Limit"], 0);

  // Prefer explicit "Card Liability" if present; fallback to "Credit Card"
  const cardLiability = toNum(row["Card Liability"] ?? row["Credit Card"], 0);
  const cardLimit = toNum(row["Card Limit"], 0);

  // ---------- Suitability ----------
  const rpqEff =
    toISO(row["RPQ Effective Date"]) ||
    toISO(row["RPQ Effective Date 1"]) || // fallback field in your data
    ""; // required by interface → keep "" if unknown

  const rpqExp = toISO(row["RPQ Expiry Date"]) || "";

  const riskLevel: string = row["Risk Level"] ?? row["RPQ Risk Level"] ?? "UNKNOWN";

  // Valid if we have expiry and today <= expiry (optionally you can also check eff<=today)
  const isRpqValid = !!rpqExp && daysUntil(rpqExp, todayISO) >= 0;

  // ---------- Derived ----------
  const casaTotal = hkdCasa + mcyCasa;
  const fdTotal = hkdFd + mcyFd;
  const depositTotal = casaTotal + fdTotal;

  const odUtilSec =
    odSecLimit > 0 ? Math.min(odSecLiab / odSecLimit, 10) : (odSecLiab > 0 ? 1 : 0);
  const odUtilUnsec =
    odUnsecLimit > 0 ? Math.min(odUnsecLiab / odUnsecLimit, 10) : (odUnsecLiab > 0 ? 1 : 0);
  const odUtilMax = Math.max(odUtilSec, odUtilUnsec);

  const cardUtil =
    cardLimit > 0 ? Math.min(cardLiability / cardLimit, 10) : (cardLiability > 0 ? 1 : 0);

  const liabilityTotal =
    loanTotal + odSecLiab + odUnsecLiab + cardLiability;

  const netPosition = aum - liabilityTotal;
  const depShare = depositTotal / Math.max(aum, 1);
  const invShare = investmentHKD / Math.max(aum, 1);
  const mcyShare = depositTotal > 0 ? (mcyCasa + mcyFd) / depositTotal : 0;
  const leverage = liabilityTotal / Math.max(aum, 1);

  const tenure = bucketTenure(years);

  // ---------- Signals ----------
  const signals = {
    gate_rpq_block: !isRpqValid,
    gate_vulnerable_low_complex_only: false, // no raw flag in CORP sample
    pi_active: false,
    spi_active: false,
    derivatives_allowed: isRpqValid && false, // no derivative_knowledge flag in CORP sample
    broker_available: false, // no broker flag in CORP sample
    excess_casa_cash: casaTotal >= 0.2 * aum,
    mcy_concentration_high: mcyShare >= 0.6,
    high_od_utilization: odUtilMax >= 0.7,
    high_card_utilization: cardUtil >= 0.7,
    high_leverage: leverage >= 0.8,
    rpq_expiring_soon: isRpqValid && daysUntil(rpqExp, todayISO) <= 30,
  };

  // ---------- Build payload ----------
  const payload: CustomerProfilePayload = {
    segment: inferredSegment,
    customer_id: String(row["Customer ID"] ?? row["Name"] ?? ""),
    profile: {
      aum_hkd: aum,
      aum_tier: aumTier ?? null,
      years_of_relationship: years,
      branch_code: branchCode ?? null,
      assignment,
    },
    org,
    balances: {
      deposits: {
        hkd_casa: hkdCasa,
        mcy_casa_hkd_equiv: mcyCasa,
        hkd_fd: hkdFd,
        mcy_fd_hkd_equiv: mcyFd,
      },
      investment_hkd: investmentHKD,
      loans: {
        total_loan: loanTotal,
        secured_loan: securedLoan,
        unsecured_loan: unsecuredLoan,
      },
      overdraft: {
        secured: { liability: odSecLiab, limit: odSecLimit },
        unsecured: { liability: odUnsecLiab, limit: odUnsecLimit },
      },
      card: { liability: cardLiability, limit: cardLimit },
    },
    consents_and_channel: {
      deposit_consent: null,
      smart_banking: null,
      broker_account: null,
    },
    suitability: {
      rpq_risk_level: riskLevel,
      rpq_effective_date: rpqEff,
      rpq_expiry_date: rpqExp,
      is_rpq_valid: isRpqValid,
      professional_investor: {
        is_pi: null,
        effective_date: null,
        expiry_date: null,
      },
      spi: {
        is_spi: null,
        effective_date: null,
        expiry_date: null,
      },
      derivative_knowledge: null,
      vulnerable_customer: null,
    },
    derived: {
      casa_total: casaTotal,
      fd_total: fdTotal,
      deposit_total: depositTotal,
      liability_total: liabilityTotal,
      net_position_proxy: netPosition,
      deposit_share_in_aum: depShare,
      investment_share_in_aum: invShare,
      mcy_share_in_deposits: mcyShare,
      leverage_ratio: leverage,
      od_util_secured: odUtilSec,
      od_util_unsecured: odUtilUnsec,
      od_util_max: odUtilMax,
      card_utilization: cardUtil,
      tenure_bucket: tenure,
    },
    signals,
  };

  return payload;
}

/*
const raw = {
  data: {
    Name: "88210000001",
    "RPQ Effective Date 1": "25.07.2012",
    "RPQ Expiry Date": "25.07.2013",
    "RPQ Effective Date": null,
    "Risk Level": "AGGRESSIVE GROWTH",
    "Liability Group ID": null,
    "Sales Turnover": "0",
    SME: null,
    "Business Type": "PRIVATE LIMITED",
    "Number of employees": "0",
    "Entity type": "08 - Passive NFE - (2) Others not an Active NFE",
    "Incorporation date": "19911018",
    "Incorporation place": "HK",
    "Business Category": "SECURITIES AND INVESTMENT SERVICES",
    "Line of business": "FINANCIAL & INSURANCE",
    "Card Limit": "26586.52",
    "Card Liability": "9032.14",
    "Unsecured Overdraft Limit": "0",
    "Unsecured Overdraft Liability": "0",
    "Secured Overdraft Liability": "0",
    "Secured Overdraft Limit": "0",
    "Unsecured Loan Liability": "0",
    "Secured Loan Liability": "0",
    "Loan Relationship Indicator": "N",
    "TO Masked": null,
    "Trader Masked": "S3001",
    "I&I Sales Masked": null,
    "Assigned Branch": "328",
    "Credit Card": "9032.14",
    Loan: "0",
    Investment: "2188440",
    "MCY FD (HKD Equivalent)": null,
    "HKD FD": "0",
    "MCY CASA (HKD Equivalent)": null,
    "HKD CASA": "644347.35",
    AUM: "13739727.35",
    "AUM Tier": "08. HK$8M/+",
    "Years of Relationship": "32",
    "Joined Since": "2025-08-15T02:59:01.215Z"
  }
};

const out = convertToCustomerProfilePayload(raw, {
  segment: "corp", // force CORP
  todayISO: "2025-08-19"
});
console.log(out);
*/
