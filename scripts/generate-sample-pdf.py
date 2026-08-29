from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "sample" / "trangngu-sample-original.pdf"
PAGE_WIDTH = 612
PAGE_HEIGHT = 792

INK = HexColor("#1D2B25")
GREEN = HexColor("#1F5A44")
GREEN_DARK = HexColor("#164533")
GREEN_SOFT = HexColor("#DDEBE2")
PAPER = HexColor("#FFFDF6")
CANVAS = HexColor("#F3EFE3")
MUTED = HexColor("#65716A")
AMBER = HexColor("#E9B84C")
AMBER_SOFT = HexColor("#FFF0CE")
BLUE = HexColor("#4C88A5")
BLUE_SOFT = HexColor("#E5F0F4")
LINE = HexColor("#D5D6CC")


def rounded_box(pdf, x, y, width, height, fill, stroke=LINE, radius=12):
    pdf.setFillColor(fill)
    pdf.setStrokeColor(stroke)
    pdf.setLineWidth(0.8)
    pdf.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def label(pdf, text, x, y, color=GREEN):
    pdf.setFillColor(color)
    pdf.setFont("Helvetica-Bold", 7.5)
    pdf.drawString(x, y, text.upper())


def wrapped_text(pdf, text, x, y, width, font="Helvetica", size=9.2, leading=13, color=INK):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if pdf.stringWidth(candidate, font, size) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    pdf.setFillColor(color)
    pdf.setFont(font, size)
    for index, line in enumerate(lines):
        pdf.drawString(x, y - index * leading, line)
    return y - len(lines) * leading


