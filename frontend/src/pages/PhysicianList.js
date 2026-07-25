import React, { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Physician List module (developer-only page, /physician-list): manages the
 * name-only roster that populates the Physician autocomplete in Add
 * Schedule. Names can be bulk-uploaded from a CSV or Excel file, added
 * manually one at a time, or removed. No user accounts/logins are created --
 * these are display names only.
 */
export default function PhysicianList() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0); // reset the <input type="file"> after upload
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [manualName, setManualName] = useState('');
  const [adding, setAdding] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/physician-roster').then((res) => setEntries(res.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setUploadResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // No explicit Content-Type: the browser sets multipart/form-data with
      // the boundary itself, which multer needs to parse the request.
      const res = await api.post('/physician-roster/upload', formData);
      setUploadResult(res.data);
      setFile(null);
      setFileInputKey((k) => k + 1);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file.');
    } finally {
      setUploading(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    const name = manualName.trim();
    if (!name) return;
    setError('');
    setAdding(true);
    try {
      await api.post('/physician-roster', { name });
      setManualName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add name.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Remove "${entry.fullName}" from the physician list? Existing schedules that already use this name are not affected.`)) return;
    setError('');
    setDeletingId(entry.id);
    try {
      await api.delete(`/physician-roster/${entry.id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove name.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: 860 }}>
      <h4 className="mb-1">Physician List</h4>
      <p className="text-muted small">
        These names populate the Physician field suggestions when creating a rotation schedule.
        No accounts or logins are created -- names only.
      </p>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <h6 className="card-title">Upload from file</h6>
          <p className="text-muted small mb-2">
            CSV or Excel (.xlsx / .xls). Use a <code>name</code> header column, or simply put one
            physician name per row in the first column.
          </p>
          <form onSubmit={handleUpload} className="d-flex align-items-center flex-wrap gap-2">
            <input
              key={fileInputKey}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="form-control"
              style={{ maxWidth: 340 }}
              onChange={(e) => setFile(e.target.files[0] || null)}
            />
            <button type="submit" className="btn btn-primary" disabled={!file || uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
          {uploadResult && (
            <div className="alert alert-info py-2 mt-3 mb-0">
              <div>{uploadResult.message}</div>
              {uploadResult.skipped?.length > 0 && (
                <ul className="small mb-0 mt-2">
                  {uploadResult.skipped.map((s, i) => (
                    <li key={i}>Row {s.row} ({s.name || 'blank'}): {s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="card-title">Add a name manually</h6>
          <form onSubmit={handleManualAdd} className="d-flex align-items-center gap-2">
            <input
              type="text"
              className="form-control"
              style={{ maxWidth: 340 }}
              placeholder="e.g. Dr. Fatma Al-Hinai"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <button type="submit" className="btn btn-outline-primary" disabled={!manualName.trim() || adding}>
              {adding ? 'Adding...' : 'Add'}
            </button>
          </form>
        </div>
      </div>

      <h6 className="mb-2">Current list ({entries.length})</h6>
      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : entries.length === 0 ? (
        <p className="text-muted">No physicians in the list yet. Upload a file or add names above.</p>
      ) : (
        <table className="table table-striped align-middle" style={{ maxWidth: 640 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.fullName}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={deletingId === entry.id}
                    onClick={() => handleDelete(entry)}
                  >
                    {deletingId === entry.id ? 'Removing...' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
