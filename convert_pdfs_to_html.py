#!/usr/bin/env python3
"""Convert PDF files in mim_manuals folder to HTML with images for easy review."""

import fitz  # PyMuPDF
import os
import base64
from pathlib import Path

def pdf_to_html_with_images(pdf_path: str, output_path: str):
    """Convert a PDF file to HTML with embedded images."""
    doc = fitz.open(pdf_path)
    pdf_name = Path(pdf_path).stem
    
    # Create images directory for this PDF
    images_dir = Path(output_path).parent / f"{pdf_name}_images"
    images_dir.mkdir(exist_ok=True)
    
    html_content = []
    html_content.append("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #1a1a2e;
            color: #eee;
        }}
        h1, h2, h3 {{
            color: #00d4ff;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }}
        .page {{
            background: #16213e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        .page-header {{
            background: #0f3460;
            color: #00d4ff;
            padding: 10px 15px;
            margin: -20px -20px 20px -20px;
            border-radius: 8px 8px 0 0;
            font-weight: bold;
        }}
        .page-content {{
            display: flex;
            flex-direction: column;
            gap: 20px;
        }}
        .page-text {{
            flex: 1;
        }}
        .page-images {{
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #333;
        }}
        .page-image {{
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.2s;
        }}
        .page-image:hover {{
            transform: scale(1.02);
        }}
        .page-image.small {{
            max-width: 300px;
        }}
        .page-image.medium {{
            max-width: 500px;
        }}
        .page-image.large {{
            max-width: 800px;
        }}
        pre {{
            background: #0d1b2a;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #444;
            padding: 10px;
            text-align: left;
        }}
        th {{
            background: #0f3460;
        }}
        .toc {{
            background: #0f3460;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        .toc a {{
            color: #00d4ff;
            text-decoration: none;
        }}
        .toc a:hover {{
            text-decoration: underline;
        }}
        .highlight {{
            background: #e94560;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
        }}
        .note {{
            background: #1a4d2e;
            border-left: 4px solid #4ade80;
            padding: 15px;
            margin: 15px 0;
            border-radius: 0 8px 8px 0;
        }}
        .warning {{
            background: #4a3728;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 15px 0;
            border-radius: 0 8px 8px 0;
        }}
        .image-count {{
            color: #888;
            font-size: 0.9em;
            margin-left: 10px;
        }}
        /* Lightbox for full-size images */
        .lightbox {{
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            cursor: zoom-out;
        }}
        .lightbox.active {{
            display: flex;
        }}
        .lightbox img {{
            max-width: 95%;
            max-height: 95%;
            object-fit: contain;
        }}
        /* Navigation */
        .nav {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0f3460;
            padding: 10px 15px;
            border-radius: 8px;
            z-index: 100;
        }}
        .nav a {{
            color: #00d4ff;
            text-decoration: none;
            margin: 0 10px;
        }}
        .nav a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="nav">
        <a href="#top">↑ Top</a>
        <a href="#" onclick="document.body.scrollTop = document.body.scrollHeight; return false;">↓ Bottom</a>
    </div>
    <h1 id="top">{title}</h1>
    <p><strong>Source:</strong> {filename}</p>
    <p><strong>Pages:</strong> {page_count}</p>
    <p><strong>Total Images:</strong> <span id="total-images">calculating...</span></p>
    <hr>
    
    <!-- Lightbox for full-size images -->
    <div class="lightbox" onclick="this.classList.remove('active')">
        <img id="lightbox-img" src="" alt="Full size image">
    </div>
    
    <script>
        function showLightbox(src) {{
            document.getElementById('lightbox-img').src = src;
            document.querySelector('.lightbox').classList.add('active');
        }}
        
        // Count total images after page load
        window.onload = function() {{
            var imgCount = document.querySelectorAll('.page-image').length;
            document.getElementById('total-images').textContent = imgCount;
        }};
    </script>
""".format(
        title=Path(pdf_path).stem,
        filename=Path(pdf_path).name,
        page_count=len(doc)
    ))
    
    total_images = 0
    
    # Process each page
    for page_num, page in enumerate(doc, 1):
        text = page.get_text("text").strip()
        
        # Extract images from the page
        image_list = page.get_images(full=True)
        page_images = []
        
        for img_index, img_info in enumerate(image_list):
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if base_image:
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    # Save image to file
                    img_filename = f"page{page_num}_img{img_index + 1}.{image_ext}"
                    img_path = images_dir / img_filename
                    
                    with open(img_path, "wb") as img_file:
                        img_file.write(image_bytes)
                    
                    # Also create base64 for inline embedding (fallback)
                    img_base64 = base64.b64encode(image_bytes).decode('utf-8')
                    mime_type = f"image/{image_ext}"
                    if image_ext == "jpg":
                        mime_type = "image/jpeg"
                    
                    # Determine image size class based on dimensions
                    width = base_image.get("width", 0)
                    height = base_image.get("height", 0)
                    
                    size_class = "medium"
                    if width < 200 and height < 200:
                        size_class = "small"
                    elif width > 600 or height > 600:
                        size_class = "large"
                    
                    page_images.append({
                        "path": f"{pdf_name}_images/{img_filename}",
                        "base64": f"data:{mime_type};base64,{img_base64}",
                        "size_class": size_class,
                        "width": width,
                        "height": height
                    })
                    total_images += 1
            except Exception as e:
                print(f"  Warning: Could not extract image {img_index + 1} from page {page_num}: {e}")
        
        # Skip empty pages
        if not text and not page_images:
            continue
        
        html_content.append(f'    <div class="page" id="page-{page_num}">')
        html_content.append(f'        <div class="page-header">Page {page_num} of {len(doc)}<span class="image-count">({len(page_images)} images)</span></div>')
        html_content.append('        <div class="page-content">')
        
        # Add text content
        if text:
            html_content.append('            <div class="page-text">')
            paragraphs = text.split('\n\n')
            for para in paragraphs:
                para = para.strip()
                if para:
                    # Escape HTML characters
                    para = para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    # Preserve line breaks within paragraphs
                    para = para.replace('\n', '<br>\n')
                    html_content.append(f'                <p>{para}</p>')
            html_content.append('            </div>')
        
        # Add images
        if page_images:
            html_content.append('            <div class="page-images">')
            for img in page_images:
                # Use relative path, fall back to base64 if needed
                html_content.append(f'''                <img 
                    class="page-image {img['size_class']}" 
                    src="{img['path']}" 
                    onerror="this.src='{img['base64']}'"
                    onclick="showLightbox(this.src)"
                    alt="Page {page_num} image"
                    title="Click to enlarge ({img['width']}x{img['height']})"
                >''')
            html_content.append('            </div>')
        
        html_content.append('        </div>')
        html_content.append('    </div>')
    
    html_content.append("""
</body>
</html>
""")
    
    doc.close()
    
    # Write HTML file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(html_content))
    
    print(f"✅ Converted: {Path(pdf_path).name}")
    print(f"   → {Path(output_path).name} ({total_images} images extracted)")

def main():
    mim_folder = Path("/Users/joshua/Documents/CONVERGE_REPLIT_VIEWER/mim_manuals")
    
    if not mim_folder.exists():
        print(f"❌ Folder not found: {mim_folder}")
        return
    
    pdf_files = list(mim_folder.glob("*.pdf"))
    
    if not pdf_files:
        print("❌ No PDF files found in mim_manuals folder")
        return
    
    print(f"📚 Found {len(pdf_files)} PDF files to convert\n")
    
    for pdf_path in pdf_files:
        html_path = pdf_path.with_suffix('.html')
        try:
            pdf_to_html_with_images(str(pdf_path), str(html_path))
        except Exception as e:
            print(f"❌ Error converting {pdf_path.name}: {e}")
    
    print(f"\n✨ Conversion complete!")
    print(f"📁 HTML files and images saved to: {mim_folder}")

if __name__ == "__main__":
    main()
