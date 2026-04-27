import React, { useState, useEffect } from 'react';
import AddLocationModal from '../components/AddLocationModal';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      // Explicitly adding action=fetch to match your backend logic
      const response = await fetch(`${scriptUrl}?action=fetch&sheet=Location-QR`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Script URL or Deployment not found (404). Please re-deploy as "Anyone".');
        }
        throw new Error(`Server Error (${response.status}). Please check Apps Script logs.`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to retrieve data');
      }

      const [headers, ...rows] = result.data;
      const records: LocationRecord[] = rows.map((row: any[]) => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj as LocationRecord;
      });

      setData(records);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Could not load location history. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const nextSerial = data.length > 0 ? Number(data[data.length - 1]['Serial No.']) + 1 : 1;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
  };

  const filteredData = data.filter(item => 
    item.Location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="card table-card">
        <div className="header-card" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>Location History</h2>
          
          <div style={{ marginLeft: 'auto', marginRight: '15px', width: '300px', position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search by location name..." 
              className="input-field" 
              style={{ padding: '10px 15px 10px 40px', borderRadius: '10px', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg 
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} 
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <button className="btn-add" onClick={() => setIsModalOpen(true)}>
            + Add-Location
          </button>
        </div>
        
        <div className="table-wrapper">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <span className="spinner" style={{ borderTopColor: 'var(--accent)' }}></span>
              <p>Loading records...</p>
            </div>
          ) : error ? (
            <div className="alert alert-error" style={{ margin: '10px' }}>
              {error}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>S. No.</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>QR-Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', opacity: 0.5 }}>
                      {searchTerm ? `No locations matching "${searchTerm}"` : 'No location records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((record, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: '600', color: 'var(--accent)' }}>{record['Serial No.']}</td>
                      <td>{formatDate(record.Timestamp)}</td>
                      <td>{record.Location}</td>
                      <td style={{ textAlign: 'center' }}>
                        <a 
                          href={record['QR-Link'] ? record['QR-Link'].replace('export=view', 'export=download') : '#'} 
                          className="btn-row-action" 
                          style={{ margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}
                          title="Download QR"
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <AddLocationModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchData}
          nextSerial={nextSerial}
        />
      )}
    </div>
  );
};

export default LocationHistory;
