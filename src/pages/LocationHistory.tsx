import React, { useState, useEffect } from 'react';
import AddLocationModal from '../components/AddLocationModal';
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

  // PDF GENERATION — HTML print window (50×38mm sticker, mirrors BulkQRModal reference)
  const generatePDF = async () => {
    if (!selectedLocation || isPdfGenerating) return;
    setIsPdfGenerating(true);

    try {
      // Generate QR as high-res data URL (no network, pure client-side)
      const qrDataUrl = await QRCode.toDataURL(selectedLocation, {
        margin: 1,
        width: 400,
        color: { dark: '#000000', light: '#ffffff' },
      });

      const win = window.open('', '', 'width=900,height=700');
      if (!win) {
        alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
      }

      win.document.write(buildPrintHTML(selectedLocation, qrDataUrl, printCount));
      win.document.close();
      setPdfModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to generate QR. Please try again.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // Builds a self-printing HTML document with one 50×38mm sticker per copy
  const buildPrintHTML = (locationText: string, qrDataUrl: string, count: number): string => {
    const labels = Array.from({ length: count })
      .map(() => `
        <div class="page">
          <img class="qr" src="${qrDataUrl}" alt="QR" />
          <div class="label">${locationText}</div>
        </div>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Labels — ${locationText}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 50mm 38mm;
            margin: 0 !important;
            padding: 0 !important;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white;
            font-family: 'Inter', Arial, sans-serif;
            width: 100%;
            height: 100%;
          }
          .page {
            background: white;
            width: 100%;
            height: 38mm;
            padding: 3mm;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            page-break-after: always;
            overflow: hidden;
            gap: 2mm;
          }
          img.qr {
            width: 28mm;
            height: 28mm;
            display: block;
            object-fit: contain;
            flex-shrink: 0;
          }
          .label {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 900;
            line-height: 1.3;
            word-break: break-word;
            text-align: center;
            color: #111;
            height: 100%;
          }
          @media print {
            html, body {
              width: 50mm !important;
              height: 38mm !important;
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .page {
              margin: 0 !important;
              padding: 2mm !important;
              box-shadow: none;
              border: none;
              width: 100% !important;
              height: 38mm !important;
            }
          }
        </style>
      </head>
      <body>
        ${labels}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 800);
          };
        <\/script>
      </body>
      </html>
    `;
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