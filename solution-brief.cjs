const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat, TabStopType, TabStopPosition
} = require("docx");

// Colors
const CORAL = "FF8D6B";
const CHARCOAL = "1C1C1C";
const TEAL = "14B8A6";
const LIGHT_GRAY = "F4F4F4";
const MID_GRAY = "707070";
const WHITE = "FFFFFF";

// Table helpers
const CONTENT_WIDTH = 9360;
const border = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: CHARCOAL, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: "center",
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: "Arial", size: 18, color: WHITE })] })],
  });
}

function bodyCell(text, width, opts = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({
      children: [new TextRun({ text, font: "Arial", size: 18, color: CHARCOAL, bold: opts.bold || false })],
    })],
  });
}

function coralAccentLine() {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CORAL, space: 1 } },
    children: [],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text: text.toUpperCase(), font: "Arial", size: 22, bold: true, color: CORAL, characterSpacing: 60 })],
  });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.spaceBefore || 80, after: opts.spaceAfter || 80 },
    alignment: opts.alignment || AlignmentType.LEFT,
    children: [new TextRun({ text, font: "Arial", size: 20, color: opts.color || CHARCOAL })],
  });
}

function boldBodyText(boldPart, normalPart) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({ text: boldPart, font: "Arial", size: 20, color: CHARCOAL, bold: true }),
      new TextRun({ text: normalPart, font: "Arial", size: 20, color: CHARCOAL }),
    ],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: CHARCOAL },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: CHARCOAL },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  sections: [
    // ==================== PAGE 1: COVER / EXECUTIVE SUMMARY ====================
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1080, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Solution Brief", font: "Arial", size: 16, color: MID_GRAY, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Wanderlust | Context Tracking at Edge", font: "Arial", size: 14, color: MID_GRAY }),
              new TextRun({ text: "    Page ", font: "Arial", size: 14, color: MID_GRAY }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 14, color: MID_GRAY }),
            ],
          })],
        }),
      },
      children: [
        // Title block
        new Paragraph({ spacing: { before: 600, after: 0 }, children: [] }),
        new Paragraph({
          spacing: { after: 0 },
          children: [new TextRun({ text: "WANDERLUST", font: "Arial", size: 56, bold: true, color: CHARCOAL, characterSpacing: 80 })],
        }),
        new Paragraph({
          spacing: { before: 60, after: 0 },
          children: [new TextRun({ text: "Context Tracking at Edge", font: "Arial", size: 32, color: CORAL })],
        }),
        coralAccentLine(),
        new Paragraph({
          spacing: { before: 200, after: 120 },
          children: [new TextRun({
            text: "Intent-Based User Profiling for Real-Time Personalized Recommendations",
            font: "Arial", size: 22, color: MID_GRAY, italics: true,
          })],
        }),

        // Exec summary
        sectionHeading("Executive Summary"),
        bodyText(
          "Wanderlust is a privacy-first, client-side intent tracking prototype that replaces traditional page-view analytics with real-time behavioral intent inference. Instead of logging raw events like \u201Ccustomer viewed page\u201D or \u201Ccustomer clicked product,\u201D the system summarizes what the customer actually wants \u2014 their travel intent \u2014 within each session and persists this as a series of intent records."
        ),
        bodyText(
          "On the next visit, the accumulated intent profile drives personalized destination recommendations without requiring a backend, a data warehouse, or third-party analytics. All computation happens in the browser. All data stays on the device."
        ),

        // Value prop table
        sectionHeading("Why Intent Tracking vs. Traditional Analytics"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [3120, 3120, 3120],
          rows: [
            new TableRow({
              children: [
                headerCell("Dimension", 3120),
                headerCell("Traditional Analytics", 3120),
                headerCell("Intent Tracking (Ours)", 3120),
              ],
            }),
            new TableRow({ children: [
              bodyCell("What is tracked", 3120, { bold: true }),
              bodyCell("Raw events (pageview, click, scroll)", 3120),
              bodyCell("Summarized intents (interests, preferences, comparisons)", 3120, { shading: "FFF0EB" }),
            ]}),
            new TableRow({ children: [
              bodyCell("Where computed", 3120, { bold: true }),
              bodyCell("Server-side / data warehouse", 3120),
              bodyCell("Client-side, in the browser", 3120, { shading: "FFF0EB" }),
            ]}),
            new TableRow({ children: [
              bodyCell("Latency to personalize", 3120, { bold: true }),
              bodyCell("Minutes to hours (batch ETL)", 3120),
              bodyCell("Real-time (<5 seconds)", 3120, { shading: "FFF0EB" }),
            ]}),
            new TableRow({ children: [
              bodyCell("Privacy posture", 3120, { bold: true }),
              bodyCell("Server stores behavioral data", 3120),
              bodyCell("Data never leaves the device", 3120, { shading: "FFF0EB" }),
            ]}),
            new TableRow({ children: [
              bodyCell("Data granularity", 3120, { bold: true }),
              bodyCell("High volume, noisy events", 3120),
              bodyCell("Low volume, high-signal intents", 3120, { shading: "FFF0EB" }),
            ]}),
            new TableRow({ children: [
              bodyCell("Cross-session memory", 3120, { bold: true }),
              bodyCell("Requires user ID + data joins", 3120),
              bodyCell("localStorage with temporal decay", 3120, { shading: "FFF0EB" }),
            ]}),
          ],
        }),

        // Page break to page 2
        new Paragraph({ children: [new PageBreak()] }),

        // ==================== PAGE 2: HOW IT WORKS ====================
        sectionHeading("How It Works"),
        bodyText(
          "The system operates as a four-stage pipeline that runs entirely in the browser, triggered every 5 seconds as the user interacts with the page:"
        ),

        // Pipeline flow
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({ text: "Capture Interactions \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Mouse hovers (1s+ dwell), card clicks, and search queries are captured as typed events with timestamps. Passive scroll-views are disabled by default (too noisy).", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Summarize Intent \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Raw events are analyzed for patterns: regional interest, price preference, trip type affinity, active comparisons, and search intent. Each pattern becomes a named intent with a confidence score (0\u20131.0).", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Persist Profile \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Intents are saved to localStorage as a session record. Tag weights are recomputed across all sessions with exponential temporal decay (0.8\u00D7 per session), so recent interests naturally outweigh older ones.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Generate Recommendations \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "On the next visit (or within the same session), destinations are scored against the user\u2019s tag weights, normalized to prevent tag-count bias, and filtered for geographic diversity (max 3 per region).", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),

        // Architecture diagram (text-based)
        sectionHeading("Data Flow Architecture"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [1872, 1872, 1872, 1872, 1872],
          rows: [
            new TableRow({ children: [
              new TableCell({
                borders, width: { size: 1872, type: WidthType.DXA },
                shading: { fill: "E8F5E9", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "User Events", bold: true, font: "Arial", size: 16, color: CHARCOAL })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "hover, click, search", font: "Arial", size: 14, color: MID_GRAY })] }),
                ],
              }),
              new TableCell({
                borders, width: { size: 1872, type: WidthType.DXA },
                shading: { fill: "E3F2FD", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Intent Summarizer", bold: true, font: "Arial", size: 16, color: CHARCOAL })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "pattern detection + weighting", font: "Arial", size: 14, color: MID_GRAY })] }),
                ],
              }),
              new TableCell({
                borders, width: { size: 1872, type: WidthType.DXA },
                shading: { fill: "FFF3E0", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Intent Store", bold: true, font: "Arial", size: 16, color: CHARCOAL })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "localStorage + decay", font: "Arial", size: 14, color: MID_GRAY })] }),
                ],
              }),
              new TableCell({
                borders, width: { size: 1872, type: WidthType.DXA },
                shading: { fill: "FCE4EC", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Rec Engine", bold: true, font: "Arial", size: 16, color: CHARCOAL })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "scoring + diversity", font: "Arial", size: 14, color: MID_GRAY })] }),
                ],
              }),
              new TableCell({
                borders, width: { size: 1872, type: WidthType.DXA },
                shading: { fill: "F3E5F5", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Personalized UI", bold: true, font: "Arial", size: 16, color: CHARCOAL })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "recommendations", font: "Arial", size: 14, color: MID_GRAY })] }),
                ],
              }),
            ]}),
          ],
        }),
        bodyText(
          "Every 5 seconds \u2192 Events flush \u2192 Intents extracted \u2192 Profile updated \u2192 Recommendations refreshed",
          { spaceBefore: 120, color: MID_GRAY }
        ),

        // Weighting
        sectionHeading("Intelligent Signal Weighting"),
        bodyText(
          "Not all interactions carry equal weight. The system applies three layers of weighting to extract maximum signal:"
        ),
        boldBodyText("Event Type Weight \u2014 ", "Clicks (3\u00D7) signal deliberate intent. Hovers (2\u00D7) indicate active consideration. Passive scroll-views (1\u00D7) are disabled by default due to noise."),
        boldBodyText("Recency Decay \u2014 ", "Within a session, recent events are weighted up to 2\u00D7 higher than early events (0.5\u20131.0 multiplier). Across sessions, older sessions decay exponentially at 0.8\u00D7 per session."),
        boldBodyText("Frequency Bonus \u2014 ", "Repeated interactions with the same destination earn a log\u2082 bonus (2 clicks = +1.0, 4 clicks = +2.0), with diminishing returns to prevent single-destination dominance."),

        // Page break to page 3
        new Paragraph({ children: [new PageBreak()] }),

        // ==================== PAGE 3: INTENT CATEGORIES + USE CASE ====================
        sectionHeading("Six Intent Categories Detected"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2200, 2800, 2200, 2160],
          rows: [
            new TableRow({ children: [
              headerCell("Intent", 2200),
              headerCell("Example Output", 2800),
              headerCell("Trigger", 2200),
              headerCell("Confidence", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Region Interest", 2200, { bold: true }),
              bodyCell("\"Interested in adventure destinations in Southeast Asia\"", 2800),
              bodyCell("\u22653 events in a region", 2200),
              bodyCell("count / 10, max 1.0", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Price Preference", 2200, { bold: true }),
              bodyCell("\"Looking for budget travel options\"", 2800),
              bodyCell("\u226550% in one price tier", 2200),
              bodyCell("tier% of total", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Trip Type Affinity", 2200, { bold: true }),
              bodyCell("\"Interested in romantic trips\"", 2800),
              bodyCell("\u226535% in one trip type", 2200),
              bodyCell("type% of total", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Search Intent", 2200, { bold: true }),
              bodyCell("\"Searched for \u2018beach\u2019 \u2014 interested in beach destinations\"", 2800),
              bodyCell("Any search query \u22652 chars", 2200),
              bodyCell("0.90 fixed", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Comparison", 2200, { bold: true }),
              bodyCell("\"Comparing Bali and Phuket\"", 2800),
              bodyCell("2\u20133 unique clicks", 2200),
              bodyCell("0.85 fixed", 2160),
            ]}),
            new TableRow({ children: [
              bodyCell("Hover Interest", 2200, { bold: true }),
              bodyCell("\"Considering adventure options in Europe\"", 2800),
              bodyCell("\u22652 hovers same region, no click", 2200),
              bodyCell("hover_time / 10s, max 0.9", 2160),
            ]}),
          ],
        }),

        sectionHeading("Use Case: Travel Destination Discovery"),
        bodyText(
          "The prototype implements a travel website with 24 global destinations across 10 regions, 5 trip types, and 3 price tiers. A visitor browses the page:"
        ),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 80, after: 40 },
          children: [new TextRun({ text: "She hovers over Bali for 3 seconds, then Phuket for 2 seconds, then clicks on Da Nang", font: "Arial", size: 20, color: CHARCOAL })],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: "She searches for \u201Cbeach romantic\u201D", font: "Arial", size: 20, color: CHARCOAL })],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 40, after: 40 },
          children: [new TextRun({ text: "She clicks Bali to see details, then clicks Maldives", font: "Arial", size: 20, color: CHARCOAL })],
        }),
        bodyText("The system infers:", { spaceBefore: 120 }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: "Region: ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Southeast Asia (high confidence)", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "Trip type: ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Romantic beach getaway", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "Price: ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Mid-range to luxury", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({ text: "Comparison: ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Actively comparing Bali and Maldives", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        bodyText(
          "When she returns tomorrow, the recommendation engine scores all 24 destinations against her profile and surfaces the top 6 \u2014 prioritizing romantic beach destinations in Southeast Asia and South Asia, with geographic diversity enforced.",
          { spaceBefore: 120 }
        ),

        sectionHeading("Built-In Observability"),
        bodyText(
          "A real-time debug panel (accessible via a floating button) provides full pipeline transparency across four tabs:"
        ),
        boldBodyText("Events \u2014 ", "Live stream of every hover (teal), click (coral), and search (purple) with timestamps and dwell durations."),
        boldBodyText("Intents \u2014 ", "Extracted intents with confidence percentages, categories, source event counts, and matched taxonomy tags."),
        boldBodyText("Profile \u2014 ", "Accumulated tag weights across sessions, visualized as ranked bar charts showing the user\u2019s evolving interest profile."),
        boldBodyText("Recommendations \u2014 ", "Scored destination list with match reasons, tag overlap, and diversity filter results."),

        // Page break to page 4
        new Paragraph({ children: [new PageBreak()] }),

        // ==================== PAGE 4: TECH STACK + KEY DESIGN DECISIONS ====================
        sectionHeading("Technology Stack"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2340, 2340, 4680],
          rows: [
            new TableRow({ children: [
              headerCell("Layer", 2340),
              headerCell("Technology", 2340),
              headerCell("Rationale", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Framework", 2340, { bold: true }),
              bodyCell("Vanilla JS (ES6 modules)", 2340),
              bodyCell("Zero dependencies, no build step, runs natively in browser", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Persistence", 2340, { bold: true }),
              bodyCell("Browser localStorage", 2340),
              bodyCell("Cross-session profile retention, no server needed", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Rendering", 2340, { bold: true }),
              bodyCell("DOM + CSS Grid", 2340),
              bodyCell("Responsive layout, accessible HTML5", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Design", 2340, { bold: true }),
              bodyCell("Marriott.com-inspired", 2340),
              bodyCell("DM Sans typography, coral accents, flat editorial cards", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Tracking", 2340, { bold: true }),
              bodyCell("Intersection Observer + DOM events", 2340),
              bodyCell("Native browser APIs, no third-party scripts", 4680),
            ]}),
            new TableRow({ children: [
              bodyCell("Configuration", 2340, { bold: true }),
              bodyCell("Feature toggles module", 2340),
              bodyCell("Runtime control of tracking behavior (e.g., disable views)", 4680),
            ]}),
          ],
        }),

        sectionHeading("Key Design Decisions"),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({ text: "Client-side only \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "All computation runs locally. No backend calls, no data warehouse, no ETL pipeline. Improves latency to zero and eliminates privacy concerns.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Views disabled by default \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Scroll-triggered viewport events are too noisy for reliable intent detection. Hover and click events provide cleaner, more deliberate signals.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Temporal decay (0.8\u00D7 per session) \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "User interests evolve. Recent sessions exponentially outweigh older ones, allowing the profile to drift naturally without manual resets.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Region diversity cap (max 3) \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Prevents recommendation clustering. Even if all top scores are European cities, the user sees variety from other regions.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: "Deduplication by category + tags \u2014 ", bold: true, font: "Arial", size: 20, color: CHARCOAL }),
            new TextRun({ text: "Prevents intent spam from repeated flushes. Only the highest-confidence intent per pattern is retained.", font: "Arial", size: 20, color: CHARCOAL }),
          ],
        }),

        sectionHeading("Scoring Formula"),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            new TableRow({ children: [
              headerCell("Component", 3120),
              headerCell("Formula", 6240),
            ]}),
            new TableRow({ children: [
              bodyCell("Event contribution", 3120, { bold: true }),
              bodyCell("eventTypeWeight \u00D7 recencyMultiplier", 6240),
            ]}),
            new TableRow({ children: [
              bodyCell("Frequency bonus", 3120, { bold: true }),
              bodyCell("log\u2082(interaction_count) for destinations with \u22652 interactions", 6240),
            ]}),
            new TableRow({ children: [
              bodyCell("Cross-session decay", 3120, { bold: true }),
              bodyCell("weight[tag] = \u03A3(intent.confidence \u00D7 0.8 ^ sessionsAgo)", 6240),
            ]}),
            new TableRow({ children: [
              bodyCell("Recommendation score", 3120, { bold: true }),
              bodyCell("score = \u03A3(tagWeights[tag]) / \u221A(destination.tag_count)", 6240),
            ]}),
          ],
        }),

        // Closing
        new Paragraph({ spacing: { before: 480 }, children: [] }),
        coralAccentLine(),
        new Paragraph({
          spacing: { before: 200, after: 80 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: "Wanderlust demonstrates that meaningful personalization doesn\u2019t require a data warehouse, a machine learning pipeline, or sending user data to the cloud. By inferring intent at the edge, we achieve real-time recommendations with zero latency, complete privacy, and full transparency.",
            font: "Arial", size: 20, italics: true, color: MID_GRAY,
          })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120 },
          children: [new TextRun({ text: "Built with vanilla JavaScript \u2022 Zero dependencies \u2022 No backend required", font: "Arial", size: 18, color: CORAL, bold: true })],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = "/Users/bala/Context Tracking at Edge /Wanderlust-Solution-Brief.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Created: " + outPath);
});
