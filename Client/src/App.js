import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:5000";

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isImage(mimeType) {
  return mimeType && mimeType.startsWith("image/");
}

function FileIcon({ mimeType }) {
  if (isImage(mimeType)) return <span className="file-icon img-icon">🖼</span>;
  if (mimeType?.includes("pdf")) return <span className="file-icon pdf-icon">📄</span>;
  if (mimeType?.includes("text")) return <span className="file-icon txt-icon">📝</span>;
  return <span className="file-icon doc-icon">📁</span>;
}

function LightboxModal({ file, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!file) return null;
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>✕</button>
        <div className="lightbox-header">
          <span className="lightbox-name">{file.originalName}</span>
          <span className="lightbox-meta">{formatBytes(file.size)} · {formatDate(file.uploadedAt)}</span>
        </div>
        {isImage(file.mimeType) ? (
          <img src={`${API}${file.url}`} alt={file.originalName} className="lightbox-img" />
        ) : (
          <div className="lightbox-nopreview">
            <FileIcon mimeType={file.mimeType} />
            <p>No preview available</p>
            <a href={`${API}${file.url}`} target="_blank" rel="noreferrer" className="download-btn">
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/files`);
      const data = await res.json();
      setFiles(data);
    } catch {
      showToast("Failed to load files", "error");
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress with XHR
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(JSON.parse(xhr.responseText).error));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("POST", `${API}/api/upload`);
        xhr.send(formData);
      });
      showToast(`"${file.name}" uploaded successfully!`);
      await fetchFiles();
    } catch (err) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelectedFile(file); }
  };

  const handleDelete = async (id, name) => {
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      showToast(`"${name}" deleted`);
      setFiles((prev) => prev.filter((f) => f._id !== id));
    } catch {
      showToast("Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="app">
      <div className="bg-grid" />

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">FileVault</span>
          </div>
          <div className="header-meta">
            <span className="file-count">{files.length} files stored</span>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Upload Zone */}
        <section className="upload-section">
          <div
            className={`drop-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*,.pdf,.txt,.doc,.docx"
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />
            <div className="drop-icon">{dragOver ? "⬇" : "⊕"}</div>
            <div className="drop-text">
              {dragOver ? "Release to upload" : "Drop file here or click to browse"}
            </div>
            <div className="drop-hint">Images, PDF, TXT, DOC · Max 10MB</div>
          </div>

          {/* Selected file preview before upload */}
          {selectedFile && !uploading && (
            <div className="pre-upload">
              <div className="pre-upload-info">
                <FileIcon mimeType={selectedFile.type} />
                <div>
                  <div className="pre-name">{selectedFile.name}</div>
                  <div className="pre-size">{formatBytes(selectedFile.size)}</div>
                </div>
              </div>
              <div className="pre-actions">
                <button className="btn-upload" onClick={() => uploadFile(selectedFile)}>
                  Upload ↑
                </button>
                <button className="btn-cancel" onClick={() => { setSelectedFile(null); fileInputRef.current.value = ""; }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="progress-wrap">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="progress-text">Uploading… {uploadProgress}%</span>
            </div>
          )}
        </section>

        {/* File List */}
        <section className="list-section">
          <div className="list-header">
            <h2 className="list-title">Stored Files</h2>
            <span className="list-badge">{files.length}</span>
          </div>

          {files.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◫</div>
              <p>No files yet. Upload something!</p>
            </div>
          ) : (
            <div className="file-grid">
              {files.map((file) => (
                <div key={file._id} className="file-card">
                  {/* Thumbnail */}
                  <div className="card-thumb" onClick={() => setPreviewFile(file)}>
                    {isImage(file.mimeType) ? (
                      <img src={`${API}${file.url}`} alt={file.originalName} className="thumb-img" />
                    ) : (
                      <div className="thumb-placeholder">
                        <FileIcon mimeType={file.mimeType} />
                      </div>
                    )}
                    <div className="thumb-overlay">
                      <span className="preview-hint">{isImage(file.mimeType) ? "Preview" : "Details"}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="card-body">
                    <div className="card-name" title={file.originalName}>{file.originalName}</div>
                    <div className="card-meta">
                      <span className="badge-mime">{file.mimeType?.split("/")[1]?.toUpperCase() || "FILE"}</span>
                      <span className="card-size">{formatBytes(file.size)}</span>
                    </div>
                    <div className="card-date">{formatDate(file.uploadedAt)}</div>
                  </div>

                  {/* Actions */}
                  <div className="card-actions">
                    <a href={`${API}${file.url}`} target="_blank" rel="noreferrer" className="btn-view">
                      Open
                    </a>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(file._id, file.originalName)}
                      disabled={deleting === file._id}
                    >
                      {deleting === file._id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Lightbox */}
      {previewFile && <LightboxModal file={previewFile} onClose={() => setPreviewFile(null)} />}

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span> {toast.msg}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0a0a0f;
          --surface: #111118;
          --card: #16161e;
          --border: rgba(255,255,255,0.08);
          --border-hover: rgba(255,255,255,0.18);
          --accent: #7c6aff;
          --accent2: #ff6a9e;
          --text: #e8e8f0;
          --muted: #666680;
          --success: #4ade80;
          --error: #f87171;
          --radius: 14px;
        }

        body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; }

        .app { min-height: 100vh; position: relative; overflow-x: hidden; }

        .bg-grid {
          position: fixed; inset: 0; z-index: 0;
          background-image: 
            linear-gradient(rgba(124,106,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(124,106,255,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .header {
          position: sticky; top: 0; z-index: 100;
          background: rgba(10,10,15,0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }
        .header-inner {
          max-width: 960px; margin: 0 auto;
          padding: 18px 24px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon { font-size: 22px; color: var(--accent); }
        .logo-text { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
        .file-count {
          font-family: 'DM Mono', monospace;
          font-size: 12px; color: var(--muted);
          background: rgba(255,255,255,0.05);
          padding: 4px 10px; border-radius: 20px;
          border: 1px solid var(--border);
        }

        .main { max-width: 960px; margin: 0 auto; padding: 40px 24px; position: relative; z-index: 1; }

        /* Upload Section */
        .upload-section { margin-bottom: 48px; }

        .drop-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius);
          padding: 56px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
          background: var(--surface);
          position: relative; overflow: hidden;
        }
        .drop-zone::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(124,106,255,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .drop-zone:hover, .drop-zone.drag-over {
          border-color: var(--accent);
          background: rgba(124,106,255,0.06);
          transform: translateY(-2px);
        }
        .drop-zone.uploading { pointer-events: none; opacity: 0.7; }

        .drop-icon {
          font-size: 48px; margin-bottom: 16px;
          color: var(--accent);
          transition: transform 0.2s;
        }
        .drop-zone:hover .drop-icon { transform: scale(1.15); }
        .drop-text { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
        .drop-hint { font-size: 13px; color: var(--muted); font-family: 'DM Mono', monospace; }

        /* Pre-upload */
        .pre-upload {
          margin-top: 16px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px 20px;
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px;
          animation: slideIn 0.25s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pre-upload-info { display: flex; align-items: center; gap: 12px; }
        .file-icon { font-size: 28px; }
        .pre-name { font-weight: 600; font-size: 14px; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pre-size { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
        .pre-actions { display: flex; gap: 10px; flex-shrink: 0; }

        .btn-upload {
          background: var(--accent); color: white;
          border: none; border-radius: 8px;
          padding: 9px 20px; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: 'Syne', sans-serif;
          transition: all 0.2s;
        }
        .btn-upload:hover { background: #6b5ce7; transform: translateY(-1px); }
        .btn-cancel {
          background: transparent; color: var(--muted);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 9px 16px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: 'Syne', sans-serif;
          transition: all 0.2s;
        }
        .btn-cancel:hover { border-color: var(--border-hover); color: var(--text); }

        /* Progress */
        .progress-wrap { margin-top: 16px; }
        .progress-bar {
          height: 6px; background: rgba(255,255,255,0.08);
          border-radius: 3px; overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent2));
          border-radius: 3px;
          transition: width 0.2s ease;
        }
        .progress-text { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; margin-top: 6px; display: block; }

        /* File List */
        .list-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 24px;
        }
        .list-title { font-size: 22px; font-weight: 800; }
        .list-badge {
          background: var(--accent); color: white;
          font-size: 12px; font-weight: 700;
          padding: 2px 9px; border-radius: 20px;
          font-family: 'DM Mono', monospace;
        }

        .empty-state {
          text-align: center; padding: 80px 24px;
          color: var(--muted);
        }
        .empty-icon { font-size: 56px; margin-bottom: 16px; opacity: 0.3; }

        /* File Grid */
        .file-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
        }

        .file-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          transition: all 0.25s ease;
        }
        .file-card:hover {
          border-color: var(--border-hover);
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        }

        /* Thumbnail */
        .card-thumb {
          height: 150px; position: relative;
          cursor: pointer; overflow: hidden;
          background: rgba(0,0,0,0.3);
        }
        .thumb-img {
          width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .file-card:hover .thumb-img { transform: scale(1.06); }
        .thumb-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          font-size: 42px;
          background: linear-gradient(135deg, rgba(124,106,255,0.1), rgba(255,106,158,0.1));
        }
        .thumb-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .card-thumb:hover .thumb-overlay { opacity: 1; }
        .preview-hint {
          font-size: 13px; font-weight: 700;
          background: var(--accent); color: white;
          padding: 6px 14px; border-radius: 20px;
        }

        /* Card body */
        .card-body { padding: 14px 16px; }
        .card-name {
          font-size: 13px; font-weight: 700;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 8px;
        }
        .card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .badge-mime {
          font-size: 10px; font-weight: 700;
          background: rgba(124,106,255,0.2); color: var(--accent);
          padding: 2px 7px; border-radius: 4px;
          font-family: 'DM Mono', monospace;
        }
        .card-size { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }
        .card-date { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }

        /* Card actions */
        .card-actions {
          display: flex; gap: 8px;
          padding: 12px 16px; 
          border-top: 1px solid var(--border);
        }
        .btn-view {
          flex: 1; text-align: center;
          background: rgba(124,106,255,0.15); color: var(--accent);
          border: 1px solid rgba(124,106,255,0.3); border-radius: 7px;
          padding: 7px 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; text-decoration: none;
          font-family: 'Syne', sans-serif;
          transition: all 0.2s;
        }
        .btn-view:hover { background: rgba(124,106,255,0.3); }
        .btn-delete {
          flex: 1;
          background: rgba(248,113,113,0.1); color: var(--error);
          border: 1px solid rgba(248,113,113,0.2); border-radius: 7px;
          padding: 7px 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: 'Syne', sans-serif;
          transition: all 0.2s;
        }
        .btn-delete:hover:not(:disabled) { background: rgba(248,113,113,0.25); }
        .btn-delete:disabled { opacity: 0.5; cursor: default; }

        /* Lightbox */
        .lightbox-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .lightbox-content {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 18px;
          max-width: 860px; width: 100%;
          max-height: 90vh;
          overflow: auto;
          position: relative;
          animation: zoomIn 0.25s ease;
        }
        @keyframes zoomIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .lightbox-close {
          position: absolute; top: 14px; right: 14px;
          background: rgba(255,255,255,0.1); border: none; color: var(--text);
          width: 32px; height: 32px; border-radius: 50%;
          font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s; z-index: 10;
        }
        .lightbox-close:hover { background: rgba(255,255,255,0.2); }
        .lightbox-header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
        }
        .lightbox-name { font-weight: 700; font-size: 16px; display: block; margin-bottom: 4px; }
        .lightbox-meta { font-size: 12px; color: var(--muted); font-family: 'DM Mono', monospace; }
        .lightbox-img {
          width: 100%; display: block;
          border-radius: 0 0 18px 18px;
          max-height: 70vh; object-fit: contain;
          background: #000;
        }
        .lightbox-nopreview {
          padding: 60px; text-align: center; color: var(--muted);
        }
        .lightbox-nopreview .file-icon { font-size: 56px; display: block; margin-bottom: 16px; }
        .download-btn {
          display: inline-block; margin-top: 16px;
          background: var(--accent); color: white;
          padding: 10px 24px; border-radius: 8px;
          text-decoration: none; font-weight: 700; font-size: 14px;
        }

        /* Toast */
        .toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 2000;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 20px;
          font-size: 14px; font-weight: 600;
          display: flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: toastIn 0.3s ease;
        }
        @keyframes toastIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .toast-success { border-color: rgba(74,222,128,0.3); }
        .toast-success span { color: var(--success); }
        .toast-error { border-color: rgba(248,113,113,0.3); }
        .toast-error span { color: var(--error); }

        @media (max-width: 600px) {
          .file-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
          .pre-upload { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}
