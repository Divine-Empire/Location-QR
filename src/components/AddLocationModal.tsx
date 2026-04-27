import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface LocationRow {
  id: string;
  location: string;
  serial: number;
  qrGenerated: boolean;
}

interface AddLocationModalProps {
  onClose: () => void;
  onSuccess: () => void;
  nextSerial: number;
}

const AddLocationModal: React.FC<AddLocationModalProps> = ({ onClose, onSuccess, nextSerial }) => {
  const [rows, setRows] = useState<LocationRow[]>([{ id: '1', location: '', serial: nextSerial, qrGenerated: false }]);
  const [loading, setLoading] = useState(false);
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Add a new row
  const handleAddRow = () => {
    if (rows.length >= 15) return;
    const lastSerial = rows[rows.length - 1].serial;
    setRows([...rows, { id: Date.now().toString(), location: '', serial: lastSerial + 1, qrGenerated: false }]);
  };

  // Remove a row
  const handleRemoveRow = (id: string) => {
    if (rows.length === 1) return;
    const newRows = rows.filter(row => row.id !== id);
    const updatedRows = newRows.map((row, index) => ({
      ...row,
      serial: nextSerial + index
    }));
    setRows(updatedRows);
  };

  const handleInputChange = (id: string, value: string) => {
    setRows(rows.map(row => row.id === id ? { ...row, location: value, qrGenerated: !!value.trim() } : row));
  };
  
  useEffect(() => {
    if (previewRowId) {
      const row = rows.find(r => r.id === previewRowId);
      if (row && row.location.trim()) {
        generatePreviewImage(row.location);
      }
    } else {
      setPreviewImage(null);
    }
  }, [previewRowId, rows]);

  // Click outside to close preview
  useEffect(() => {
    const handleClickOutside = () => setPreviewRowId(null);
    if (previewRowId) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [previewRowId]);

  // Helper to wrap text on canvas
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = currentLine + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(currentLine.trim());
        currentLine = words[n] + ' ';
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine.trim());
    return lines;
  };

  const generatePreviewImage = async (text: string) => {
    try {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d')!;
      const qrSize = 160;
      const padding = 15;
      const textSpace = 200; // More space for text
      
      tempCanvas.width = qrSize + textSpace + padding * 3;
      tempCanvas.height = qrSize + padding * 2;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      const qrDataUrl = await QRCode.toDataURL(text, { margin: 1, width: qrSize });
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding, qrSize, qrSize);
        ctx.fillStyle = '#000000';
        ctx.font = '500 18px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        
        const lines = wrapText(ctx, text, textSpace);
        const lineHeight = 24;
        const totalHeight = lines.length * lineHeight;
        const startY = (tempCanvas.height / 2) - (totalHeight / 2) + (lineHeight / 2);

        lines.forEach((line, i) => {
          ctx.fillText(line, qrSize + padding * 2, startY + (i * lineHeight));
        });

        setPreviewImage(tempCanvas.toDataURL('image/png'));
      };
      img.src = qrDataUrl;
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePreview = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (previewRowId === id) {
      setPreviewRowId(null);
    } else {
      setPreviewRowId(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.location.trim());
    if (validRows.length === 0) return;

    setLoading(true);
    try {
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      const results: any[] = [];
      const batchSize = 3; // Processing 3 at a time to avoid Google's concurrency limits

      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(batch.map(async (row) => {
          // Generate Canvas
          const tempCanvas = document.createElement('canvas');
          const ctx = tempCanvas.getContext('2d')!;
          const qrSize = 250;
          const padding = 25;
          const textSpace = 300;
          tempCanvas.width = qrSize + textSpace + padding * 3;
          tempCanvas.height = qrSize + padding * 2;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

          const qrDataUrl = await QRCode.toDataURL(row.location, { margin: 1, width: qrSize });
          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, padding, padding, qrSize, qrSize);
              ctx.fillStyle = '#000000';
              ctx.font = '500 24px system-ui, sans-serif';
              ctx.textBaseline = 'middle';
              const lines = wrapText(ctx, row.location, textSpace);
              const lineHeight = 32;
              const totalHeight = lines.length * lineHeight;
              const startY = (tempCanvas.height / 2) - (totalHeight / 2) + (lineHeight / 2);
              lines.forEach((line, i) => ctx.fillText(line, qrSize + padding * 2, startY + (i * lineHeight)));
              resolve(null);
            };
            img.src = qrDataUrl;
          });

          const base64Data = tempCanvas.toDataURL('image/png');
          const safeLocation = row.location.replace(/[^a-z0-9]/gi, '_');
          const fileName = `QR_${safeLocation}_${Date.now()}.png`;

          // Upload with a simple retry
          let uploadSuccess = false;
          let fileUrl = '';
          let attempts = 0;
          
          while (!uploadSuccess && attempts < 2) {
            try {
              const uploadParams = new URLSearchParams();
              uploadParams.append('action', 'uploadFile');
              uploadParams.append('base64Data', base64Data);
              uploadParams.append('fileName', fileName);
              uploadParams.append('mimeType', 'image/png');
              uploadParams.append('folderId', import.meta.env.VITE_FOLDER_ID);

              const res = await fetch(scriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: uploadParams
              });
              const result = await res.json();
              if (result.success) {
                fileUrl = result.fileUrl;
                uploadSuccess = true;
              } else {
                attempts++;
                if (attempts === 2) throw new Error(result.error || 'Upload failed');
                await new Promise(r => setTimeout(r, 500)); // Small wait before retry
              }
            } catch (err) {
              attempts++;
              if (attempts === 2) throw err;
              await new Promise(r => setTimeout(r, 500));
            }
          }

          // Save Row
          const now = new Date();
          const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          
          const insertParams = new URLSearchParams();
          insertParams.append('action', 'insert');
          insertParams.append('sheetName', 'Location-QR');
          insertParams.append('rowData', JSON.stringify([timestamp, "", row.location, fileUrl]));

          const saveRes = await fetch(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: insertParams
          });
          return saveRes.json();
        }));
        
        results.push(...batchResults);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Submission error:', err);
      alert(`Error: ${err.message}. Please try a smaller batch.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '700px' }} 
        onClick={(e) => {
          e.stopPropagation();
          if (previewRowId) setPreviewRowId(null);
        }}
      >
        {/* Centered Preview Card Layer */}
        {previewRowId && previewImage && (
          <div className="preview-overlay" onClick={(e) => {
            e.stopPropagation();
            setPreviewRowId(null);
          }}>
            <div className="preview-card" onClick={(e) => e.stopPropagation()}>
              <button 
                type="button" 
                className="close-preview-btn" 
                onClick={() => setPreviewRowId(null)}
              >
                &times;
              </button>
              <img src={previewImage} style={{ maxWidth: '400px', height: 'auto', borderRadius: '4px' }} alt="QR Preview" />
            </div>
          </div>
        )}

        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', marginBottom: '15px' }}>
          <div>
            <h3>Add New Locations</h3>
            <p style={{ opacity: 0.6, fontSize: '13px', margin: 0 }}>Batch generate up to 15 QR codes</p>
          </div>
          <button type="button" className="btn-secondary" onClick={handleAddRow} disabled={rows.length >= 15} style={{ padding: '8px 15px', fontSize: '13px' }}>
            + Add Row ({rows.length}/15)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <table className="modal-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Preview</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Enter location..."
                        value={row.location}
                        onChange={(e) => handleInputChange(row.id, e.target.value)}
                        required
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-row-action"
                        style={{ margin: '0 auto', backgroundColor: previewRowId === row.id ? 'var(--accent-light)' : 'transparent' }}
                        onClick={(e) => handleTogglePreview(e, row.id)}
                        disabled={!row.location.trim()}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={previewRowId === row.id ? 'var(--accent)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-row-action delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRow(row.id);
                        }}
                        disabled={rows.length === 1}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading || !rows.some(r => r.location.trim())} 
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                  Saving Batch...
                </>
              ) : `Generate & Save ${rows.filter(r => r.location.trim()).length} Items`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLocationModal;
