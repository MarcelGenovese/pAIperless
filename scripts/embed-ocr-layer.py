#!/usr/bin/env python3
"""
Embed OCR layer from Document AI into PDF
Compresses pages as JPEG images (like OLD script) and adds invisible text layer
"""
import sys
import json
import fitz  # PyMuPDF
import io

def embed_ocr_layer(input_pdf_path, docai_json_path, output_pdf_path):
    """
    Embed Document AI OCR data into PDF as invisible text layer
    Compresses pages as JPEG (dpi=200, quality=70) like OLD script
    """
    # Load Document AI result
    with open(docai_json_path, 'r', encoding='utf-8') as f:
        docai_data = json.load(f)

    full_text = docai_data.get('text', '')
    pages_data = docai_data.get('pages', [])

    # Load input PDF
    doc_src = fitz.open(input_pdf_path)
    doc_out = fitz.open()  # New empty PDF

    print(f"Processing {len(doc_src)} pages with {len(pages_data)} OCR pages", file=sys.stderr)

    # Process each page
    for page_idx, page_src in enumerate(doc_src):
        # Render page as compressed JPEG image (like OLD script)
        pix = page_src.get_pixmap(dpi=200)
        img_data = pix.tobytes("jpeg", jpg_quality=70)  # JPEG with 70% quality

        # Create new page with same dimensions
        page_out = doc_out.new_page(width=page_src.rect.width, height=page_src.rect.height)

        # Insert compressed JPEG image
        page_out.insert_image(page_out.rect, stream=img_data)

        pw, ph = page_src.rect.width, page_src.rect.height

        # Add OCR text layer if available
        if page_idx < len(pages_data):
            tokens = pages_data[page_idx].get('tokens', [])
            token_count = 0

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
                    word_text = full_text[start_idx:end_idx].replace('\n', '').strip()

                    if not word_text:
                        continue

                    # Get bounding box (normalized coordinates)
                    vertices = token['layout'].get('boundingPoly', {}).get('normalizedVertices', [])
                    if len(vertices) < 3:
                        continue

                    # Convert normalized coordinates to actual positions
                    v = vertices
                    rect = fitz.Rect(
                        v[0].get('x', 0) * pw,
                        v[0].get('y', 0) * ph,
                        v[2].get('x', 0) * pw,
                        v[2].get('y', 0) * ph
                    )

                    # Calculate font size
                    font_size = rect.height * 0.75

                    # Insert invisible text (render_mode=3)
                    page_out.insert_text(
                        rect.bl,  # Bottom-left position
                        word_text,
                        fontsize=font_size,
                        render_mode=3  # Invisible text
                    )
                    token_count += 1

                except Exception as e:
                    # Skip problematic tokens
                    continue

            if token_count > 0:
                print(f"Page {page_idx + 1}: Embedded {token_count} tokens", file=sys.stderr)

    # Save with compression and garbage collection
    doc_out.save(output_pdf_path, deflate=True, garbage=4)
    doc_out.close()
    doc_src.close()

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
