import os
import shutil
import subprocess
import tempfile
from core.config import settings
from core.logger import log_event

def convert_to_pdf(input_path: str, output_pdf_path: str):
    """
    Convert a document (.docx, .doc, .txt, ...) to PDF using headless
    LibreOffice Writer.

    Runs as a subprocess with a hard timeout so a corrupt document can never
    block the ingestion queue. Each job gets an isolated LibreOffice profile
    directory, which avoids profile lock conflicts and leaves no state behind.
    """
    work_dir = tempfile.mkdtemp(prefix="lo-convert-", dir=settings.WORKER_TMP_DIR)
    try:
        profile_dir = os.path.join(work_dir, "profile")
        cmd = [
            settings.LIBREOFFICE_BINARY,
            "--headless",
            f"-env:UserInstallation=file://{profile_dir}",
            "--convert-to", "pdf",
            "--outdir", work_dir,
            input_path,
        ]
        log_event("converter.start", "Starting LibreOffice conversion.", input_path=input_path, timeout_seconds=settings.DOCX_CONVERT_TIMEOUT_SECONDS)

        env = dict(os.environ)
        env["HOME"] = work_dir

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.DOCX_CONVERT_TIMEOUT_SECONDS,
                env=env,
            )
        except subprocess.TimeoutExpired:
            log_event("converter.timeout", "LibreOffice conversion timed out.", level="ERROR", input_path=input_path, timeout_seconds=settings.DOCX_CONVERT_TIMEOUT_SECONDS)
            raise RuntimeError(f"DOCX conversion timed out after {settings.DOCX_CONVERT_TIMEOUT_SECONDS}s")

        if result.returncode != 0:
            log_event("converter.failed", "LibreOffice conversion failed.", level="ERROR", input_path=input_path, returncode=result.returncode, stderr=result.stderr[-2000:])
            raise RuntimeError(f"DOCX conversion failed with exit code {result.returncode}: {result.stderr[-500:]}")

        expected = os.path.join(work_dir, os.path.splitext(os.path.basename(input_path))[0] + ".pdf")
        if not os.path.exists(expected):
            log_event("converter.missing_output", "LibreOffice reported success but produced no PDF.", level="ERROR", input_path=input_path, expected=expected)
            raise RuntimeError("DOCX conversion succeeded but produced no output file")

        os.rename(expected, output_pdf_path)
        log_event("converter.done", "LibreOffice conversion complete.", input_path=input_path, output_path=output_pdf_path)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
