import { useState } from 'react';
import axios from 'axios';
import {
  BarChart3,
  CheckCircle,
  Database,
  FileSpreadsheet,
  Play,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getRequestErrorMessage(error, action) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return `${action} failed: ${detail}`;
  if (!error.response) {
    return 'Cannot reach the DataPulse backend. Check that it is running and accessible.';
  }
  return `${action} failed (HTTP ${error.response.status}).`;
}

function formatChartValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(number) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(number);
}

export default function App() {
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setStatus({ message: 'Uploading your dataset…', type: 'loading' });
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData);
      setDatasetInfo(response.data);
      setStatus({
        message: `Dataset ready: ${response.data.filename} (${response.data.total_rows.toLocaleString()} rows)`,
        type: 'success',
      });
    } catch (error) {
      setDatasetInfo(null);
      setStatus({ message: getRequestErrorMessage(error, 'File upload'), type: 'error' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleAnalyze = async (event) => {
    event.preventDefault();
    if (!query.trim() || !datasetInfo || loading) return;

    setLoading(true);
    setStatus({ message: 'DataPulse is analyzing your question…', type: 'loading' });

    try {
      const response = await axios.post(`${API_BASE_URL}/api/analyze`, {
        query: query.trim(),
      });
      setResult(response.data);
      setStatus({ message: 'Analysis completed successfully.', type: 'success' });
    } catch (error) {
      setStatus({ message: getRequestErrorMessage(error, 'Analysis'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <BarChart3 className="brand-icon" size={32} aria-hidden="true" />
          <div className="brand-copy">
            <h1 className="brand-title">DataPulse AI</h1>
            <p className="brand-subtitle">
              Turn your data into clear, useful answers.
            </p>
          </div>
        </div>
        <div className="ready-badge">
          <ShieldCheck size={19} aria-hidden="true" />
          <span>Analytics engine ready</span>
        </div>
      </header>

      <div className="dashboard">
        <section className="panel" aria-labelledby="upload-heading">
          <h2 className="panel-heading" id="upload-heading">
            <FileSpreadsheet className="section-icon" size={22} aria-hidden="true" />
            <span className="step-number">01</span>
            <span>Choose a dataset</span>
          </h2>

          <div className="upload-control">
            <input
              className="file-input"
              id="dataset-file"
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
              aria-describedby="file-hint"
            />
            <label className="upload-button" htmlFor="dataset-file">
              <Upload size={17} aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Choose CSV or Excel file'}
            </label>
            <span className="file-hint" id="file-hint">
              Supported formats: .csv and .xlsx
            </span>
          </div>

          {datasetInfo && (
            <div className="dataset-info" aria-label="Dataset details">
              <span>
                File: <strong>{datasetInfo.filename}</strong>
              </span>
              <span>
                Rows: <strong>{datasetInfo.total_rows.toLocaleString()}</strong>
              </span>
              <span>
                Columns: <strong>{datasetInfo.columns.length}</strong>
              </span>
            </div>
          )}
        </section>

        {datasetInfo && (
          <section className="panel" aria-labelledby="query-heading">
            <h2 className="panel-heading" id="query-heading">
              <Database className="section-icon" size={22} aria-hidden="true" />
              <span className="step-number">02</span>
              <span>Ask a question</span>
            </h2>
            <form className="query-form" onSubmit={handleAnalyze}>
              <input
                className="query-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="For example: Show the top 5 products by sales"
                aria-label="Analytics question"
              />
              <button
                className="run-button"
                type="submit"
                disabled={loading || !query.trim()}
              >
                <Play size={16} aria-hidden="true" />
                {loading ? 'Analyzing…' : 'Run analysis'}
              </button>
            </form>
          </section>
        )}

        {status && (
          <p className="status-message" data-type={status.type} role="status">
            {status.message}
          </p>
        )}

        {result && (
          <section className="panel results-panel" aria-labelledby="results-heading">
            <h2 className="panel-heading results-heading" id="results-heading">
              <CheckCircle size={22} aria-hidden="true" />
              <span>Analysis results</span>
            </h2>
            <p className="summary-box">{result.summary}</p>

            {Array.isArray(result.chart_data) && result.chart_data.length > 0 && (
              <div className="chart-section">
                <h3 className="chart-title">Data visualization</h3>
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={result.chart_data}
                      margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border-strong)' }}
                        tickMargin={10}
                      />
                      <YAxis
                        width={76}
                        tickFormatter={formatChartValue}
                        tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [formatChartValue(value), 'Value']}
                        contentStyle={{ padding: 0, border: 'none', background: 'transparent' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="chart-tooltip">
                              <p className="tooltip-label">{label}</p>
                              <p className="tooltip-value">
                                {formatChartValue(payload[0].value)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar
                        dataKey="value"
                        fill="var(--accent)"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={54}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
