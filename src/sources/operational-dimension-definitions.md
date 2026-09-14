---

title: Operational Dimension Definitions — Standard Reference

date: 2026-06-03

author: steve

project: herkimer

model: claude-sonnet-4-6

effort_level: max

repo: aix-private/

task: Define four operational policy dimensions as a generation standard; establish correct bottom-up provenance from HTML demos and stakeholder meetings

primary_sources: herkimer-county-27feb.html, herkimer-25march.html, hc-values-based-policy-generator-demo.html, APR22 transcript, May 20 status slides, May 20 session log

downstream_codification: workshop-1-exercise-scaffold.md

first_application: workshop-1-policy-texts.md

comparison_models: gpt-4o, claude-opus-4-6, gemini-pro

replication_prompt: "Define the four operational dimensions — Security, Accountability, Efficiency, Innovation — as a standard generation reference. Draw Hi/Lo language from the HTML demos and meeting transcripts directly. Definitions should be county-calibrated, bottom-up from stakeholder sessions, with external framework citations as alignment references only. Each entry should include: the county-calibrated definition with Hi/Lo language, the project files where that language originated, and external alignment notes."

---

# Operational Dimension Definitions: Standard Reference

The four operational dimensions — Security, Accountability, Efficiency, Innovation — were calibrated through stakeholder sessions with Herkimer County government (April 22 and May 20, 2026). The Hi/Lo language below is the county's own. External framework citations confirm alignment with recognized governance literature; they are not the source of these definitions.

This block governs policy generation, content validation, and document review across all Herkimer County AI policy deliverables.

---

## Sources

The authoritative lineage runs from the HTML demos (primary) through the stakeholder meetings (calibration) to the exercise scaffold (downstream codification). The scaffold is not a source — it is a structured restatement of language that originated in the HTML files and meetings.

**Primary — Hi/Lo language origin**

`projects/herkimer/overviews/herkimer-county-27feb.html` — Feb 2026 demo; Hi/Lo display language for all four dimensions and 16-variant policy matrix

`projects/herkimer/overviews/herkimer-25march.html` — Mar 25, 2026 demo; seven-dimension framework, framing Hi/Neutral/Lo, operational Hi/Lo, 8-step process flow

`projects/herkimer/overviews/hc-values-based-policy-generator-demo.html` — earlier interactive demo; establishes dimensional architecture and four governance positions

**Calibration — stakeholder grounding**

`projects/herkimer/meetings/20260422/Herkimer county_APR22.transcript.srt` — Apr 22 session; accountability discussion (~00:49–00:52), FOIL, shadow AI, caseworker accountability

`projects/herkimer/meetings/20260520 - May 20/herkimer-may-status-slides.md` — May 20 session; framing dimension decisions (sec. 8), operational definitions applied to two use cases (sec. 9)

`projects/herkimer/meetings/20260520 - May 20/Steve-Claude-May 20 Meeting Preparation.json` — May 20 working log; calibration reasoning and 25–30 word guiding statements per framing dimension

**Downstream codification — not primary sources**

`projects/herkimer/tasks/ai-use-case-generation/workshop-1-exercise-scaffold.md` — consolidates Hi/Lo language from HTML sources into generation-ready form

`projects/herkimer/tasks/ai-use-case-generation/use-case-policy-texts/workshop-1-policy-texts.md` — first application; 16 policy texts across 4 employees and 4 flavors

`projects/herkimer/tasks/ai-use-case-generation/use-case-policy-texts/facilitator-notes.md` — shows definitions in facilitation context

**External alignment only — not sources**

`projects/herkimer/data/County AI_Claude_Co-worker/AI Policy outline-knowledgebase/GPT1.md` — NIST AI RMF 1.0, OMB M-24-18 (Accountability, Efficiency)

`projects/herkimer/data/County AI_Claude_Co-worker/AI Policy outline-knowledgebase/Gemini-US County AI Policy Outline.md` — NYS-P24-001, RAISE Act (Accountability)

`projects/herkimer/data/County AI_Claude_Co-worker/AI Policy outline-knowledgebase/Grok-County AI Policy Outline and Guidelines.md` — NACo AI County Compass (Innovation)

`projects/herkimer/data/County AI_Claude_Co-worker/AI Policy outline-knowledgebase/Claude-2.md` — Cayuga County Resolution 471-25, Section 7.5 (Innovation)

---

## Security

County-calibrated definition. Security governs whether AI tools used in county work are approved and auditable, and whether data generated or processed during that work remains under county control. The operative question is: where does the data go, and who approved the tool?