def checklist_item(pdf, number, title, body, x, y, width, accent):
    pdf.setFillColor(accent)
    pdf.circle(x + 13, y - 3, 13, fill=1, stroke=0)
    pdf.setFillColor(white)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(x + 13, y - 6.5, str(number))
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10.4)
    pdf.drawString(x + 35, y + 1, title)
    wrapped_text(pdf, body, x + 35, y - 14, width - 35, size=8.1, leading=11, color=MUTED)


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=(PAGE_WIDTH, PAGE_HEIGHT), pageCompression=1)
    pdf.setTitle("TrangNgu Sample - Flood Ready")
    pdf.setAuthor("TrangNgu contributors")
    pdf.setSubject("Rights-safe sample input for layout-preserving PDF translation")

    pdf.setFillColor(CANVAS)
    pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)

    # Header
    pdf.setFillColor(GREEN_DARK)
    pdf.rect(0, 622, PAGE_WIDTH, 170, fill=1, stroke=0)
    pdf.setFillColor(AMBER)
    pdf.roundRect(44, 750, 126, 22, 11, fill=1, stroke=0)
    pdf.setFillColor(GREEN_DARK)
    pdf.setFont("Helvetica-Bold", 7.4)
    pdf.drawCentredString(107, 757, "COMMUNITY QUICK GUIDE")
    rounded_box(pdf, 34, 642, 374, 92, PAPER, stroke=PAPER, radius=13)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 29)
    pdf.drawString(50, 690, "FLOOD READY")
    pdf.setFont("Helvetica", 10.5)
    pdf.drawString(51, 666, "Three calm steps before the water rises")

    # Header illustration: river, house, rain
    pdf.setFillColor(BLUE)
    pdf.circle(503, 692, 62, fill=1, stroke=0)
    pdf.setFillColor(BLUE_SOFT)
    pdf.rect(451, 660, 104, 29, fill=1, stroke=0)
    pdf.setFillColor(PAPER)
    pdf.rect(475, 687, 54, 37, fill=1, stroke=0)
    pdf.setFillColor(AMBER)
    roof = pdf.beginPath()
    roof.moveTo(468, 722)
    roof.lineTo(502, 744)
    roof.lineTo(536, 722)
    roof.close()
    pdf.drawPath(roof, fill=1, stroke=0)
    pdf.setStrokeColor(white)
    pdf.setLineWidth(2)
    for x in (457, 476, 545):
        pdf.line(x, 746, x - 6, 735)

    # Intro strip
    rounded_box(pdf, 34, 574, 544, 62, PAPER, stroke=LINE, radius=12)
    label(pdf, "Use this page", 52, 612)
    wrapped_text(pdf, "Share one simple plan with your household. Keep it visible, review it together, and follow official local alerts.", 52, 594, 490, size=9.2, leading=12)

    # Two main columns
    column_width = 262
    rounded_box(pdf, 34, 300, column_width, 252, PAPER, stroke=LINE, radius=13)
    rounded_box(pdf, 316, 300, column_width, 252, PAPER, stroke=LINE, radius=13)

    pdf.setFillColor(GREEN_SOFT)
    pdf.roundRect(50, 504, 38, 30, 9, fill=1, stroke=0)
    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(69, 514, "01")
    label(pdf, "Before the rain", 100, 523)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 17)
    pdf.drawString(50, 476, "Pack, plan, protect")
    checklist_item(pdf, 1, "Pack essentials", "Water, medicine, torch, radio, chargers, and copies of key documents.", 50, 438, 224, GREEN)
    checklist_item(pdf, 2, "Choose two routes", "Plan a main exit and a backup route to higher ground.", 50, 376, 224, GREEN)
    checklist_item(pdf, 3, "Protect documents", "Seal important papers in a waterproof bag you can carry.", 50, 330, 224, GREEN)

    pdf.setFillColor(AMBER_SOFT)
    pdf.roundRect(332, 504, 38, 30, 9, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#855A0A"))
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawCentredString(351, 514, "02")
    label(pdf, "When water rises", 382, 523, HexColor("#855A0A"))
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 17)
    pdf.drawString(332, 476, "Move early, stay informed")
    checklist_item(pdf, 1, "Follow official alerts", "Use trusted local channels. Do not rely on forwarded rumors.", 332, 438, 224, HexColor("#B67716"))
    checklist_item(pdf, 2, "Avoid moving water", "Never walk, cycle, or drive through floodwater.", 332, 376, 224, HexColor("#B67716"))
    checklist_item(pdf, 3, "Help safely", "Check on neighbors only when doing so does not put you at risk.", 332, 330, 224, HexColor("#B67716"))

    # Balanced bottom cards continue the same two-column grid.
    rounded_box(pdf, 34, 122, 262, 156, GREEN_SOFT, stroke=HexColor("#BFD2C5"), radius=13)
    pdf.setFillColor(AMBER)
    pdf.circle(67, 238, 17, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13.5)
    pdf.drawString(94, 236, "Household meeting point")
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(MUTED)
    pdf.drawString(52, 205, "Primary location")
    pdf.drawString(52, 164, "Backup location")
    pdf.setStrokeColor(HexColor("#88A596"))
    pdf.setLineWidth(0.8)
    pdf.line(52, 191, 278, 191)
    pdf.line(52, 150, 278, 150)

    rounded_box(pdf, 316, 122, 262, 156, BLUE_SOFT, stroke=HexColor("#BDD2DB"), radius=13)
    label(pdf, "Remember", 334, 244, BLUE)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(334, 217, "Go to high ground")
    wrapped_text(pdf, "If officials ask you to leave, take your emergency bag and move before routes become unsafe.", 334, 197, 224, size=8.5, leading=11.5, color=MUTED)
    pdf.setStrokeColor(BLUE)
    pdf.setLineWidth(2)
    pdf.line(338, 145, 376, 165)
    pdf.line(376, 165, 407, 151)
    pdf.line(407, 151, 452, 187)
    pdf.line(452, 187, 485, 169)
    pdf.line(485, 169, 546, 202)
    pdf.setFillColor(BLUE)
    pdf.circle(546, 202, 4, fill=1, stroke=0)

    # Footer
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7.2)
    pdf.drawString(34, 82, "SAMPLE DOCUMENT - CREATED FOR TRANGNGU - NO PERSONAL DATA")
    pdf.setFillColor(GREEN)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawRightString(578, 82, "SOURCE SAMPLE / ENGLISH")
    pdf.setStrokeColor(LINE)
    pdf.line(34, 100, 578, 100)
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 6.8)
    pdf.drawString(34, 60, "For demonstration only. In an emergency, follow current guidance from local authorities.")

    pdf.showPage()
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
