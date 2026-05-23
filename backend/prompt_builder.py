import json

def flag_outliers(module_type: str, inputs: dict) -> list[str]:
    warnings = []
    if module_type == "cbc":
        hb = inputs.get("hb")
        if hb is not None and (hb < 2 or hb > 25):
            warnings.append("Hemoglobin value is extreme (< 2 or > 25 g/dL) — verify")
        wbc = inputs.get("wbc")
        if wbc is not None and wbc > 500:
            warnings.append("WBC > 500 × 10⁹/L — verify for leukostasis or lab error")
        platelets = inputs.get("platelets")
        if platelets is not None and platelets > 3000:
            warnings.append("Platelets > 3000 × 10⁹/L — verify for extreme thrombocytosis")
    elif module_type == "coag":
        inr = inputs.get("inr")
        if inr is not None and inr > 20:
            warnings.append("INR > 20 — extreme coagulopathy; verify")
        aptt = inputs.get("aptt")
        if aptt is not None and aptt > 300:
            warnings.append("aPTT > 300s — extreme prolongation; verify")
        fibrinogen = inputs.get("fibrinogen")
        if fibrinogen is not None and fibrinogen < 0.1:
            warnings.append("Fibrinogen < 0.1 g/L — critical hypofibrinogenemia")
    elif module_type == "rotem":
        for assay in ["extem", "intem", "fibtem", "aptem"]:
            assay_val = inputs.get(assay)
            if assay_val is not None and isinstance(assay_val, dict):
                mcf = assay_val.get("mcf")
                if mcf is not None and mcf < 0:
                    warnings.append(f"{assay.upper()} MCF < 0 — invalid value")
    return warnings

def build_analysis_prompt(module_type: str, corpus: str, inputs: dict,
                          patient_name: str = "", display_id: str = "",
                          attached_reports: list[str] = []) -> str:
    """
    Assemble the prompt in this exact order:
      1. System rules block
      2. ## DOMAIN KNOWLEDGE\n{corpus}
      3. Style guide
      4. If patient_name is non-empty: ## PATIENT CONTEXT\n...
      5. ## PATIENT INPUTS\n{json.dumps(inputs, indent=2)}
      6. If attached_reports is non-empty: ## ATTACHED HISTORICAL REPORTS\n + each report joined by \n---\n
      7. If warnings list is non-empty: ## OUTLIER FLAGS\n + newline-joined warnings
      8. Output contract
    """
    system_rules = (
        "You are HEMATOX, a domain-locked hematology reasoning engine for educational and clinical decision-support use.\n"
        "CONTEXT PRIORITY LAW (strictly enforced):\n"
        "1. LOCAL GUIDELINES (corpus below) = your primary reasoning authority. Never contradict them.\n"
        "2. Search grounding or external knowledge = second source when corpus is incomplete. (use gemini-3.1-flash-lite for this specific task)\n"
        "3. General model knowledge = fallback only. Never override corpus with it.\n"
        "4. Chat context (summary + messages) = situational context only. Not a reasoning authority.\n"
        "Frame all conclusions as differential hypotheses. Never issue definitive diagnoses.\n"
        "Respond in strict academic and clinical tone. No casual language."
    )
    
    domain_knowledge = f"## DOMAIN KNOWLEDGE\n{corpus}"
    
    style_guide = (
        "Respond in structured Markdown with the following exact sections in order:\n"
        "## Observed Data\n"
        "## Physiological Interpretation\n"
        "## Differential Diagnoses\n"
        "## Severity Assessment\n"
        "## Clinical Correlation\n"
        "## Limitations"
    )
    
    patient_inputs = f"## PATIENT INPUTS\n{json.dumps(inputs, indent=2)}"
    
    parts = [system_rules, domain_knowledge, style_guide]
    
    if patient_name:
        patient_context = (
            "## PATIENT CONTEXT\n"
            f"Patient: {patient_name}\n"
            f"Report ID: {display_id}\n"
            "The patient name is for labeling only — do not use it for medical inference."
        )
        parts.append(patient_context)
        
    parts.append(patient_inputs)
    
    if attached_reports:
        reports_str = "\n---\n".join(attached_reports)
        parts.append(f"## ATTACHED HISTORICAL REPORTS\n{reports_str}")
        
    warnings = flag_outliers(module_type, inputs)
    if warnings:
        warnings_str = "\n".join(warnings)
        parts.append(f"## OUTLIER FLAGS\n{warnings_str}")
        
    output_contract = "Respond ONLY in structured Markdown. Do not add disclaimers outside the Limitations section."
    parts.append(output_contract)
    
    return "\n\n".join(parts)