Hi: approved, security-vetted tools only; resident and employee data shall not leave county networks; all tools are auditable by IT.

Lo: any commercially available tool is permitted; staff are responsible for appropriate data handling.

Where this language was built. The Hi/Lo display language originates in herkimer-county-27feb.html and herkimer-25march.html. It was calibrated with county stakeholders in the April 22 meeting, where the IT director confirmed data sovereignty as the operative concern — the question of whether data leaves county systems. workshop-1-exercise-scaffold.md codifies this language in generation-ready form but is downstream of the HTML sources.

External alignment. NIST CSF 2.0 PROTECT function; NIST AI RMF 1.0 GOVERN and MANAGE functions on risk assessment before deployment and data control throughout the AI lifecycle. Cayuga County Resolution 471-25 operationalizes this as department-by-department prohibited data type lists.

---

## Accountability

County-calibrated definition. Accountability governs whether AI-assisted actions are logged and whether a named staff member is responsible for each determination. The operative question is: if this decision is later questioned, can we identify who made it, with what tool, and when?

Hi: every AI-assisted action is logged with staff ID, tool name, and timestamp; records retained for 90 days; a named staff member is responsible for every determination. The AI output is an input to the determination, not the determination itself.

Lo: no AI-specific logging required; accountability follows existing supervisory and records practices.

Where this language was built. The Hi/Lo language originates in herkimer-county-27feb.html and herkimer-25march.html. It was grounded in the April 22 meeting, which contains an extended discussion (~00:49–00:52) of caseworker accountability and FOIL exposure — the county attorney scenario ("I just did what the AI said") is the grounding case. The May 20 status slides (herkimer-may-status-slides.md, section 9) show the definition applied to both the DSS caseworker and the highway supervisor use cases. workshop-1-exercise-scaffold.md codifies this language downstream.

External alignment. NIST AI RMF 1.0 GOVERN function on traceable roles and responsibilities. NY FOIL creates a practical accountability obligation: AI-assisted records informing official decisions may be subject to disclosure. NYS-P24-001 and the pending RAISE Act require that AI-assisted determinations affecting individuals be attributable to a responsible human.

---

## Efficiency

County-calibrated definition. Efficiency governs the approval pathway between AI-generated output and action. The operative question is: does acting on this output require an additional review step, or may staff act after their own review?

Hi: staff may act directly on AI-generated output after their own review; no additional approval step is required before action.

Lo: AI-generated output requires supervisor sign-off or a second review step before action is taken.

Where this language was built. The Hi/Lo language originates in herkimer-county-27feb.html and herkimer-25march.html. The operative calibration decision was made May 20 and recorded in herkimer-may-status-slides.md (section 8, Human Impact): existing supervisory chains govern — no new AI-specific approval steps are added or removed. That decision is the operational meaning of Efficiency in Herkimer County: the dimension describes how much the existing chain is engaged, not whether a new one is created. workshop-1-exercise-scaffold.md codifies this downstream.

External alignment. NIST AI RMF 1.0 GOVERN-1.1 on preservation of human oversight as AI accelerates workflow steps. OMB M-24-18 requires agencies to specify where human review remains mandatory and where it may be streamlined.

---

## Innovation

County-calibrated definition. Innovation governs who may identify, pilot, and adopt new AI tools and under what conditions. The operative question is: is tool selection centralized or distributed?

Hi: staff are encouraged to identify and pilot new AI tools within defined parameters; tools that meet county standards may be adopted by departments.

Lo: only county-designated AI tools are permitted; staff use the approved set and do not adopt tools independently.

Where this language was built. The Hi/Lo language originates in herkimer-county-27feb.html and herkimer-25march.html. The April 22 transcript names shadow AI — tools already in use by county staff that have not been reviewed, approved, or logged — as the existing condition policy must address. Innovation governs the pathway for managing that condition going forward, not enthusiasm for technology adoption. workshop-1-exercise-scaffold.md codifies this language downstream.

External alignment. NACo AI County Compass (2024) frames innovation governance as a controlled adoption pathway — who initiates and authorizes, not whether to adopt. Cayuga County Resolution 471-25, Section 7.5, operationalizes this as a named exception and approval process managed by the AI Policy Committee.

---

## Usage

This block is the generation standard. Any policy text that deviates from these definitions in substance — not style — is a generation error. The external alignment citations are for formal deliverables presented to county stakeholders; they are not required in workshop materials.
