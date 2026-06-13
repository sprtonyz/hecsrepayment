import { companyNameForSymbol } from "@/lib/news/relevance";

export type CompanyReviewProfile = {
  symbol: string;
  companyName: string;
  sector: string;
  thesisDrivers: string[];
  keyRisks: string[];
  materialityKeywords: string[];
};

const COMPANY_PROFILE_REGISTRY: Record<string, Omit<CompanyReviewProfile, "symbol">> = {
  AAPL: {
    companyName: "Apple",
    sector: "Consumer hardware, software, and services",
    thesisDrivers: [
      "Device demand and replacement cycles",
      "Services mix and recurring revenue durability",
      "Platform economics and ecosystem lock-in",
      "AI feature adoption and product differentiation",
      "Capital returns and gross-margin durability",
    ],
    keyRisks: [
      "App store and platform regulation",
      "China demand, competition, and supply-chain exposure",
      "Product-cycle slippage or weak upgrade demand",
      "Margin pressure from mix, FX, or component costs",
    ],
    materialityKeywords: [
      "iphone",
      "services",
      "app store",
      "apple intelligence",
      "siri",
      "china",
      "buyback",
      "margin",
      "ecosystem",
    ],
  },
  MSFT: {
    companyName: "Microsoft",
    sector: "Enterprise software, cloud, and AI platforms",
    thesisDrivers: [
      "Azure and cloud growth",
      "Enterprise software retention",
      "AI monetization and product bundling",
      "Operating-margin resilience",
      "Capital allocation and free-cash-flow growth",
    ],
    keyRisks: [
      "Cloud competition and pricing pressure",
      "AI capex intensity",
      "Enterprise spending slowdowns",
      "Regulatory scrutiny across software and cloud",
    ],
    materialityKeywords: ["azure", "cloud", "copilot", "office", "enterprise", "ai", "windows"],
  },
  NVDA: {
    companyName: "Nvidia",
    sector: "Semiconductors and AI accelerators",
    thesisDrivers: [
      "Data-center demand",
      "AI accelerator adoption",
      "Pricing power and product cadence",
      "Supply availability",
      "Software ecosystem lock-in",
    ],
    keyRisks: [
      "Export controls",
      "Customer concentration and capex pauses",
      "Competitive pressure",
      "Inventory or supply-chain swings",
    ],
    materialityKeywords: ["data center", "gpu", "ai chips", "accelerator", "export controls", "cuda"],
  },
  AMZN: {
    companyName: "Amazon",
    sector: "E-commerce, cloud, and digital advertising",
    thesisDrivers: [
      "AWS growth and enterprise demand",
      "Retail margin expansion",
      "Advertising revenue growth",
      "Logistics efficiency",
      "Capex discipline and operating leverage",
    ],
    keyRisks: [
      "Cloud competition",
      "Consumer demand slowdown",
      "Regulatory scrutiny",
      "Margin pressure from fulfillment or pricing",
    ],
    materialityKeywords: ["aws", "advertising", "logistics", "e-commerce", "prime", "cloud"],
  },
  GOOGL: {
    companyName: "Alphabet",
    sector: "Search, advertising, cloud, and AI platforms",
    thesisDrivers: [
      "Search monetization",
      "YouTube advertising",
      "Cloud growth",
      "AI product adoption",
      "Operating-margin durability",
    ],
    keyRisks: [
      "Search disruption",
      "AI competition",
      "Antitrust and regulatory pressure",
      "Ad-spending cyclicality",
    ],
    materialityKeywords: ["search", "youtube", "cloud", "gemini", "ads", "ai", "antitrust"],
  },
  META: {
    companyName: "Meta",
    sector: "Digital advertising and social platforms",
    thesisDrivers: [
      "Advertising demand and targeting efficiency",
      "Reels and engagement growth",
      "AI-driven ad performance",
      "Reality Labs optionality",
      "Operating leverage",
    ],
    keyRisks: [
      "Ad-market cyclicality",
      "Regulatory scrutiny",
      "Competition for attention",
      "Execution risk in AI and new platforms",
    ],
    materialityKeywords: ["ads", "reels", "instagram", "facebook", "ai", "reality labs", "threads"],
  },
  TSLA: {
    companyName: "Tesla",
    sector: "Electric vehicles, energy, and autonomy",
    thesisDrivers: [
      "Vehicle demand and mix",
      "Pricing power or margin recovery",
      "Energy storage growth",
      "Autonomy and software optionality",
      "Manufacturing efficiency",
    ],
    keyRisks: [
      "Demand volatility",
      "Price competition",
      "Execution risk on new products",
      "Regulatory or autonomy setbacks",
    ],
    materialityKeywords: ["ev", "energy storage", "autonomy", "fsd", "pricing", "margin", "deliveries"],
  },
  SPACEX: {
    companyName: "SpaceX",
    sector: "Space launch, satellites, and aerospace infrastructure",
    thesisDrivers: [
      "Launch cadence and mission backlog",
      "Starlink subscriber growth and network quality",
      "Cost efficiency and reusability",
      "Government and commercial contract wins",
      "Launch and satellite execution reliability",
    ],
    keyRisks: [
      "Launch failures or reliability setbacks",
      "Regulatory and licensing constraints",
      "Capital intensity and funding needs",
      "Competitive pressure in launch or connectivity",
    ],
    materialityKeywords: [
      "starlink",
      "falcon",
      "starship",
      "launch",
      "satellite",
      "mission",
      "orbit",
      "payload",
    ],
  },
};

export function getCompanyReviewProfile(symbol: string): CompanyReviewProfile {
  const normalizedSymbol = symbol.toUpperCase();
  const profile = COMPANY_PROFILE_REGISTRY[normalizedSymbol];
  if (profile) {
    return {
      symbol: normalizedSymbol,
      ...profile,
    };
  }

  const companyName = companyNameForSymbol(normalizedSymbol);
  return {
    symbol: normalizedSymbol,
    companyName,
    sector: "General large-cap public company",
    thesisDrivers: [
      "Revenue growth",
      "Margin durability",
      "Competitive position",
      "Capital allocation",
      "Regulatory and legal risk",
    ],
    keyRisks: [
      "Use direct article evidence before assigning materiality",
      "Treat repeated commentary and price action as low signal unless it changes the thesis",
    ],
    materialityKeywords: [],
  };
}
