#!/usr/bin/env python3
"""
Embed OCR layer from Document AI into PDF
Uses pypdf to create a proper invisible text layer (Render Mode 3)
"""
import sys
import json
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
import tempfile
import os

def create_text_layer(page_width, page_height, tokens, full_text):
    """
    Create an invisible text layer overlay for one page
    """
    packet = BytesIO()
    c = canvas.Canvas(packet, pagesize=(page_width, page_height))

    # Set text rendering mode to invisible (mode 3)
    c.setFillColorRGB(0, 0, 0, alpha=0)

    for token in tokens:
        try:
            # Get token text
            if 'layout' not in token or 'textAnchor' not in token['layout']:
                continue

            segments = token['layout']['textAnchor'].get('textSegments', [])
            if not segments:
                continue

            segment = segments[0]
            start_idx = int(segment.get('startIndex', 0))
            end_idx = int(segment.get('endIndex', 0))
            token_text = full_text[start_idx:end_idx].replace('\n', '').strip()

            if not token_text:
                continue

            # Get bounding box
            vertices = token['layout'].get('boundingPoly', {}).get('normalizedVertices', [])
            if len(vertices) < 3:
                continue

            # Calculate position and size
            x = vertices[0].get('x', 0) * page_width
            y = page_height - (vertices[0].get('y', 0) * page_height)  # Flip Y
            width = (vertices[2].get('x', 0) - vertices[0].get('x', 0)) * page_width
            height = (vertices[2].get('y', 0) - vertices[0].get('y', 0)) * page_height

            # Calculate font size to fit bounding box
            font_size = max(1, abs(height) * 0.75)

            # Draw invisible text
            text_obj = c.beginText(x, y - abs(height))
            text_obj.setFont("Helvetica", font_size)
            text_obj.setTextRenderMode(3)  # Invisible text (critical!)
            text_obj.textLine(token_text)
            c.drawText(text_obj)

        except Exception as e:
            # Skip problematic tokens
            continue

    c.save()
    packet.seek(0)
    return packet


def embed_ocr_layer(input_pdf_path, docai_json_path, output_pdf_path):
    """
    Embed Document AI OCR data into PDF as invisible text layer
    """
    # Load Document AI result
    with open(docai_json_path, 'r', encoding='utf-8') as f:
        docai_data = json.load(f)

    full_text = docai_data.get('text', '')
    pages_data = docai_data.get('pages', [])

    # Load input PDF
    pdf_reader = PdfReader(input_pdf_path)
    pdf_writer = PdfWriter()

    print(f"Processing {len(pdf_reader.pages)} pages with {len(pages_data)} OCR pages", file=sys.stderr)

    # Process each page
    for page_idx in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_idx]

        # Get page dimensions
        page_box = page.mediabox
        page_width = float(page_box.width)
        page_height = float(page_box.height)

        # Get tokens for this page
        if page_idx < len(pages_data):
            tokens = pages_data[page_idx].get('tokens', [])

            if tokens:
                # Create text layer overlay
                text_layer = create_text_layer(page_width, page_height, tokens, full_text)
                text_layer_pdf = PdfReader(text_layer)

                # Merge text layer onto original page
                page.merge_page(text_layer_pdf.pages[0])

                print(f"Page {page_idx + 1}: Embedded {len(tokens)} tokens", file=sys.stderr)

        pdf_writer.add_page(page)

    # Write output
    with open(output_pdf_path, 'wb') as output_file:
        pdf_writer.write(output_file)

    print(f"OCR layer embedded successfully: {output_pdf_path}", file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: embed-ocr-layer.py <input.pdf> <docai.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    input_pdf = sys.argv[1]
    docai_json = sys.argv[2]
    output_pdf = sys.argv[3]

    try:
        embed_ocr_layer(input_pdf, docai_json, output_pdf)
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
