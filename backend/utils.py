from docx import Document
from PyPDF2 import PdfReader

def extract_text_from_docx(file_path):
    """Extract text from a .docx file."""
    try:
        doc = Document(file_path)
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])
    except Exception as e:
        return f"Error reading .docx file: {e}"

def extract_text_from_pdf(file_path):
    """Extract text from a .pdf file."""
    try:
        reader = PdfReader(file_path)
        return "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
    except Exception as e:
        return f"Error reading .pdf file: {e}"

def extract_text_from_txt(file_path):
    """Extract text from a .txt file."""
    try:
        with open(file_path, 'r') as file:
            return file.read()
    except Exception as e:
        return f"Error reading .txt file: {e}"

def extract_text(file_path):
    """Determine the file type and extract text accordingly."""
    if file_path.endswith('.docx'):
        return extract_text_from_docx(file_path)
    elif file_path.endswith('.pdf'):
        return extract_text_from_pdf(file_path)
    return extract_text_from_txt(file_path)
    

