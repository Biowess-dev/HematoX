"""
Input validation helpers for HematoX analysis modules.

Each validator returns a list of human-readable warning strings for
physiologically suspect values.  They never raise; an empty list means
no concerns were detected.  These warnings are prepended to the LLM
prompt as a VALIDATION WARNINGS block.
"""


def validate_cbc_inputs(data: dict) -> list[str]:
    """Validate Complete Blood Count input values and return warning strings.

    Checks Hgb/Hct ratio consistency, MCHC upper bound, and extreme RDW.
    """
    warnings = []

    # 1. Hgb/Hct ratio validation
    hb = data.get("hb")
    hct = data.get("hct")
    if hb is not None and hct is not None and hb > 0 and hct > 0:
        ratio = hct / hb
        if not (5 < ratio < 10):
            warnings.append("Hgb/Hct ratio appears inconsistent — verify units")

    # 2. MCHC validation
    mchc = data.get("mchc")
    if mchc is not None and mchc > 38.0:
        warnings.append("MCHC > 38 g/dL — consider spherocytosis, lipemia, or spurious result")

    # 3. RDW validation
    rdw = data.get("rdw")
    if rdw is not None and rdw > 30.0:
        warnings.append("RDW > 30% is extreme — verify result")

    return warnings


def validate_coag_inputs(data: dict) -> list[str]:
    """Validate coagulation input values and return warning strings.

    Checks for critical INR elevation and extreme aPTT prolongation.
    """
    warnings = []

    # 1. INR validation
    inr = data.get("inr")
    if inr is not None and inr > 10.0:
        warnings.append("INR > 10 — critical coagulopathy; verify for dilutional or synthetic failure")

    # 2. aPTT validation
    aptt = data.get("aptt")
    if aptt is not None and aptt > 150:
        warnings.append("aPTT > 150s — consider presence of inhibitor or anticoagulant")

    return warnings


def validate_rotem_inputs(data: dict) -> list[str]:
    """Validate ROTEM assay input values and return warning strings.

    Checks all four standard assays (EXTEM, INTEM, FIBTEM, APTEM) for
    severely impaired clot firmness (MCF < 5 mm).
    """
    warnings = []
    for assay in ("extem", "intem", "fibtem", "aptem"):
        assay_data = data.get(assay)
        if assay_data is not None and isinstance(assay_data, dict):
            mcf = assay_data.get("mcf")
            if mcf is not None and mcf < 5:
                warnings.append(f"{assay.upper()} MCF < 5mm — severely impaired clot firmness")
    return warnings
