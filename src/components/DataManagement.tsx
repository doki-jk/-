import { ArchiveRestore, DatabaseBackup, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  createFuelLogBackup,
  createMealsCsv,
  parseFuelLogBackup,
  restoreFuelLogBackup,
} from '../services/dataBackup';
import { assertBackupFileSize } from '../services/backupFileLimits';
import '../data-management.css';

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

export function DataManagement() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function exportJson() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const backup = await createFuelLogBackup();
      downloadText(`FuelLog-backup-${dateStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
      setMessage(`完整备份已生成：${backup.data.meals.length} 条饮食、${backup.data.bodyRecords.length} 条身体数据。`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '生成备份失败');
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const backup = await createFuelLogBackup();
      downloadText(`FuelLog-meals-${dateStamp()}.csv`, createMealsCsv(backup), 'text/csv;charset=utf-8');
      setMessage(`饮食 CSV 已生成，共 ${backup.data.meals.length} 条记录。`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : '导出 CSV 失败');
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setMessage('');
    setError('');
    try {
      assertBackupFileSize(file);
    } catch (sizeError) {
      setError(sizeError instanceof Error ? sizeError.message : '备份文件大小无效');
      if (fileInput.current) fileInput.current.value = '';
      return;
    }

    if (!window.confirm('恢复备份会覆盖当前设备上的全部 FuelLog 数据。请确认已经导出当前数据。')) return;
    setBusy(true);
    try {
      const backup = parseFuelLogBackup(await file.text());
      await restoreFuelLogBackup(backup);
      setMessage('备份恢复成功，正在重新载入应用。');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '恢复备份失败');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="data-management-page">
      <div className="settings-heading">
        <p className="eyebrow">数据安全</p>
        <h1>备份、恢复与导出</h1>
        <p>定期保存完整 JSON 备份。CSV 适合在 Excel 中查看，但不能完整恢复应用状态。</p>
      </div>

      {(message || error) && <p className={error ? 'form-error' : 'data-status'} role={error ? 'alert' : 'status'}>{error || message}</p>}

      <div className="data-management-grid">
        <article className="panel data-management-card">
          <div className="data-management-icon"><DatabaseBackup size={24} /></div>
          <div>
            <h2>完整 JSON 备份</h2>
            <p>包含饮食、食物库、收藏、目标、每日训练状态和身体数据，可用于完整恢复。</p>
          </div>
          <button className="primary" disabled={busy} onClick={() => void exportJson()}><Download size={17} />导出完整备份</button>
        </article>

        <article className="panel data-management-card">
          <div className="data-management-icon"><FileSpreadsheet size={24} /></div>
          <div>
            <h2>饮食 CSV</h2>
            <p>导出每条饮食记录，方便在 Excel 或其他表格软件中统计和分析。</p>
          </div>
          <button className="ghost" disabled={busy} onClick={() => void exportCsv()}><Download size={17} />导出 CSV</button>
        </article>

        <article className="panel data-management-card danger-card">
          <div className="data-management-icon"><ArchiveRestore size={24} /></div>
          <div>
            <h2>从备份恢复</h2>
            <p>会覆盖当前设备中的 FuelLog 数据。恢复前应先导出当前完整备份。</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
          <button className="ghost" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={17} />选择备份文件</button>
        </article>
      </div>

      <div className="data-safety-note">
        <Upload size={19} />
        <div><strong>建议每周备份一次</strong><span>网页数据可能因清理站点数据而消失；桌面数据也应在系统重装前导出。</span></div>
      </div>
    </section>
  );
}
