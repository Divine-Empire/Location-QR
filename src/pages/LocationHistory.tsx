import React, { useState, useEffect } from 'react';
import AddLocationModal from '../components/AddLocationModal';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface LocationRecord {
  Timestamp: string;
  'Serial No.': string | number;
  Location: string;
  'QR-Link': string;
}

const LocationHistory: React.FC = () => {
  const [data, setData] = useState<LocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // NEW STATES
  const [pdfModal, setPdfModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [printCount, setPrintCount] = useState(1);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      const response = await fetch(`${scriptUrl}?action=fetch&sheet=Location-QR`);

      if (!response.ok) {
        throw new Error(`Server Error (${response.status})`);
      }

      const result = await response.json();

      const [headers, ...rows] = result.data;
      const records: LocationRecord[] = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj;
      });

      setData(records);
    } catch (err) {
      setError('Could not load location history.');
    } finally {
      setLoading(false);
    }
  };

  const nextSerial = data.length > 0 ? Number(data[data.length - 1]['Serial No.']) + 1 : 1;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${date.getFullYear()}`;
  };

  const filteredData = data.filter(item =>
    item.Location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // OPEN MODAL
  const handleDownloadClick = (locationText: string) => {
    setSelectedLocation(locationText);
    setPdfModal(true);
  };

  // PDF GENERATION — vertical stack of bordered labels (matches reference layout)
  const generatePDF = async () => {
    if (!selectedLocation || isPdfGenerating) return;
    setIsPdfGenerating(true);

    try {
      const base64 = await generateQRLabelBase64(selectedLocation);

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = 210, pageH = 297;
      const margin = 12;
      const cols = 2;
      const gapX = 5, gapY = 5;
      const labelW = (pageW - 2 * margin - (cols - 1) * gapX) / cols; // ~91.5mm each
      const labelH = labelW * (200 / 460);                             // ~39.8mm

      let col = 0, row = 0;
      for (let i = 0; i < printCount; i++) {
        // New row starting — check if we need a new page
        if (col === 0 && i > 0) {
          const nextY = margin + row * (labelH + gapY);
          if (nextY + labelH > pageH - margin) {
            doc.addPage();
            row = 0;
          }
        }
        const x = margin + col * (labelW + gapX);
        const y = margin + row * (labelH + gapY);
        doc.addImage(base64, 'PNG', x, y, labelW, labelH);
        col++;
        if (col >= cols) { col = 0; row++; }
      }

      doc.save(`QR_${selectedLocation.replace(/[^a-z0-9]/gi, '_')}.pdf`);
      setPdfModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // Generates a bordered label canvas — QR left, bold location text right
  // Canvas: 460×200 → maps to ~91.5×39.8mm in PDF (2-up layout)
  const generateQRLabelBase64 = async (locationText: string): Promise<string> => {
    const CW = 460, CH = 200;
    const QR_ZONE = 200;              // QR occupies left 200px (square)
    const QR_SIZE = 178;
    const QR_PAD = (CH - QR_SIZE) / 2;
    const TEXT_X = QR_ZONE + 16;
    const TEXT_MAX_W = CW - TEXT_X - 10;

    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d')!;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CW, CH);

    // Outer border
    ctx.strokeStyle = '#b0b0b0';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, CW - 3, CH - 3);

    // Vertical divider between QR and text
    ctx.beginPath();
    ctx.moveTo(QR_ZONE, 10);
    ctx.lineTo(QR_ZONE, CH - 10);
    ctx.strokeStyle = '#dedede';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(locationText, {
      margin: 1,
      width: QR_SIZE,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Draw QR centered in left zone
        ctx.drawImage(img, QR_PAD, QR_PAD, QR_SIZE, QR_SIZE);

        // Location text — bold, word-wrapped, vertically centered
        ctx.fillStyle = '#111111';
        ctx.textBaseline = 'top';

        // Word-wrap
        const wrapText = (text: string, maxW: number, fontSize: number) => {
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          const words = text.split(/\s+/);
          const lines: string[] = [];
          let line = '';
          for (const w of words) {
            const test = line ? `${line} ${w}` : w;
            if (ctx.measureText(test).width > maxW && line) {
              lines.push(line);
              line = w;
            } else {
              line = test;
            }
          }
          if (line) lines.push(line);
          return lines;
        };

        // Try font size 38, fall back to 30 if too many lines
        let fontSize = 38;
        let lines = wrapText(locationText, TEXT_MAX_W, fontSize);
        if (lines.length > 3) {
          fontSize = 30;
          lines = wrapText(locationText, TEXT_MAX_W, fontSize);
        }

        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        const lineH = fontSize + 8;
        const totalH = lines.length * lineH;
        const startY = (CH - totalH) / 2;

        lines.forEach((l, i) => ctx.fillText(l, TEXT_X, startY + i * lineH));

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = qrDataUrl;
    });
  };


  return (
    <div className="page-container">
      <div className="card table-card">
        <div className="header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Location History</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              placeholder="Search by location..."
              className="input-field"
              style={{ maxWidth: '190px', margin: 0 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="btn-add" onClick={() => setIsModalOpen(true)}>
              Add-Location
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-container">
              <div className="spinner-large"></div>
              <p className="loading-text">Fetching location history...</p>
            </div>
          ) : error ? (
            <p>{error}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ fontSize: '16px', fontWeight: '700' }}>S. No.</th>
                  <th style={{ fontSize: '16px', fontWeight: '700' }}>Date</th>
                  <th style={{ fontSize: '16px', fontWeight: '700' }}>Location</th>
                  <th style={{ fontSize: '16px', fontWeight: '700', width: '100px' }}>QR-Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record, index) => (
                  <tr key={index}>
                    <td style={{ fontSize: '17px' }}>{record['Serial No.']}</td>
                    <td style={{ fontSize: '17px' }}>{formatDate(record.Timestamp)}</td>
                    <td style={{ fontSize: '17px' }}>{record.Location}</td>
                    <td style={{ textAlign: 'center', width: '100px' }}>
                      <button
                        onClick={() => handleDownloadClick(record.Location)}
                        className="btn-row-action"
                        style={{ margin: '0 auto' }}
                      >
                        ⬇
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ADD LOCATION MODAL */}
      {isModalOpen && (
        <AddLocationModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchData}
          nextSerial={nextSerial}
        />
      )}

      {/* PDF MODAL */}
      {pdfModal && (
        <div className="modal-overlay" onClick={() => setPdfModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Generate QR PDF</h3>
              <p>Configure printing for the selected location</p>
            </div>

            <div className="input-group">
              <label>Number of prints to generate:</label>
              <input
                type="number"
                className="input-field"
                value={printCount}
                min={1}
                max={100}
                onChange={(e) => setPrintCount(Number(e.target.value))}
                style={{ textAlign: 'left' }}
              />
              <small style={{ display: 'block', marginTop: '8px', color: 'var(--text)', opacity: 0.7 }}>
                Copies will be distributed across A4 pages.
              </small>
            </div>

            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={generatePDF}
                disabled={isPdfGenerating}
                style={{ flex: 2, opacity: isPdfGenerating ? 0.8 : 1, cursor: isPdfGenerating ? 'not-allowed' : 'pointer' }}
              >
                {isPdfGenerating ? (
                  <><span className="spinner" style={{ borderTopColor: '#fff', width: '16px', height: '16px', marginRight: '8px' }}></span>Generating...</>
                ) : 'Download PDF'}
              </button>
              <button className="btn-secondary" onClick={() => setPdfModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationHistory;