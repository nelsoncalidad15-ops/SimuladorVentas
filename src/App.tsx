/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Calculator, 
  Car, 
  Truck,
  ChevronRight, 
  Info, 
  Share2, 
  CreditCard, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  HelpCircle,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import appConfig from "./data/config.json";
import { calculateFromBruto, calculateFromNeto, formatCurrency, FinanceResult } from "./logic/financeLogic";

// --- Types ---
type Category = "autos" | "amarok" | "usados";
type Line = "tasafija" | "uva" | "prendu" | "leasing";
type SimulationMode = "financiar" | "entregar";
type ViewMode = "asesor" | "cliente";

interface Plan {
  months: number;
  campaign: string;
  tna: number;
  cuotaIni: number;
  cuotaProm: number;
  qF: number;
  max?: number;
  isUva?: boolean;
  isSinQ?: boolean;
  onlyEligible?: boolean;
  ltv?: number;
  vrMax?: number;
}

// --- Components ---

const CurrencyInput = ({ label, value, onChange, prefix = "$", placeholder = "0" }: any) => {
  const [localValue, setLocalValue] = useState("");

  // Sync with prop only if it's not what we already have (avoiding loops/jumps)
  useEffect(() => {
    const formatted = value > 0 ? value.toLocaleString("es-AR") : "";
    if (formatted !== localValue && value !== (parseInt(localValue.replace(/\D/g, "")) || 0)) {
      setLocalValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = parseInt(raw) || 0;
    
    // Update local state immediately for visual responsiveness
    const newFormatted = num > 0 ? num.toLocaleString("es-AR") : "";
    setLocalValue(newFormatted);
    
    // Notify parent
    onChange(num);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative group">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold group-focus-within:text-vw-blue transition-colors pointer-events-none">{prefix}</span>
        <input
          type="text"
          inputMode="numeric"
          className="w-full h-14 pl-8 pr-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-vw-blue outline-none transition-all font-bold text-slate-700 text-xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] hover:border-slate-200"
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default function App() {
  // --- States ---
  const [category, setCategory] = useState<Category>("autos");
  const [line, setLine] = useState<Line>("tasafija");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [simulationMode, setSimulationMode] = useState<SimulationMode>("financiar");
  const [viewMode, setViewMode] = useState<ViewMode>("asesor");
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  
  // Dynamic Data States
  const [sheetModels, setSheetModels] = useState<any[]>([]);
  const [configParams, setConfigParams] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState(() => 
    localStorage.getItem("vw_sheet_url") || "https://docs.google.com/spreadsheets/d/e/2PACX-1vTsc2pn7ht6EpWTOiAnpFMQQkoDDqzYk8cOq5KJ3R6GyZGrEqyO1INiLeMcarpveDxrPhkziWByYuWU/pub?gid=0&single=true&output=csv"
  );
  const [configSheetUrl, setConfigSheetUrl] = useState(() => 
    localStorage.getItem("vw_config_url") || "https://docs.google.com/spreadsheets/d/e/2PACX-1vTsc2pn7ht6EpWTOiAnpFMQQkoDDqzYk8cOq5KJ3R6GyZGrEqyO1INiLeMcarpveDxrPhkziWByYuWU/pub?gid=378728600&single=true&output=csv"
  );

  // Combine local and sheet config
  const activeConfig = useMemo(() => {
    if (!configParams) return appConfig;
    
    // Deep clone appConfig to avoid mutations
    const newConfig = JSON.parse(JSON.stringify(appConfig));

    const getTextParam = (key: string) => {
      const value = configParams[key];
      if (value === undefined || value === null) return null;
      const text = String(value).trim();
      return text.length > 0 ? text : null;
    };

    const getNumberParam = (key: string) => {
      const value = configParams[key];
      if (value === undefined || value === null || value === "") return null;

      let normalized = String(value).trim();
      if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const applyNumberOverride = (target: any, prop: string, keys: string[]) => {
      for (const key of keys) {
        const value = getNumberParam(key);
        if (value !== null) {
          target[prop] = value;
          return;
        }
      }
    };

    const buildPlanBaseKey = (...parts: Array<string | number | undefined>) =>
      parts
        .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
        .map((part) => String(part).trim().toLowerCase())
        .join("_");

    newConfig.currentMonth = getTextParam("current_month") || newConfig.currentMonth;
    newConfig.circularNumber = getTextParam("circular_nro") || newConfig.circularNumber;
    newConfig.uvaReference = getNumberParam("uva_referencia") ?? newConfig.uvaReference;
    newConfig.sellPercent = getNumberParam("comision_vendedor") ?? newConfig.sellPercent;
    newConfig.defaultGastosAdmin = getNumberParam("gastos_admin") ?? newConfig.defaultGastosAdmin;
    newConfig.defaultPrenda = getNumberParam("prenda") ?? newConfig.defaultPrenda;
    newConfig.ivaQuebranto = getNumberParam("iva_quebranto") ?? newConfig.ivaQuebranto ?? 21;
    
    if (configParams.modelos_elegibles) {
      newConfig.eligibleModels = configParams.modelos_elegibles.split(",").map((s: string) => s.trim());
    }
    
    const updatePlanList = (planList: any[], sectionPrefix: string[]) => {
      planList.forEach(p => {
        const baseKey = buildPlanBaseKey(...sectionPrefix, p.months, p.campaign);
        const months = p.months;

        applyNumberOverride(p, "tna", [`${baseKey}_tna`, `tna_${months}`]);
        applyNumberOverride(p, "qF", [`${baseKey}_qf`, `qf_${months}`]);
        applyNumberOverride(p, "max", [`${baseKey}_max`, `${baseKey}_monto_max`, `monto_max_${months}`]);
        applyNumberOverride(p, "cuotaIni", [`${baseKey}_cuota_ini`, `${baseKey}_cuotaini`, `cuota_ini_${months}`]);
        applyNumberOverride(p, "cuotaProm", [`${baseKey}_cuota_prom`, `${baseKey}_cuotaprom`, `cuota_prom_${months}`]);
        applyNumberOverride(p, "ltv", [`${baseKey}_ltv`, `ltv_${months}`]);
        applyNumberOverride(p, "vrMax", [`${baseKey}_vr_max`, `${baseKey}_vrmax`, `vrmax_${months}`]);
      });
    };

    Object.keys(newConfig.plans).forEach(catKey => {
      Object.keys(newConfig.plans[catKey]).forEach(lineKey => {
        updatePlanList(newConfig.plans[catKey][lineKey], ["plan", catKey, lineKey]);
      });
    });

    if (newConfig.prendarioUnico) updatePlanList(newConfig.prendarioUnico, ["prendario"]);
    if (newConfig.leasing) updatePlanList(newConfig.leasing, ["leasing"]);

    return newConfig;
  }, [configParams]);

  // Combine local and sheet models
  const allModels = useMemo(() => {
    // If the sheet is empty, use the built-in models
    if (sheetModels.length === 0) return activeConfig.models;
    
    // If the sheet has data, it is the absolute source of truth for the price list
    // This allows users to add, update, or COMPLETELY REMOVE models from the list
    return sheetModels;
  }, [sheetModels, activeConfig]);

  // Sync Global Parameters
  const fetchConfigData = async (url: string) => {
    if (!url) return;
    try {
      const csvUrl = url.includes("pub?output=csv") ? url : url.replace(/\/edit.*$/, "/export?format=csv");
      Papa.parse(csvUrl, {
        download: true,
        header: true,
        complete: (results) => {
          const params: any = {};
          const normalizeCell = (value: any) => (value ?? "").toString().trim();
          const normalizeKey = (value: any) =>
            normalizeCell(value)
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "");

          results.data.forEach((row: any) => {
            const normalizedRow: any = {};
            Object.keys(row || {}).forEach((rawKey) => {
              normalizedRow[normalizeKey(rawKey)] = row[rawKey];
            });

            const explicitKey = normalizeCell(normalizedRow.clave || normalizedRow.key || normalizedRow.parametro);
            const group = normalizeKey(normalizedRow.grupo || normalizedRow.group || normalizedRow.bloque);
            const category = normalizeKey(normalizedRow.categoria || normalizedRow.category);
            const line = normalizeKey(normalizedRow.linea || normalizedRow.line || normalizedRow.producto);
            const months = normalizeKey(normalizedRow.plazo || normalizedRow.meses || normalizedRow.months);
            const campaign = normalizeKey(normalizedRow.campana || normalizedRow.campaign);
            const variable = normalizeKey(normalizedRow.variable || normalizedRow.campo || normalizedRow.parametro);

            const compositeKey = [group, category, line, months, campaign, variable]
              .filter(Boolean)
              .join("_");

            const key = normalizeKey(explicitKey || compositeKey);
            let value = row.Valor || row.valor;

            if (value === undefined) {
              value = normalizedRow.valor ?? normalizedRow.value;
            }

            // Normalize numbers (handling potential 1.234,56 or 1,234.56 formats)
            if (value && typeof value === 'string') {
              if (value.includes(",") && value.includes(".")) {
                 value = value.replace(/\./g, "").replace(",", ".");
              } else if (value.includes(",")) {
                 value = value.replace(",", ".");
              }
            }
            if (key) params[key] = value;
          });
          if (Object.keys(params).length > 0) {
            setConfigParams(params);
            localStorage.setItem("vw_config_url", url);
          }
        }
      });
    } catch (e) { console.error(e); }
  };

  // Sync with Google Sheets
  const fetchSheetData = async (url: string) => {
    if (!url) return;
    setIsSyncing(true);
    try {
      // Logic for converting a regular Google Sheets URL to a CSV export URL
      // If it's already a pub?output=csv, we use it directly
      const csvUrl = url.includes("pub?output=csv") 
        ? url 
        : url.includes("/export") 
          ? url 
          : url.replace(/\/edit.*$/, "/export?format=csv");

      Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const normalizeHeader = (value: string) =>
            value
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "");

          const getField = (row: any, aliases: string[]) => {
            for (const alias of aliases) {
              const value = row[alias];
              if (value !== undefined && value !== null && String(value).trim() !== "") {
                return value;
              }
            }
            return "";
          };

          const parseBoolean = (value: any) => {
            const text = String(value ?? "").trim().toLowerCase();
            return ["si", "sí", "yes", "true", "1", "x"].includes(text);
          };

          const validModels = results.data
            .map((row: any) => {
              const normalizedRow: any = {};
              Object.keys(row).forEach(key => {
                normalizedRow[normalizeHeader(key)] = row[key];
              });
              return normalizedRow;
            })
            .filter((row: any) => getField(row, ["id", "codigo", "cod_modelo"]) && getField(row, ["precio", "precio_lista", "precio_final"]))
            .map((row: any) => ({
              id: getField(row, ["id", "codigo", "cod_modelo"]).toString().trim(),
              brand: getField(row, ["marca", "brand"]) || "VW",
              name: getField(row, ["modelo", "nombre_modelo", "version"]) || "Sin Nombre",
              price: parseInt(getField(row, ["precio", "precio_lista", "precio_final"]).toString().replace(/\D/g, "")) || 0,
              category: getField(row, ["categoria", "tipo", "segmento"]).toString().toLowerCase().trim() || "autos",
              eligible: parseBoolean(getField(row, ["elegible", "eligible", "elegible_uva", "uva"]))
            }));

          const eligibleIds = validModels.filter((row: any) => row.eligible).map((row: any) => row.id);
          const modelsForState = validModels.map(({ eligible, ...rest }: any) => rest);
          
          if (modelsForState.length > 0) {
            setSheetModels(modelsForState);
            if (eligibleIds.length > 0) {
              setConfigParams((prev: any) => ({
                ...(prev || {}),
                modelos_elegibles: eligibleIds.join(","),
              }));
            }
            localStorage.setItem("vw_sheet_url", url);
          } else if (results.data.length > 0) {
             console.warn("Se leyeron filas pero no coincidieron con el formato esperado. Verifica columnas como ID/Codigo y Precio.");
          }
          setIsSyncing(false);
        },
        error: (err) => {
          console.error("Error fetching sheet:", err);
          setIsSyncing(false);
        }
      });
    } catch (e) {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (sheetUrl) fetchSheetData(sheetUrl);
    if (configSheetUrl) fetchConfigData(configSheetUrl);
  }, []);

  // Input states
  const [priceVenta, setPriceVenta] = useState<number>(0);
  const [valUsado, setValUsado] = useState<number>(0);
  const [amountFinancing, setAmountFinancing] = useState<number>(0);
  const [amountAnticipo, setAmountAnticipo] = useState<number>(0);
  
  // Advanced config
  const [gastosAdmin, setGastosAdmin] = useState<number>(activeConfig.defaultGastosAdmin);
  const [prendaPct, setPrendaPct] = useState<number>(activeConfig.defaultPrenda);
  
  // Selected Plan
  const [selectedPlanIdx, setSelectedPlanIdx] = useState<number>(0);
  const [showComparator, setShowComparator] = useState(false);

  // Leasing states
  const [leasPrice, setLeasPrice] = useState<number>(0);
  const [leasAntPct, setLeasAntPct] = useState<number>(0);
  const [leasVrPct, setLeasVrPct] = useState<number>(30);

  // --- Derived Data ---
  const filteredModels = useMemo(() => {
    return allModels.filter(m => (category === "amarok" ? m.brand === "Amarok" : m.brand !== "Amarok"));
  }, [category, allModels]);

  const selectedModel = useMemo(() => {
    return allModels.find(m => m.id === selectedModelId);
  }, [selectedModelId, allModels]);

  const isEligible = useMemo(() => {
    return selectedModelId && activeConfig.eligibleModels.includes(selectedModelId);
  }, [selectedModelId, activeConfig]);

  const availablePlans = useMemo(() => {
    if (line === "prendu") return activeConfig.prendarioUnico;
    if (line === "leasing") return activeConfig.leasing;
    // @ts-ignore
    const allPlans: Plan[] = activeConfig.plans[category]?.[line] || [];
    return allPlans.filter(p => !p.onlyEligible || isEligible);
  }, [category, line, isEligible, activeConfig]);

  const activePlan = availablePlans[selectedPlanIdx] || availablePlans[0];

  // --- Effects ---
  useEffect(() => {
    setSelectedPlanIdx(0);
  }, [category, line, isEligible]);

  useEffect(() => {
    if (selectedModel && line === "leasing") {
      setLeasPrice(selectedModel.price);
    }
  }, [selectedModel, line]);

  // --- Finance Calculations ---
  const results = useMemo(() => {
    if (!activePlan) return null;
    
    let res: FinanceResult | null = null;
    let actualPventa = (category === "usados" ? valUsado : (selectedModel?.price || 0));
    if (priceVenta > 0) actualPventa = priceVenta;

    if (line === "leasing") {
      const anticipo = Math.round(leasPrice * leasAntPct / 100);
      const vr = Math.round(leasPrice * leasVrPct / 100);
      const capFin = leasPrice - anticipo - vr;
      return {
        isLeasing: true,
        precio: leasPrice,
        anticipo,
        vr,
        capFin,
        cuotaIni: (capFin / 1000) * activePlan.cuotaIni,
        cuotaProm: (capFin / 1000) * activePlan.cuotaProm,
        totalCanones: ((capFin / 1000) * activePlan.cuotaProm) * activePlan.months,
      };
    }

    if (simulationMode === "financiar") {
      if (amountFinancing <= 0) return null;
      res = calculateFromBruto(amountFinancing, activePlan.qF, gastosAdmin, prendaPct, activePlan.cuotaIni, activePlan.cuotaProm, activePlan.months, activeConfig.ivaQuebranto);
    } else {
      if (amountAnticipo <= 0 || actualPventa <= 0) return null;
      const targetNeto = actualPventa - amountAnticipo;
      if (targetNeto <= 0) return null;
      res = calculateFromNeto(targetNeto, activePlan.qF, gastosAdmin, prendaPct, activePlan.cuotaIni, activePlan.cuotaProm, activePlan.months, activeConfig.ivaQuebranto);
    }

    return res ? { ...res, isLeasing: false, actualPventa } : null;
  }, [category, line, activePlan, simulationMode, amountFinancing, amountAnticipo, priceVenta, valUsado, selectedModel, gastosAdmin, prendaPct, leasPrice, leasAntPct, leasVrPct]);

  const comparativeResults = useMemo(() => {
    if (availablePlans.length === 0) return [];
    
    let actualPventa = (category === "usados" ? valUsado : (selectedModel?.price || 0));
    if (priceVenta > 0) actualPventa = priceVenta;

    return availablePlans.map(p => {
      let res: any = null;
      if (line === "leasing") {
        const anticipo = Math.round(leasPrice * leasAntPct / 100);
        const vr = Math.round(leasPrice * leasVrPct / 100);
        const capFin = leasPrice - anticipo - vr;
        res = {
          isLeasing: true,
          precio: leasPrice,
          anticipo,
          vr,
          capFin,
          cuotaIni: (capFin / 1000) * p.cuotaIni,
          cuotaProm: (capFin / 1000) * p.cuotaProm,
          totalCanones: ((capFin / 1000) * p.cuotaProm) * p.months,
        };
      } else if (simulationMode === "financiar") {
        if (amountFinancing > 0) {
          res = calculateFromBruto(amountFinancing, p.qF, gastosAdmin, prendaPct, p.cuotaIni, p.cuotaProm, p.months, activeConfig.ivaQuebranto);
        }
      } else {
        if (amountAnticipo > 0 && actualPventa > 0) {
          const targetNeto = actualPventa - amountAnticipo;
          if (targetNeto > 0) {
            res = calculateFromNeto(targetNeto, p.qF, gastosAdmin, prendaPct, p.cuotaIni, p.cuotaProm, p.months, activeConfig.ivaQuebranto);
          }
        }
      }
      return { plan: p, res };
    }).filter(item => item.res !== null);
  }, [availablePlans, category, line, simulationMode, amountFinancing, amountAnticipo, priceVenta, valUsado, selectedModel, gastosAdmin, prendaPct, leasPrice, leasAntPct, leasVrPct]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-sleek-bg font-sans">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-vw-blue rounded flex items-center justify-center shadow-lg shadow-vw-blue/20">
            <svg viewBox="0 0 38 38" className="w-5 h-5 text-white"><circle cx="19" cy="19" r="17" stroke="currentColor" strokeWidth="2.5" fill="none" /><path d="M11 12l5.5 13 2.5-6 2.5 6L27 12h-3l-4 10-4-10z" fill="currentColor" /></svg>
          </div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
            VWFS Calc Pro <span className="text-gray-400 font-medium text-[10px] uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded italic">v2.1.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[10px] font-bold text-emerald-600 uppercase tracking-tight">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Sync: {activeConfig.currentMonth}
          </div>

          <button 
            onClick={() => setShowComparator(true)}
            className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-md hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm border border-slate-200"
          >
            <Calculator className="w-3.5 h-3.5" />
            Comparar Planes
          </button>

          <button 
            onClick={handlePrint}
            className="px-4 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-md hover:bg-black transition-all flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Simulación
          </button>

          <button className="px-4 py-1.5 bg-vw-blue text-white text-xs font-bold rounded-md hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm hidden sm:flex">
            <Share2 className="w-3.5 h-3.5" />
            Compartir
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-sleek-dark text-gray-400 flex flex-col shrink-0 border-r border-[#333] hidden lg:flex">
          <div className="p-5 uppercase text-[10px] font-black tracking-[0.2em] text-gray-500 border-b border-white/5">
            Configuración Base
          </div>
          
          <div className="flex flex-col p-3 gap-1">
            <div className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</div>
            {(["autos", "amarok", "usados"] as Category[]).map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setLine("tasafija"); setSelectedModelId(""); }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-xs font-black uppercase tracking-tight transition-all ${category === cat ? "bg-vw-blue text-white shadow-lg" : "hover:bg-white/5 text-gray-400"}`}
              >
                {cat === 'amarok' ? <Truck className="w-3.5 h-3.5" /> : cat === 'autos' ? <Car className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                {cat === "autos" ? "0km Autos" : cat === "amarok" ? "0km Amarok" : "Usados"}
              </button>
            ))}
          </div>

          <div className="flex flex-col p-3 gap-1 mt-2">
            <div className="px-3 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Línea de Crédito</div>
            {(["tasafija", "uva", "prendu", "leasing"] as Line[]).map(l => (
              <button
                key={l}
                disabled={category === "usados" && (l === "prendu" || l === "leasing")}
                onClick={() => setLine(l)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded text-[11px] font-black uppercase tracking-tighter transition-all disabled:opacity-20 ${line === l ? "bg-white/10 text-white border border-white/20 shadow-inner" : "hover:bg-white/5 text-gray-400"}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${line === l ? "bg-sleek-accent animate-pulse" : "bg-transparent border border-gray-600"}`}></div>
                {l === "tasafija" ? "Tasa Fija" : l === "uva" ? "UVA / Mixta" : l === "prendu" ? "Prend. Único" : "Leasing"}
              </button>
            ))}
          </div>

          <div className="mt-8 px-6 pt-2">
             <button 
               onClick={() => setShowComparator(true)}
               className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 group transition-all mb-2"
             >
               <TrendingUp className="w-3.5 h-3.5 text-gray-500 group-hover:text-amber-400 transition-colors" />
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comparativa de Planes</span>
             </button>

             <button 
               onClick={() => setShowConfigEditor(true)}
               className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 group transition-all"
             >
               <Lock className="w-3.5 h-3.5 text-gray-500 group-hover:text-vw-blue transition-colors" />
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestionar Circular</span>
             </button>
          </div>

          <div className="mt-auto p-5 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 bg-vw-blue rounded-lg flex items-center justify-center shadow-md">
                   <svg viewBox="0 0 38 38" className="w-4 h-4 text-white"><circle cx="19" cy="19" r="17" stroke="currentColor" strokeWidth="2.5" fill="none" /><path d="M11 12l5.5 13 2.5-6 2.5 6L27 12h-3l-4 10-4-10z" fill="currentColor" /></svg>
                </div>
                <div>
                   <p className="text-[10px] font-black text-white uppercase tracking-tighter">Autosol S.A.</p>
                   <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">VW Financial Services</p>
                </div>
            </div>
            <div className="text-[9px] text-gray-500 mb-2 italic font-black uppercase tracking-tighter">CIRCULAR: {activeConfig.circularNumber}</div>
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-sleek-accent w-[85%]"></div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-sleek-bg relative">
          <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
            
            {/* Header Mobile / Info */}
            <div className="lg:hidden sleek-card p-4 flex flex-col gap-4">
              <div className="flex gap-2">
                <select 
                  className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold"
                  value={category} onChange={e=>setCategory(e.target.value as Category)}
                >
                  <option value="autos">Autos 0km</option>
                  <option value="amarok">Amarok 0km</option>
                  <option value="usados">Usados</option>
                </select>
                <select 
                  className="flex-1 h-9 px-3 bg-slate-50 border border-slate-200 rounded text-xs font-bold"
                  value={line} onChange={e=>setLine(e.target.value as Line)}
                >
                  <option value="tasafija">Tasa Fija</option>
                  <option value="uva">UVA</option>
                  <option value="prendu">Prend. Único</option>
                  <option value="leasing">Leasing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Inputs */}
              <div className="md:col-span-12 lg:col-span-7 flex flex-col gap-6">
                
                {/* Data Section */}
                <div className="sleek-card animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="sleek-header flex justify-between items-center">
                    <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> Datos de la Unidad
                    </h2>
                  </div>
                  <div className="p-5 flex flex-col gap-5">
                    {category !== "usados" ? (
                      <div className="flex flex-col gap-1 w-full">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vehículo Seleccionado</label>
                        <select
                          className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-md focus:ring-1 focus:ring-sleek-accent outline-none font-semibold text-sm appearance-none"
                          value={selectedModelId}
                          onChange={(e) => setSelectedModelId(e.target.value)}
                          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundPosition: 'right 12px center', backgroundRepeat: 'no-repeat' }}
                        >
                          <option value="">— Seleccionar modelo de lista —</option>
                          {filteredModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        {selectedModel && (
                          <div className="mt-2 flex items-center justify-between px-3 py-2 bg-vw-blue rounded text-white shadow-sm">
                            <span className="text-[10px] font-bold uppercase tracking-tight opacity-70">Precio Lista</span>
                            <span className="text-base font-black font-mono">{formatCurrency(selectedModel.price)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <CurrencyInput label="Valor del Usado (SEGÚN INFOAUTOS)" value={valUsado} onChange={setValUsado} />
                    )}

                    {line !== "leasing" && (
                      <CurrencyInput label="Precio Venta Final al Cliente" value={priceVenta} onChange={setPriceVenta} />
                    )}
                  </div>
                </div>

                {/* Plan Selection Section */}
                <div className="sleek-card">
                  <div className="sleek-header">
                    <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                       <TrendingUp className="w-3.5 h-3.5" /> Selección de Plan
                    </h2>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-2">
                    {availablePlans.length > 0 ? (
                      availablePlans.map((p, idx) => (
                        <button
                          key={`${p.months}-${p.campaign}-${idx}`}
                          onClick={() => setSelectedPlanIdx(idx)}
                          className={`flex items-center justify-between px-5 py-4 rounded group transition-all border-l-4 ${selectedPlanIdx === idx ? "bg-blue-50 border-sleek-accent" : "hover:bg-slate-50 border-transparent bg-slate-50/50"}`}
                        >
                          <div className="flex flex-col items-start">
                            <span className={`text-lg font-black font-mono ${selectedPlanIdx === idx ? "text-sleek-accent" : "text-slate-700"}`}>{p.months} <span className="text-xs font-bold uppercase text-slate-400">Meses</span></span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{line === "leasing" ? `TNA 0% · VR Máx ${p.vrMax}%` : `TNA ${p.tna}% ${p.isUva ? "+ UVA" : ""}`}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight ${p.campaign === "especial" ? "bg-blue-100 text-blue-700" : p.campaign === "fin" ? "bg-emerald-100 text-emerald-700" : "bg-white border border-slate-200 text-slate-500"}`}>
                              {p.campaign === "especial" ? "ESP" : p.campaign === "fin" ? "FMAS" : p.campaign}
                            </span>
                            {selectedPlanIdx === idx && (
                              <div className="w-4 h-4 bg-sleek-accent rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-400 font-medium text-xs italic">No hay planes vigentes para esta selección.</div>
                    )}
                  </div>
                </div>

                {/* Simulation Inputs */}
                {line !== "leasing" ? (
                   <div className="sleek-card">
                      <div className="sleek-header flex justify-between items-center">
                        <div className="flex gap-4">
                           {(["financiar", "entregar"] as SimulationMode[]).map(m => (
                             <button
                               key={m}
                               onClick={() => setSimulationMode(m)}
                               className={`text-[11px] font-bold transition-all uppercase tracking-widest py-1 border-b-2 ${simulationMode === m ? "border-sleek-accent text-sleek-accent" : "border-transparent text-slate-400"}`}
                             >
                               {m === "financiar" ? "Por Capital" : "Por Entrega"}
                             </button>
                           ))}
                        </div>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {simulationMode === "financiar" ? (
                            <>
                              <CurrencyInput label="Capital a Financiar" value={amountFinancing} onChange={setAmountFinancing} />
                              <div className="flex flex-col gap-1 w-full">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">% del Valor</label>
                                <div className="h-11 px-4 bg-slate-50 border border-gray-200 rounded-md flex items-center font-bold text-gray-400 font-mono text-sm uppercase">
                                  {selectedModel && amountFinancing > 0 ? (amountFinancing / selectedModel.price * 100).toFixed(1) : "0.0"} %
                                </div>
                              </div>
                            </>
                         ) : (
                            <>
                               <CurrencyInput label="Anticipo del Cliente" value={amountAnticipo} onChange={setAmountAnticipo} />
                               <div className="flex flex-col gap-1 w-full">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Pedir al Banco</label>
                                  <div className="h-11 px-4 bg-blue-50/50 border border-blue-100 rounded-md flex items-center font-bold text-sleek-accent font-mono text-sm">
                                     {results ? formatCurrency(results.bruto) : "-"}
                                  </div>
                               </div>
                            </>
                         )}
                      </div>
                   </div>
                ) : (
                  <div className="sleek-card">
                    <div className="sleek-header"><h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ajuste Leasing</h2></div>
                    <div className="p-5 flex flex-col gap-6">
                       <CurrencyInput label="Precio del 0km" value={leasPrice} onChange={setLeasPrice} />
                       <div className="space-y-6">
                          <div className="space-y-3">
                             <div className="flex justify-between text-[11px] font-bold uppercase text-slate-500">
                                <span>Anticipo: <span className="text-sleek-accent font-mono">{leasAntPct}%</span></span>
                                <span className="font-mono">{formatCurrency(leasPrice * leasAntPct / 100)}</span>
                             </div>
                             <input type="range" min="0" max="50" step="1" value={leasAntPct} onChange={(e) => setLeasAntPct(parseInt(e.target.value))} className="w-full accent-sleek-accent h-1" />
                          </div>
                          <div className="space-y-3">
                             <div className="flex justify-between text-[11px] font-bold uppercase text-slate-500">
                                <span>Opción de Compra (VR): <span className="text-sleek-accent font-mono">{leasVrPct}%</span></span>
                                <span className="font-mono">{formatCurrency(leasPrice * leasVrPct / 100)}</span>
                             </div>
                             <input type="range" min="5" max={activePlan?.vrMax || 30} step="1" value={leasVrPct} onChange={(e) => setLeasVrPct(parseInt(e.target.value))} className="w-full accent-sleek-accent h-1" />
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Visualization / Results */}
              <div className="md:col-span-12 lg:col-span-5 flex flex-col gap-6 sticky top-0">
                <AnimatePresence mode="wait">
                  {results ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    >
                      {viewMode === "asesor" ? (
                        <div className="sleek-card !border-slate-800 !bg-slate-900 shadow-2xl">
                          <div className="p-6 bg-sleek-dark text-white border-b border-white/5">
                            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-1">Cálculo de Cuota</div>
                            <div className="flex items-baseline gap-2">
                               <span className="text-4xl font-black font-mono tracking-tighter">{formatCurrency(results.cuotaIni)}</span>
                               <span className="text-sm font-bold text-white/30 uppercase"> / Mes</span>
                            </div>
                          </div>
                          <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-white/5 p-4 rounded-md border border-white/5">
                                  <div className="text-[9px] font-bold text-white/40 uppercase mb-1">C. Promedio</div>
                                  <div className="text-lg font-bold font-mono">{formatCurrency(results.cuotaProm)}</div>
                               </div>
                               <div className="bg-white/5 p-4 rounded-md border border-white/5">
                                  <div className="text-[9px] font-bold text-white/40 uppercase mb-1">Plazo</div>
                                  <div className="text-lg font-bold font-mono">{activePlan.months} m</div>
                               </div>
                            </div>
                            <div className="bg-emerald-500/10 p-5 rounded-md border border-emerald-500/20 text-center">
                               <div className="text-[9px] font-black uppercase text-emerald-400 mb-1 tracking-widest">Neto a Liquidar</div>
                               <div className="text-3xl font-black text-emerald-400 font-mono">
                                 {/* @ts-ignore */}
                                 {formatCurrency(results.isLeasing ? results.capFin : results.neto)}
                               </div>
                            </div>
                            {!results.isLeasing && (
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <div className="flex justify-between text-[11px] text-white/50"><span>Solicitado Bruto</span><span className="font-bold font-mono text-white/80">{formatCurrency(results.bruto)}</span></div>
                                <div className="flex justify-between text-[11px] text-white/50"><span>Quebranto</span><span className="font-bold font-mono text-red-400">- {formatCurrency(results.quebranto)}</span></div>
                                <div className="flex justify-between text-[11px] text-white/50"><span>Gastos/Prenda</span><span className="font-bold font-mono text-red-400">- {formatCurrency(results.gastos + results.prenda)}</span></div>
                                {/* @ts-ignore */}
                                {results.actualPventa > 0 && (
                                   <div className="flex justify-between text-[11px] text-amber-400 pt-2 font-bold uppercase tracking-widest border-t border-white/5">
                                      <span>Aportar Cliente</span>
                                      {/* @ts-ignore */}
                                      <span className="font-mono">{formatCurrency(results.actualPventa - results.neto)}</span>
                                   </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="sleek-card h-full flex flex-col items-center p-10 text-center animate-in zoom-in-95 duration-500">
                           <Car className="w-16 h-16 text-vw-blue mb-6 stroke-[1.5]" />
                           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mb-4">Cotización Final</h3>
                           <div className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-8 mb-8">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Cuota mensual</div>
                              <div className="text-5xl font-black text-slate-900 tracking-tighter mb-4 font-mono">{formatCurrency(results.cuotaIni)}</div>
                              <div className="text-[10px] font-bold text-vw-blue px-3 py-1 bg-white border border-slate-200 rounded-full inline-block shadow-sm">100% GARANTÍA VWFS</div>
                           </div>
                           <div className="w-full grid grid-cols-2 gap-px bg-slate-200 rounded-lg overflow-hidden mb-8 border border-slate-200">
                              <div className="bg-white p-4">
                                 <div className="text-[9px] font-bold text-slate-400 uppercase">Plazo</div>
                                 <div className="text-base font-bold text-slate-800">{activePlan.months} Meses</div>
                              </div>
                              <div className="bg-white p-4">
                                 <div className="text-[9px] font-bold text-slate-400 uppercase">Tasa</div>
                                 <div className="text-base font-bold text-slate-800">{activePlan.tna}%</div>
                              </div>
                           </div>
                           {/* @ts-ignore */}
                           <div className="text-[10px] text-slate-400 font-medium leading-relaxed italic border-t border-gray-100 pt-6">** Simulación informada para {selectedModel?.name || "Unidad"} por Autosol. Sujeta a aprobación.</div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="sleek-card bg-slate-50 border-dashed p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                       <HelpCircle className="w-12 h-12 text-slate-200 mb-4" />
                       <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Ingrese los parámetros de simulación</p>
                    </div>
                  )}
                </AnimatePresence>
                
                {/* Visual Settings / Options */}
                <div className="sleek-card">
                  <div className="sleek-header">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parámetros Adicionales</h2>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] font-bold text-slate-400 uppercase">Gastos Admin (%)</label>
                       <input type="number" step="0.1" value={gastosAdmin} onChange={e=>setGastosAdmin(parseFloat(e.target.value)||0)} className="h-8 px-2 rounded border border-slate-200 text-xs font-mono font-bold focus:ring-1 focus:ring-vw-blue outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                       <label className="text-[9px] font-bold text-slate-400 uppercase">Prenda (%)</label>
                       <input type="number" step="0.1" value={prendaPct} onChange={e=>setPrendaPct(parseFloat(e.target.value)||0)} className="h-8 px-2 rounded border border-slate-200 text-xs font-mono font-bold focus:ring-1 focus:ring-vw-blue outline-none" />
                    </div>
                  </div>
                </div>
                
                <p className="text-center text-[9px] text-slate-400 mt-4 leading-tight">
                  La presente simulación no tiene valor legal y está sujeta a cambios sin previo aviso.<br/>
                  Consulte circulares vigentes de VWFS antes de formalizar.
                </p>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Plan Comparator Modal */}
      {showComparator && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md p-4 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Comparativa de Planes</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Contraste de cuotas según capital solicitado</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowComparator(false)} 
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >✕</button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              {comparativeResults.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Plazo</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Tasa (TNA)</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Cuota Inicial</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Cuota Promedio</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Neto a Liquidar</th>
                        <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pagado</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparativeResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-5 text-sm font-black text-slate-800">
                            {item.plan.months} <span className="text-[10px] text-slate-400 font-bold uppercase">Meses</span>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{item.plan.campaign}</div>
                          </td>
                          <td className="px-6 py-5 text-sm font-bold text-slate-600">
                             {item.plan.tna}% {item.plan.isUva ? "+ UVA" : ""}
                             <div className="text-[9px] text-slate-400 font-bold">QF: {item.plan.qF}%</div>
                          </td>
                          <td className="px-6 py-5 text-base font-black text-vw-blue">{formatCurrency(item.res.cuotaIni)}</td>
                          <td className="px-6 py-5 text-sm font-bold text-slate-600">{formatCurrency(item.res.cuotaProm)}</td>
                          <td className="px-6 py-5 text-sm font-bold text-emerald-600">
                            {formatCurrency(item.res.isLeasing ? item.res.capFin : item.res.neto)}
                          </td>
                          <td className="px-6 py-5 text-sm font-bold text-slate-500">
                            {formatCurrency(item.res.isLeasing ? item.res.totalCanones : item.res.totalPagado)}
                          </td>
                          <td className="px-6 py-5 text-center">
                             <button 
                               onClick={() => {
                                 const pIdx = availablePlans.findIndex(p => p.months === item.plan.months && p.campaign === item.plan.campaign);
                                 if (pIdx > -1) setSelectedPlanIdx(pIdx);
                                 setShowComparator(false);
                               }}
                               className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-vw-blue transition-all shadow-md active:scale-95"
                             >Seleccionar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                  <Calculator className="w-16 h-16 opacity-10" />
                  <p className="font-bold text-xs uppercase tracking-[0.2em]">Ingrese montos para contrastar planes vigentes</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-white flex justify-between items-center px-8">
               <p className="text-[10px] text-slate-400 italic font-medium">Valores sujetos a aprobación crediticia de VWFS.</p>
               <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-vw-blue rounded-full"></div>
                     <span className="text-[9px] font-black text-slate-500 uppercase">Cuota Inicial</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                     <span className="text-[9px] font-black text-slate-500 uppercase">Neto a Liquidar</span>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Database/Config Editor Modal */}
      {showConfigEditor && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md p-4 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden"
          >
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-vw-blue/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-vw-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 tracking-tight text-vw-blue">Panel de Administración de Datos</h3>
                  <p className="text-xs text-slate-500 font-medium italic">Gestión de Precios, Tasas y Campañas Mensuales</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfigEditor(false)}
                className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex bg-slate-50">
              <div className="w-1/3 p-6 border-r border-slate-200 overflow-y-auto space-y-6">
                 <div>
                   <h4 className="text-[10px] font-black uppercase text-emerald-500 mb-3 tracking-widest flex items-center gap-2">
                     <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                     Sincronización con Google Sheets
                   </h4>
                   <div className="space-y-4">
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Malla de Precios (Modelos)</p>
                        <input 
                          type="text"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] focus:border-vw-blue outline-none"
                          value={sheetUrl}
                          onChange={(e) => setSheetUrl(e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Parámetros Globales (Config)</p>
                        <input 
                          type="text"
                          placeholder="URL del Sheet de Tasas/UVA"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] focus:border-vw-blue outline-none"
                          value={configSheetUrl}
                          onChange={(e) => setConfigSheetUrl(e.target.value)}
                        />
                      </div>

                      <button 
                        onClick={() => {
                          fetchSheetData(sheetUrl);
                          fetchConfigData(configSheetUrl);
                        }}
                        disabled={isSyncing}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isSyncing ? 'bg-slate-200 text-slate-400' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'}`}
                      >
                        {isSyncing ? 'Sincronizando Todo...' : 'Sincronizar Panel de Ventas'}
                      </button>
                   </div>
                 </div>

                 <div>
                   <h4 className="text-[10px] font-black uppercase text-vw-blue mb-3 tracking-widest flex items-center gap-2">
                     <div className="w-1 h-3 bg-vw-blue rounded-full"></div>
                     Flujo de actualización
                   </h4>
                   <ol className="space-y-4">
                      <li className="flex gap-3">
                         <div className="shrink-0 w-5 h-5 bg-vw-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">1</div>
                         <p className="text-[11px] text-slate-600 leading-snug">Mantén tus datos en el <b>Google Sheet</b> corporativo de Autosol.</p>
                      </li>
                      <li className="flex gap-3">
                         <div className="shrink-0 w-5 h-5 bg-vw-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">2</div>
                         <p className="text-[11px] text-slate-600 leading-snug">Copia la plantilla de parámetros mensuales a una Google Sheet separada.</p>
                      </li>
                      <li className="flex gap-3">
                         <div className="shrink-0 w-5 h-5 bg-vw-blue text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</div>
                         <p className="text-[11px] text-slate-600 leading-snug">Modifica solo la columna <code className="text-vw-blue bg-blue-50 px-1">Valor</code> cada mes, manteniendo las claves iguales para que la app lea tasas, topes, UVA, prenda y campañas.</p>
                      </li>
                   </ol>
                 </div>

                 <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      <b>Advertencia:</b> No cambies los nombres de la columna <b>Clave</b> ni las claves internas de cada plan. Solo actualiza valores y conserva una copia del mes anterior.
                    </p>
                 </div>
              </div>

              <div className="flex-1 flex flex-col p-6">
                <div className="flex-1 bg-[#1e1e1e] rounded-xl relative group overflow-hidden border border-slate-800">
                  <div className="absolute top-3 right-3 opacity-50 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">Read-Only View</span>
                  </div>
                  <textarea 
                    className="w-full h-full font-mono text-[11px] p-6 bg-transparent text-emerald-400 outline-none resize-none leading-relaxed"
                    value={JSON.stringify(activeConfig, null, 2)}
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Circular Activa: {activeConfig.currentMonth}
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowConfigEditor(false)}
                  className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                >
                  Cerrar Panel
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(activeConfig, null, 2));
                    alert("¡Configuración activa copiada satisfactoriamente!");
                  }}
                  className="px-8 py-2.5 bg-vw-blue text-white rounded-xl text-xs font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Copiar Estructura Maestra
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <footer className="h-8 bg-[#007ACC] text-white flex items-center px-4 justify-between text-[11px] font-medium shrink-0 shadow-lg relative z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${sheetModels.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-white'}`}></div>
            {sheetModels.length > 0 ? `Sincronizado: ${sheetModels.length} modelos` : `Circular Estática: ${activeConfig.circularNumber}`}
          </span>
          <span className="opacity-60 hidden sm:block">|</span>
          <span className="hidden sm:inline">UVA Ref: ${activeConfig.uvaReference}</span>
        </div>
        <div className="flex items-center gap-4 opacity-80 uppercase tracking-widest text-[9px] font-black">
          <span className="hidden md:inline">AUTOSOL_VWFS_SYSTEM</span>
          <span className="flex items-center gap-1">
             <AlertCircle className="w-3 h-3" /> {isSyncing ? 'Actualizando Datos...' : 'Sistema Operativo'}
          </span>
        </div>
      </footer>

      {/* Professional Print Template */}
      <div className="print-only fixed inset-0 bg-white p-10 z-[100] text-slate-800 font-sans">
        <div className="flex justify-between items-start border-b-2 border-vw-blue pb-6 mb-8">
          <div>
             <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-vw-blue rounded flex items-center justify-center">
                  <svg viewBox="0 0 38 38" className="w-6 h-6 text-white"><circle cx="19" cy="19" r="17" stroke="currentColor" strokeWidth="2.5" fill="none" /><path d="M11 12l5.5 13 2.5-6 2.5 6L27 12h-3l-4 10-4-10z" fill="currentColor" /></svg>
                </div>
                <div>
                  <h1 className="text-xl font-black text-vw-blue tracking-tighter">AUTOSOL S.A.</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financiación Exclusiva VWFS</p>
                </div>
             </div>
          </div>
          <div className="text-right">
             <div className="text-sm font-bold text-slate-900">Cotización de Financiación</div>
             <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">{new Date().toLocaleDateString("es-AR", { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-8">
           <div className="space-y-4">
              <h3 className="text-xs font-black text-vw-blue uppercase tracking-widest border-b border-slate-100 pb-1">Unidad Seleccionada</h3>
              <div className="space-y-2">
                 <div className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-xs text-slate-500">Modelo</span>
                    <span className="text-xs font-bold text-slate-800">{category === 'usados' ? 'UNIDAD USADA' : (selectedModel?.name || "Sin especificar")}</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-xs text-slate-500">Precio Lista / InfoAuto</span>
                    <span className="text-xs font-bold text-slate-800">{formatCurrency(category === 'usados' ? valUsado : (selectedModel?.price || 0))}</span>
                 </div>
                 {priceVenta > 0 && (
                   <div className="flex justify-between border-b border-slate-50 py-1">
                      <span className="text-xs text-slate-500">Precio Venta (con bonif.)</span>
                      <span className="text-xs font-bold text-slate-800">{formatCurrency(priceVenta)}</span>
                   </div>
                 )}
              </div>
           </div>

           <div className="space-y-4">
              <h3 className="text-xs font-black text-vw-blue uppercase tracking-widest border-b border-slate-100 pb-1">Detalle del Crédito</h3>
              <div className="space-y-2">
                 <div className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-xs text-slate-500">Línea de Crédito</span>
                    <span className="text-xs font-bold text-slate-800">{line.toUpperCase()} {activePlan?.campaign?.toUpperCase()}</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-xs text-slate-500">Plazo Elegido</span>
                    <span className="text-xs font-bold text-slate-800">{activePlan?.months} Meses</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-50 py-1">
                    <span className="text-xs text-slate-500">Tasa (TNA)</span>
                    <span className="text-xs font-bold text-slate-800">{activePlan?.tna}% {activePlan?.isUva ? '+ UVA' : ''}</span>
                 </div>
              </div>
           </div>
        </div>

        {results && (
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-6 mb-8">
             <div className="flex justify-between items-center mb-6">
                <div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Monto a Financiar</div>
                   <div className="text-2xl font-black text-vw-blue font-mono">{formatCurrency(results.isLeasing ? results.capFin : results.bruto)}</div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cuota Estimada Inicial</div>
                   <div className="text-4xl font-black text-vw-blue font-mono tracking-tighter">{formatCurrency(results.cuotaIni)}</div>
                </div>
             </div>
             <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                <div>
                   <div className="text-[9px] font-bold text-slate-400 uppercase">Anticipo Neto</div>
                   <div className="text-sm font-bold text-slate-800">{formatCurrency((priceVenta || selectedModel?.price || valUsado) - results.neto)}</div>
                </div>
                <div className="text-center">
                   <div className="text-[9px] font-bold text-slate-400 uppercase">Cuota Promedio</div>
                   <div className="text-sm font-bold text-slate-800">{formatCurrency(results.cuotaProm)}</div>
                </div>
                <div className="text-right">
                   <div className="text-[9px] font-bold text-slate-400 uppercase">Seguro / Gastos</div>
                   <div className="text-sm font-bold text-slate-800">Cargados en Cuota</div>
                </div>
             </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-slate-200 space-y-4">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
            Legal Disclaimer & Aviso de Confidencialidad
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed italic">
            La presente simulación técnica es de carácter informativo y no constituye una oferta contractual ni tiene valor legal. 
            Las condiciones financieras (Tasas, Comisiones, Cuotas) están sujetas a modificaciones de acuerdo a las circulares operativas vigentes al momento de la liquidación del crédito por parte de Volkswagen Financial Services. 
            Todas las operaciones están sujetas a aprobación crediticia. Los valores expresados pueden variar según perfil del cliente y gastos de otorgamiento no contemplados en esta simulación simplificada. 
            Circular Ref: {activeConfig.circularNumber} ({activeConfig.currentMonth}) - Autosol S.A.
          </p>
          <div className="flex justify-between items-end pt-12">
             <div className="w-48 h-px bg-slate-300"></div>
             <div className="text-[10px] font-black text-vw-blue">WWW.AUTOSOLVW.COM.AR</div>
          </div>
        </div>
      </div>
    </div>
  );
}
