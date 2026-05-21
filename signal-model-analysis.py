#!/usr/bin/env python3
"""Generate PDF from Signal Model Analysis markdown."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)

ACCENT = HexColor('#ff8d6b')
DARK = HexColor('#1c1c1c')
MUTED = HexColor('#666666')
GREEN = HexColor('#10b981')
RED = HexColor('#ef4444')
BLUE = HexColor('#3b82f6')
PURPLE = HexColor('#8b5cf6')
BG_LIGHT = HexColor('#f8f8f8')
WHITE = HexColor('#ffffff')

def build_pdf():
    doc = SimpleDocTemplate(
        "/Users/bala/IntentTracker/Signal_Model_Analysis.pdf",
        pagesize=letter,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        topMargin=0.6*inch, bottomMargin=0.6*inch
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'],
        fontSize=22, textColor=DARK, spaceAfter=4, fontName='Helvetica-Bold')
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'],
        fontSize=11, textColor=MUTED, spaceAfter=20)
    h1 = ParagraphStyle('H1', parent=styles['Heading1'],
        fontSize=16, textColor=ACCENT, spaceBefore=20, spaceAfter=8, fontName='Helvetica-Bold')
    h2 = ParagraphStyle('H2', parent=styles['Heading2'],
        fontSize=13, textColor=DARK, spaceBefore=14, spaceAfter=6, fontName='Helvetica-Bold')
    h3 = ParagraphStyle('H3', parent=styles['Heading3'],
        fontSize=11, textColor=DARK, spaceBefore=10, spaceAfter=4, fontName='Helvetica-Bold')
    body = ParagraphStyle('Body', parent=styles['Normal'],
        fontSize=9.5, leading=14, textColor=DARK, spaceAfter=6)
    body_bold = ParagraphStyle('BodyBold', parent=body, fontName='Helvetica-Bold')
    code_style = ParagraphStyle('Code', parent=styles['Normal'],
        fontSize=8.5, fontName='Courier', textColor=HexColor('#333333'),
        backColor=BG_LIGHT, leftIndent=12, spaceAfter=8, leading=12,
        borderPadding=(4, 4, 4, 4))
    bullet = ParagraphStyle('Bullet', parent=body, leftIndent=18, bulletIndent=6,
        spaceAfter=3)
    ref_style = ParagraphStyle('Ref', parent=styles['Normal'],
        fontSize=8, leading=11, textColor=BLUE, leftIndent=12, spaceAfter=2)

    story = []

    # --- TITLE ---
    story.append(Paragraph("Signal Model Analysis", title_style))
    story.append(Paragraph("Industry Benchmarking &amp; Improvement Roadmap", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceAfter=12))
    story.append(Paragraph(
        "Analysis of our current event-tracking to signal-summarization to recommendation pipeline "
        "against industry research and best practices. Goal: validate the model's merits, identify gaps, "
        "and design both an initial tuning framework and ongoing optimization strategy.", body))
    story.append(Spacer(1, 12))

    # ==================== PART 1 ====================
    story.append(Paragraph("Part 1: What the Industry Tracks", h1))
    story.append(Paragraph("Event Taxonomy (standard implicit signals)", h2))

    event_data = [
        ['Signal Type', 'Weight Class', 'Industry Tools', 'Our Coverage'],
        ['Page view', 'Passive', 'GA4, Amplitude, Mixpanel, Segment', 'Yes (page_view)'],
        ['Scroll depth (25/50/75/90%)', 'Passive', 'GA4 (90%), Hotjar, FullStory', 'No'],
        ['Element visibility / dwell', 'Passive', 'Contentsquare, Mouseflow', 'Yes (view, 800ms+)'],
        ['Hover / mouseover dwell', 'Passive', 'Mouseflow, custom', 'Yes (hover, 1000ms+)'],
        ['Click', 'Active', 'All platforms', 'Yes (click)'],
        ['Search query', 'Active (explicit)', 'Algolia, GA4 site search', 'Yes (search)'],
        ['Tab/filter selection', 'Active', 'Custom builds', 'Yes (tab_view)'],
        ['Add to cart / wishlist', 'Active (high)', 'Shopify, GA4 ecommerce', 'No'],
        ['Form interaction', 'Active', 'Hotjar, FullStory', 'No'],
        ['Scroll velocity / rage clicks', 'Frustration', 'FullStory, LogRocket', 'No'],
        ['Session duration', 'Aggregate', 'GA4, Amplitude', 'No (implicit)'],
        ['Return visit frequency', 'Loyalty', 'Amplitude, Mixpanel', 'Partial'],
        ['Exit / bounce', 'Negative', 'GA4', 'No'],
    ]
    t = Table(event_data, colWidths=[1.7*inch, 1*inch, 2.2*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Research-Backed Weight Hierarchies", h2))
    story.append(Paragraph("<b>Industry consensus weight ordering:</b>", body))
    story.append(Paragraph("purchase (10x) &gt; add-to-cart (5x) &gt; click (3x) &gt; hover/dwell (1.5-2x) &gt; view (1x) &gt; impression (0.5x)", code_style))
    story.append(Paragraph("<b>Our current weights:</b>", body))
    story.append(Paragraph("click_group (3x) &gt; click_tag (2x) &gt; hover_group/tab_group (2x) &gt; hover_tag/tab_tag (1.5x) &gt; view (1x)", code_style))
    story.append(Paragraph(
        "<b>Assessment:</b> Our click and hover weights are within the industry range. "
        "The tag vs group distinction (click_tag=2 vs click_group=3) is a unique design choice "
        "not commonly seen in industry.", body))

    # ==================== PART 2 ====================
    story.append(PageBreak())
    story.append(Paragraph("Part 2: Current Model — Strengths", h1))

    strengths = [
        ("<b>Recency weighting</b> — <font face='Courier' size=8>0.5 + 0.5 * age</font> is a reasonable linear recency function. "
         "Research supports recency as one of the strongest predictors (Xie et al. 2022)."),
        ("<b>Frequency bonus</b> — <font face='Courier' size=8>log2(count)</font> is a sound sub-linear scaling choice. "
         "Prevents power users from overwhelming the model. Aligns with TF-IDF log-dampening."),
        ("<b>Cross-session exponential decay</b> — <font face='Courier' size=8>0.8<super>sessionsAgo</super></font> "
         "correctly models the forgetting curve. Research shows exponential decay outperforms linear."),
        ("<b>Hover-as-signal</b> — Tracking hover dwell aligns with research showing dwell time is a "
         "positive correlate of explicit ratings (Springer 2014)."),
        ("<b>Score normalization</b> — <font face='Courier' size=8>score / sqrt(tags.length)</font> prevents "
         "multi-tagged items from dominating. Similar to cosine normalization in TF-IDF systems."),
        ("<b>Diversity filter</b> — <font face='Courier' size=8>maxPerGroup = 3</font> prevents recommendation "
         "homogeneity, a known problem in content-based systems."),
        ("<b>Client-side, zero-backend</b> — Privacy-preserving by design. Aligns with 2025-2026 "
         "privacy-first analytics trends (Consent Mode v2, cookieless tracking)."),
    ]
    for i, s in enumerate(strengths, 1):
        story.append(Paragraph(f"{i}. {s}", bullet))

    # ==================== PART 3 ====================
    story.append(Spacer(1, 8))
    story.append(Paragraph("Part 3: Current Model — Gaps &amp; Improvements", h1))

    # --- A. Event Capture ---
    story.append(Paragraph("A. Event Capture Gaps", h2))
    cap_data = [
        ['Gap', 'Impact', 'Recommendation'],
        ['No scroll depth tracking', 'Missing key engagement signal', 'Add IntersectionObserver sentinels at 25/50/75/100%'],
        ['No negative signals', "Can't distinguish rejection from non-exposure", 'Track "viewed but not clicked" as weak negative'],
        ['No dwell-weighted views', '1s view = 30s view', 'Weight: min(dwellMs / 5000, 2.0)'],
        ['View events ignored in scoring', 'Views carry no tags in summarizer', 'Ensure view events carry item tags'],
    ]
    t = Table(cap_data, colWidths=[1.6*inch, 1.8*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # --- B. Weighting ---
    story.append(Paragraph("B. Weighting Model Improvements", h2))
    wt_data = [
        ['Current', 'Problem', 'Improvement'],
        ['Hardcoded weights', "Can't tune without code changes", 'Make configurable via create() options'],
        ['Tag vs group distinction', 'Unusual split not seen in industry', 'Simplify: weight by event type only'],
        ['Linear recency (0.5+0.5*age)', "Doesn't match research", 'Exponential: 0.3 + 0.7 * age^2'],
        ['Frequency: click/hover only', 'Views never get bonus', 'Include views at 0.5x weight'],
        ['Search: always 0.9 confidence', 'Vague = specific', 'Scale by query word count'],
        ['Comparison: always 0.85', '2 or 3 clicks identical', 'Scale: 0.7 + 0.15 * uniqueClicks'],
    ]
    t = Table(wt_data, colWidths=[1.8*inch, 1.8*inch, 2.8*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # --- C. Decay ---
    story.append(Paragraph("C. Decay Model Improvements", h2))
    decay_data = [
        ['Current', 'Problem', 'Improvement'],
        ['Within-session: 0.8/flush', 'Decays to 0.33 after 30s idle', 'Time-based: 0.8^(minutes/5)'],
        ['Cross-session: 0.8^count', '1hr vs 2wk gap = same decay', 'Time-based: 0.8^(days/3)'],
        ['No session cap', 'Profile grows unbounded', 'Prune >30 days or cap at 20'],
        ['No intent expiry', 'Inactive intents persist forever', 'Delete after 3+ sessions inactive'],
    ]
    t = Table(decay_data, colWidths=[1.8*inch, 1.8*inch, 2.8*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t)
    story.append(Spacer(1, 8))

    # --- D. Pattern Detection ---
    story.append(Paragraph("D. Pattern Detection Improvements", h2))
    pat_items = [
        "<b>Only 6 signal categories</b> — Missing: browsing momentum, deep dive, return interest, fading interest",
        "<b>Group interest needs 3+ events</b> — Cold start problem. Lower to 2 for first session",
        "<b>Tag affinity 35% threshold</b> — Broad browsers never trigger it. Add diverse exploration signal",
        "<b>Hover interest: same group only</b> — Cross-group hover patterns invisible. Detect by shared tags",
        "<b>No abandoned interest</b> — After 2+ sessions without re-engagement, emit fading interest signal",
    ]
    for item in pat_items:
        story.append(Paragraph(f"&bull; {item}", bullet))

    # --- E. Rec Engine ---
    story.append(Paragraph("E. Recommendation Engine Improvements", h2))
    rec_items = [
        "<b>No IDF weighting</b> — Common tags (beach on 20/24 items) are non-discriminative. Apply: weight * log(totalItems / itemsWithTag)",
        "<b>No negative scoring</b> — Items viewed but never clicked across sessions should be penalized",
        "<b>Reason string: top tag only</b> — Show top 2-3 matched tags for richer explanations",
        "<b>No serendipity/exploration</b> — Filter bubble risk. Reserve 1-2 of 6 slots for exploration",
        "<b>Cold start is abrupt</b> — Show popularity-based defaults until 3+ events accumulate",
    ]
    for item in rec_items:
        story.append(Paragraph(f"&bull; {item}", bullet))

    # ==================== PART 4 ====================
    story.append(PageBreak())
    story.append(Paragraph("Part 4: Tuning Framework", h1))

    story.append(Paragraph("Phase 1 — Make the Model Configurable", h2))
    story.append(Paragraph("Extract all hardcoded constants into a modelConfig object:", body))
    config_code = (
        "modelConfig: {\n"
        "  weights: { click: 3, hover: 2, view: 1, search: 2.5, tab_view: 1.5 },\n"
        "  recency: { min: 0.3, max: 1.0, curve: 'exponential' },\n"
        "  frequency: { minCount: 2, formula: 'log2' },\n"
        "  decay: { withinSession: 0.8, crossSession: 0.8, method: 'time-based' },\n"
        "  thresholds: { groupInterestMin: 3, tagAffinityPct: 0.35 },\n"
        "  recommendations: { maxResults: 6, maxPerGroup: 3, idfWeighting: true }\n"
        "}"
    )
    story.append(Paragraph(config_code.replace('\n', '<br/>'), code_style))

    story.append(Paragraph("Phase 2 — Add Instrumentation", h2))
    phase2 = [
        "Log signal-to-recommendation pipeline for each rec shown",
        "Track recommendation click-through rate (CTR) as positive feedback",
        "Tag each profile with the modelConfig version that produced it",
    ]
    for item in phase2:
        story.append(Paragraph(f"&bull; {item}", bullet))

    story.append(Paragraph("Phase 3 — Iterative Tuning Loop", h2))
    phase3 = [
        "<b>Baseline:</b> Run current model, measure rec CTR over N sessions",
        "<b>Weight sweep:</b> Try click=2/3/4, hover=1/1.5/2/3, measure CTR delta",
        "<b>Decay sweep:</b> Try 0.7/0.8/0.9 session decay, measure staleness vs freshness",
        "<b>Threshold sweep:</b> Try tagAffinity 25%/35%/50%, measure signal diversity",
        "<b>Compare:</b> Use debug panel or metrics page to visualize A vs B",
    ]
    for item in phase3:
        story.append(Paragraph(f"&bull; {item}", bullet))

    # ==================== PART 5 ====================
    story.append(Spacer(1, 10))
    story.append(Paragraph("Part 5: Priority Ranking", h1))

    pri_data = [
        ['Priority', 'Improvement', 'Effort', 'Impact'],
        ['P0', 'Make weights/thresholds configurable', 'Medium', 'High — enables all tuning'],
        ['P0', 'Add IDF weighting to rec scoring', 'Low', 'High — discriminative tags'],
        ['P1', 'Time-based cross-session decay', 'Low', 'Medium — accurate modeling'],
        ['P1', 'Dwell-weighted view scoring', 'Low', 'Medium — graduated signal'],
        ['P1', 'Cold start fallback (popularity)', 'Low', 'High — first-visit UX'],
        ['P2', 'Scroll depth tracking', 'Medium', 'Medium — richer picture'],
        ['P2', 'Negative signals (view-not-click)', 'Medium', 'Medium — reduces bad recs'],
        ['P2', 'Exploration slots in recs', 'Low', 'Medium — reduces filter bubble'],
        ['P3', 'Search confidence by specificity', 'Low', 'Low — marginal'],
        ['P3', 'Session pruning (cap/expire)', 'Low', 'Low — storage hygiene'],
        ['P3', 'Rec CTR tracking for tuning', 'Medium', 'High (long-term)'],
    ]
    t = Table(pri_data, colWidths=[0.6*inch, 2.6*inch, 0.8*inch, 2.4*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#dddddd')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [WHITE, BG_LIGHT]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        # Color P0 rows
        ('TEXTCOLOR', (0, 1), (0, 2), RED),
        ('FONTNAME', (0, 1), (0, 2), 'Helvetica-Bold'),
        # P1
        ('TEXTCOLOR', (0, 3), (0, 5), ACCENT),
        ('FONTNAME', (0, 3), (0, 5), 'Helvetica-Bold'),
        # P2
        ('TEXTCOLOR', (0, 6), (0, 8), BLUE),
        ('FONTNAME', (0, 6), (0, 8), 'Helvetica-Bold'),
        # P3
        ('TEXTCOLOR', (0, 9), (0, 11), MUTED),
        ('FONTNAME', (0, 9), (0, 11), 'Helvetica-Bold'),
    ]))
    story.append(t)

    # ==================== REFERENCES ====================
    story.append(Spacer(1, 16))
    story.append(Paragraph("References", h1))

    refs = [
        "Hu et al. — Collaborative Filtering for Implicit Feedback Datasets (IEEE 2008)",
        "Yi et al. — Beyond Clicks: Dwell Time for Personalization (RecSys 2014)",
        "Xie et al. — Reweighting Clicks with Dwell Time in Recommendation (2022)",
        "Implicit Predictive Indicators: Mouse Activity and Dwell Time (Springer 2014)",
        "Beyond Explicit and Implicit: How Users Provide Feedback (2025)",
        "GA4 User Engagement Metrics — Root and Branch Group",
        "GA4 Scroll Depth Tracking — AnalyticsMania",
        "Contentsquare — Web Analytics Metrics to Track",
        "Mouseflow — User Behavior Analysis Guide",
        "Product Engagement Score — Blitzllama",
        "Customer Engagement Score — Lifesight",
        "Content-Based Recommendations — TF-IDF and Cosine Similarity",
        "Top 7 Analytics Best Practices for 2026 — Trackingplan",
        "An Overview of CF Algorithms for Implicit Feedback — Andreas Bloch",
    ]
    for r in refs:
        story.append(Paragraph(f"&bull; {r}", ref_style))

    doc.build(story)
    print("PDF generated: /Users/bala/IntentTracker/Signal_Model_Analysis.pdf")

if __name__ == '__main__':
    build_pdf()
